import { BrowserCall, requestCallMicrophone, type BrowserCallOptions, type CallSnapshot } from "@/lib/azera-webrtc";

/** One publishing and one receiving connection keep SFU negotiation serial.
 * App secrets, session IDs and peer track locators never come from the browser.
 */
export class CloudflareCall {
  disposed = false;
  snapshot: CallSnapshot = { state: "idle", error: null, isMuted: false, audioBlocked: false };
  private started = false;
  private finished = false;
  private stream?: MediaStream;
  private publisher?: RTCPeerConnection;
  private receiver?: RTCPeerConnection;
  private audio?: HTMLAudioElement;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private deadline?: ReturnType<typeof setTimeout>;
  private maximum?: ReturnType<typeof setTimeout>;
  private disconnectTimer?: ReturnType<typeof setTimeout>;
  private failures = 0;
  private subscribing = false;
  private confirmed = false;
  private publishing = false;
  private publicationConfirmed = false;
  private receptionNegotiated = false;
  private iceServers: RTCIceServer[] = [];
  constructor(private options: BrowserCallOptions) {}
  private change(next: Partial<CallSnapshot>) {
    if (!this.disposed) { this.snapshot = { ...this.snapshot, ...next }; this.options.onChange(this.snapshot); }
  }
  private async request(action?: string, extra: object = {}, keepalive = false) {
    return cloudflareCallRequest(this.options, action, extra, keepalive);
  }
  async start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.change({ state: this.options.isAgent ? "ringing" : "connecting" });
    this.deadline = setTimeout(() => void this.fail("Our team couldn’t connect this call. Please leave a message here.", "missed"), 60_000);
    if (!this.options.isAgent) {
      try { await this.connect(); } catch { if (!this.finished) await this.fail("The audio connection could not be established. Please try again or continue in chat."); }
    }
    if (!this.finished) void this.poll();
  }
  async answer() {
    if (!this.options.isAgent || this.finished || this.publishing || this.publisher) return;
    this.change({ state: "connecting" });
    try {
      // Microphone permission is obtained in the explicit Answer gesture.
      this.stream = this.options.localStream || await requestCallMicrophone();
      if (this.finished) { this.stream.getTracks().forEach((track) => track.stop()); return; }
      await this.request("accept");
      await this.connect();
    } catch { if (!this.finished) await this.fail("We couldn’t answer this call. Check microphone permissions or try again."); }
  }
  private async connect() {
    this.publishing = true;
    const config = await this.request("config");
    if (this.finished) return;
    this.iceServers = config.iceServers;
    this.maximum = setTimeout(() => void this.end(), Math.min(1800, config.maxSeconds || 1800) * 1000);
    this.stream = this.stream || this.options.localStream || await requestCallMicrophone();
    if (this.finished) { this.stream.getTracks().forEach((track) => track.stop()); return; }
    const track = this.stream.getAudioTracks()[0];
    if (!track) throw new Error("Microphone unavailable");
    const pc = this.peer(); this.publisher = pc;
    const transceiver = pc.addTransceiver(track, { direction: "sendonly" });
    await pc.setLocalDescription(await pc.createOffer());
    await gatherIce(pc);
    if (this.finished) return;
    const result = await this.request("publish", { sessionDescription: pc.localDescription?.toJSON(), mid: transceiver.mid });
    if (!this.finished) await pc.setRemoteDescription(result.sessionDescription);
  }
  private peer() {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers, bundlePolicy: "max-bundle" });
    pc.onconnectionstatechange = () => {
      if (this.finished) return;
      if (pc.connectionState === "connected") {
        clearTimeout(this.disconnectTimer);
        if (pc === this.publisher) void this.request("published").then(() => { this.publicationConfirmed = true; void this.confirm(); }).catch(() => void this.fail("The microphone connection could not be confirmed."));
        void this.confirm();
      } else if (pc.connectionState === "failed") void this.fail("The call disconnected. Please reconnect or continue in chat.");
      else if (pc.connectionState === "disconnected") {
        clearTimeout(this.disconnectTimer);
        this.disconnectTimer = setTimeout(() => void this.fail("The audio connection was lost. Please reconnect."), 12_000);
      }
    };
    return pc;
  }
  private async confirm() {
    if (this.confirmed || this.finished || !this.publicationConfirmed || !this.receptionNegotiated || this.publisher?.connectionState !== "connected" || this.receiver?.connectionState !== "connected") return;
    this.confirmed = true;
    try {
      await this.request("connected");
      if (!this.finished) { clearTimeout(this.deadline); this.change({ state: "active" }); }
    } catch { if (!this.finished) await this.fail("The call could not be confirmed. Please reconnect."); }
  }
  private async subscribe() {
    if (this.subscribing || this.receiver || !this.publisher || this.finished) return;
    this.subscribing = true;
    try {
      const result = await this.request("subscribe");
      if (this.finished || result.waiting) return;
      const pc = this.peer(); this.receiver = pc;
      this.audio = this.options.remoteAudioEl || new Audio();
      this.audio.autoplay = true; this.audio.setAttribute("playsinline", "");
      pc.ontrack = (event) => {
        if (this.finished || !this.audio) return;
        this.audio.srcObject = new MediaStream([event.track]);
        void this.resumeAudio();
      };
      await pc.setRemoteDescription(result.sessionDescription);
      await pc.setLocalDescription(await pc.createAnswer());
      await gatherIce(pc);
      if (!this.finished) { await this.request("answer", { sessionDescription: pc.localDescription?.toJSON() }); this.receptionNegotiated = true; await this.confirm(); }
    } finally { this.subscribing = false; }
  }
  private async poll() {
    if (this.finished || this.disposed) return;
    try {
      const result = await this.request();
      if (this.finished || this.disposed) return;
      if (!["ringing", "active"].includes(result.status)) {
        this.finished = true; this.release(); this.change({ state: "ended" }); return;
      }
      if (result.ready && this.publicationConfirmed && this.publisher?.connectionState === "connected") await this.subscribe();
      this.failures = 0;
    } catch {
      if (++this.failures >= 3) { await this.fail("The call connection was interrupted. Please reconnect or continue in chat."); return; }
    }
    if (!this.finished && !this.disposed) this.pollTimer = setTimeout(() => void this.poll(), this.confirmed ? 15_000 : 1500);
  }
  toggleMute() {
    const muted = !this.snapshot.isMuted;
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    this.change({ isMuted: muted });
  }
  async resumeAudio() {
    if (!this.audio) return;
    try { await this.audio.play(); this.change({ audioBlocked: false }); }
    catch { this.change({ audioBlocked: true }); }
  }
  async end(decline = false, outcome = "ended") {
    this.finished = true; this.release();
    try { await this.request("end", { outcome: decline ? "busy" : outcome }, true); this.change({ state: "ended", error: null }); }
    catch { this.change({ state: "error", error: "Your microphone is off, but audio-service shutdown could not be confirmed. Please retry Hang up." }); }
  }
  private async fail(message: string, outcome = "failed") {
    if (this.finished) return;
    await this.end(false, outcome);
    this.change({ state: "error", error: message + (this.snapshot.error ? " Retry Hang up to confirm shutdown." : "") });
  }
  private release() {
    clearTimeout(this.pollTimer); clearTimeout(this.deadline); clearTimeout(this.maximum); clearTimeout(this.disconnectTimer);
    for (const pc of [this.publisher, this.receiver]) if (pc) { pc.onconnectionstatechange = null; pc.ontrack = null; pc.close(); }
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.audio) { this.audio.pause(); this.audio.srcObject = null; }
  }
  dispose() {
    if (this.disposed) return;
    if (this.started && !this.finished) void this.request("end", {}, true).catch(() => {});
    this.disposed = true; this.finished = true; this.release();
  }
}

