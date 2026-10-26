import type { AfricaClient } from "africastalking-client";
import { requestCallMicrophone } from "@/lib/azera-webrtc";

type IncomingCall = { id: string; customer_phone: string; selected_department?: string; status: string };
export type IncomingPhoneState = {
  state: "off" | "connecting" | "ready" | "ringing" | "active" | "error";
  call: IncomingCall | null; error: string | null; muted: boolean; held: boolean; audioBlocked: boolean;
};

/** One long-lived receiving phone per agent. Ready is advertised only after the
 * provider SDK is ready, never merely because a token was issued. */
export class AfricaIncomingPhone {
  snapshot: IncomingPhoneState = { state: "off", call: null, error: null, muted: false, held: false, audioBlocked: false };
  private client: AfricaClient | null = null;
  private lease = crypto.randomUUID();
  private stopped = false;
  private incoming = false;
  private accepted = false;
  private heartbeat?: ReturnType<typeof setInterval>;
  private setupDeadline?: ReturnType<typeof setTimeout>;
  private refreshAt = 0;
  private ticking = false;
  private failures = 0;
  private generation = 0;
  private leased = false;
  private queues: string[] = [];
  constructor(private changed: (state: IncomingPhoneState) => void) {}
  private change(value: Partial<IncomingPhoneState>) {
    this.snapshot = { ...this.snapshot, ...value };
    this.changed(this.snapshot);
  }
  private async post(action: string) {
    const response = await fetch("/api/azera/calls/africa-browser/agent", {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ action, lease: this.lease, queues: this.queues }), signal: AbortSignal.timeout(20_000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Your browser phone could not connect.");
    return result;
  }
  async start(queues: string[]) {
    if (this.client || this.snapshot.state === "connecting") return;
    const generation = ++this.generation;
    this.stopped = false; this.queues = queues; this.failures = 0;
    this.change({ state: "connecting", error: null });
    try {
      const stream = await requestCallMicrophone();
      stream.getTracks().forEach(track => track.stop());
      if (this.stopped || generation !== this.generation) return;
      this.leased = true;
      const prepared = await this.post("register");
      if (this.stopped || generation !== this.generation) return;
      const { default: sdk } = await import("africastalking-client");
      if (this.stopped || generation !== this.generation) return;
      const client = new sdk.Client(prepared.token);
      this.client = client;
      this.refreshAt = Date.now() + 50*60_000;
      client.on("ready", () => {
        if (this.stopped || client !== this.client) return;
        void this.post("ready").then(() => {
          if (this.stopped || client !== this.client) return;
          clearTimeout(this.setupDeadline);
          if (!this.incoming) this.change({ state: "ready" });
          clearInterval(this.heartbeat);
          this.heartbeat = setInterval(() => void this.tick(), 15_000);
        }).catch(error => { if (client === this.client) void this.fail(error.message); });
      });
      client.on("incomingcall", () => {
        if (this.stopped || client !== this.client || this.incoming) return;
        this.incoming = true;
        this.change({ state: "ringing", muted: false, held: false, error: null });
        void this.loadCall().catch(error => {
          if (client === this.client && this.incoming) void this.fail(error.message);
        });
      });
      client.on("callaccepted", () => {
        if (this.stopped || client !== this.client || !this.incoming || this.accepted) return;
        this.accepted = true;
        this.change({ state: "active" });
        void this.save("active").catch(error => this.change({ error: error.message }));
        void this.resumeAudio();
      });
      client.on("hangup", () => {
        if (this.stopped || client !== this.client) return;
        void this.finish(this.accepted ? "ended" : "missed");
      });
      for (const event of ["offline", "closed", "notready"]) client.on(event, () => {
        if (!this.stopped && client === this.client) void this.fail("Your browser phone disconnected. Reconnect to receive calls.");
      });
      this.setupDeadline = setTimeout(() => void this.fail("The provider did not register your phone. Check WebRTC activation and reconnect."), 30_000);
    } catch (error) { if (!this.stopped && generation === this.generation) await this.fail(error instanceof Error ? error.message : "Could not enable your phone."); }
  }
  private async loadCall() {
    const generation = this.generation;
    const response = await fetch("/api/azera/calls/africa-browser/agent", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load the incoming call.");
    if (this.stopped || generation !== this.generation || !this.incoming) return;
    if (!data.call) throw new Error("This call is no longer available.");
    this.change({ call: data.call });
  }
  private async save(status: string) {
    if (!this.snapshot.call) return;
    const response = await fetch(`/api/azera/calls/${this.snapshot.call.id}/africa-browser`, {
      method: "PATCH", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Call history could not be saved. Check Call Reports.");
  }
  private async tick() {
    if (this.stopped || this.ticking) return;
    const generation = this.generation;
    this.ticking = true;
    try {
      // Rotating while talking would cut audio; defer token refresh until idle.
      if (!this.incoming && Date.now() > this.refreshAt) {
        const queues = this.queues;
        await this.stop();
        await this.start(queues);
        return;
      }
      await this.post("heartbeat");
      if (this.accepted) {
        const response = await fetch("/api/admin/session", { method: "POST", signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error("Your staff session expired. Sign in again to receive calls.");
        await this.save("active");
      }
      this.failures = 0;
    } catch (error) {
      if (generation === this.generation && ++this.failures >= 3) await this.fail(error instanceof Error ? error.message : "Your phone connection was lost.");
    } finally { this.ticking = false; }
  }
  async answer() {
    if (!this.client || this.snapshot.state !== "ringing" || !this.snapshot.call) return;
    try {
      const stream = await requestCallMicrophone(); stream.getTracks().forEach(track => track.stop());
      if (!this.stopped) this.client?.answer();
    } catch (error) { this.change({ error: error instanceof Error ? error.message : "Allow microphone access to answer." }); }
  }
  async end() {
    try { this.client?.hangup(); } catch { /* finish history below */ }
    await this.finish(this.accepted ? "ended" : "missed");
  }
  private finishing = false;
  private async finish(status: string) {
    if (this.finishing) return;
    this.finishing = true;
    try { await this.save(status); }
    catch (error) { this.change({ error: (error as Error).message }); }
    finally {
      this.incoming = false; this.accepted = false; this.finishing = false;
      if (!this.stopped) this.change({ state: "ready", call: null, muted: false, held: false });
    }
  }
  mute() {
    if (this.snapshot.state !== "active") return;
    try {
      if (this.snapshot.muted) this.client?.unmute(); else this.client?.mute();
      this.change({ muted: !this.snapshot.muted });
    } catch { this.change({ error: "Could not change mute." }); }
  }
  hold() {
    if (this.snapshot.state !== "active") return;
    try {
      if (this.snapshot.held) this.client?.unhold(); else this.client?.hold();
      this.change({ held: !this.snapshot.held });
    } catch { this.change({ error: "Could not change hold." }); }
  }
  dtmf(digit: string) { if (this.snapshot.state === "active" && /^[0-9*#]$/.test(digit)) this.client?.dtmf(digit); }
  async resumeAudio() {
    const audio = document.getElementById("remote-stream-audio") as HTMLAudioElement | null;
    audio?.setAttribute("playsinline", "");
    if (!audio?.srcObject) return;
    try { await audio.play(); this.change({ audioBlocked: false }); }
    catch { this.change({ audioBlocked: true }); }
  }
  private async fail(error: string) { await this.stop(); this.change({ state: "error", error }); }
  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.generation++;
    clearInterval(this.heartbeat); clearTimeout(this.setupDeadline);
    const client = this.client; this.client = null;
    try { if (this.incoming) client?.hangup(); client?.destroy(); } catch { /* best effort */ }
    if (this.incoming) await this.finish(this.accepted ? "ended" : "missed");
    if (this.leased) {
      await this.post("stop").catch(() => undefined);
      this.leased = false;
    }
    this.change({ state: "off", call: null, muted: false, held: false });
  }
}