async function cloudflareCallRequest(options: BrowserCallOptions, action?: string, extra: object = {}, keepalive = false) {
  const response = await fetch(`/api/azera/calls/${encodeURIComponent(options.callId)}/cloudflare`, {
    method: action ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(options.authToken ? { "X-Azera-Chat-Token": options.authToken } : {}) },
    ...(action ? { body: JSON.stringify({ action, ...extra }) } : {}), cache: "no-store", keepalive, signal: AbortSignal.timeout(45_000),
  });
  const result = await response.json();
  if (!response.ok || result.success === false) throw new Error(result.error || "Audio is temporarily unavailable");
  return result;
}
export async function gatherIce(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const done = () => { clearTimeout(timer); pc.removeEventListener("icegatheringstatechange", change); resolve(); };
    const change = () => { if (pc.iceGatheringState === "complete") done(); };
    const timer = setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", change);
      // A gathered candidate is usable even when an unreachable relay delays
      // the completion event; an SDP without any candidate is not.
      if (pc.localDescription?.sdp.includes("a=candidate:")) resolve(); else reject(new Error("Audio network discovery timed out"));
    }, 7000);
    pc.addEventListener("icegatheringstatechange", change); change();
  });
}

/** Select from the server-owned call record, never a browser/env assumption. */
export class WebsiteCall {
  disposed = false;
  private engine?: BrowserCall | CloudflareCall;
  private pendingAnswer = false;
  private started = false;
  constructor(private options: BrowserCallOptions) {}
  async start() {
    if (this.disposed || this.started) return;
    this.started = true;
    this.options.onChange({ state: this.options.isAgent ? "ringing" : "connecting", error: null, isMuted: false, audioBlocked: false });
    try {
      const config = await cloudflareCallRequest(this.options);
      if (this.disposed) return;
      this.engine = config.transport === "cloudflare" ? new CloudflareCall(this.options) : new BrowserCall(this.options);
      await this.engine.start();
      if (this.pendingAnswer) await this.engine.answer();
    } catch {
      if (!this.disposed) {
        this.options.localStream?.getTracks().forEach((track) => track.stop());
        this.options.onChange({ state: "error", error: "Calling is temporarily unavailable. Please reconnect or continue in chat.", isMuted: false, audioBlocked: false });
      }
    }
  }
  async answer() { this.pendingAnswer = true; await this.engine?.answer(); }
  async end(decline = false) { if (this.engine) { await this.engine.end(decline); return this.engine.snapshot.state === "ended"; } this.dispose(); return true; }
  toggleMute() { this.engine?.toggleMute(); }
  async resumeAudio() { await this.engine?.resumeAudio(); }
  dispose() { this.disposed = true; this.engine?.dispose(); if (this.started && !this.engine) this.options.localStream?.getTracks().forEach((track) => track.stop()); }
}
