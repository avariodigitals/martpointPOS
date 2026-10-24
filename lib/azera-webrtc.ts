// Browser-only call engine, kept independent of React so lifecycle and
// signaling can be regression-tested without a microphone or a real call.
export type CallState = "idle" | "connecting" | "ringing" | "active" | "ended" | "error"
export type CallSnapshot = { state: CallState; error: string | null; isMuted: boolean; audioBlocked: boolean }
type Signal = { id: string; event_type: string; actor_type: string; metadata: {
  sdp?: string; candidate?: string; sdp_mid?: string | null; sdp_mline_index?: number | null;
  candidate_sdp_mid?: string | null; candidate_sdp_mline_index?: number | null;
} }
type SignalResponse = { data: Signal[]; call: { status: string }; ice_servers?: RTCIceServer[] }
type Options = {
  callId: string; isAgent: boolean; authToken?: string | null; localStream?: MediaStream;
  remoteAudioEl?: HTMLAudioElement; onChange: (value: CallSnapshot) => void;
}

export function microphoneError(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") return "Please allow microphone access in your browser’s site settings, then try calling again. You can also message us here."
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No microphone was found. Connect a microphone or message us here instead."
  if (name === "NotReadableError" || name === "TrackStartError") return "Your microphone is busy or unavailable. Close other apps using it and try again."
  return "We couldn’t access your microphone. Check your browser permissions or message us here instead."
}

export async function requestCallMicrophone(): Promise<MediaStream> {
  if (!globalThis.navigator?.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
    throw new Error("Voice calls need a supported browser and a secure connection. Please message us here instead.")
  }
  try { return await navigator.mediaDevices.getUserMedia({ audio: true }) }
  catch (error) { throw new Error(microphoneError(error)) }
}

export class BrowserCall {
  snapshot: CallSnapshot = { state: "idle", error: null, isMuted: false, audioBlocked: false }
  disposed = false
  private finished = false
  private started = false
  private pc: RTCPeerConnection | null = null
  private stream: MediaStream | null = null
  private audio: HTMLAudioElement | null = null
  private seen = new Set<string>()
  private pollTimer?: ReturnType<typeof setTimeout>
  private deadline?: ReturnType<typeof setTimeout>
  private disconnectTimer?: ReturnType<typeof setTimeout>
  private failures = 0
  private processingSignals = false
  private readonly base: string

  constructor(private options: Options) {
    this.base = `/api/azera/calls/${encodeURIComponent(options.callId)}`
  }

  private change(value: Partial<CallSnapshot>) {
    if (this.disposed) return
    this.snapshot = { ...this.snapshot, ...value }
    this.options.onChange(this.snapshot)
  }

  private async request<T>(path: string, body?: object, method = "POST", keepalive = false): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (this.options.authToken) headers["X-Azera-Chat-Token"] = this.options.authToken
    let response: Response
    try {
      response = await fetch(`${this.base}${path}`, {
        method: body ? method : "GET", headers, cache: "no-store", keepalive,
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000),
      })
    } catch { throw new Error("The call connection was interrupted. Please try again or continue in chat.") }
    const json = await response.json()
    if (!response.ok || json.success === false) throw new Error(json.error || "The call connection is unavailable. Please try again or message us here.")
    return json as T
  }

  private async status(status: string, keepalive = false) {
    await this.request("", { status }, "PATCH", keepalive)
  }

  private setDeadline(milliseconds: number, status: "missed" | "failed", message: string) {
    clearTimeout(this.deadline)
    this.deadline = setTimeout(() => void this.fail(message, status), milliseconds)
  }

  private async acquire() {
    const stream = this.options.localStream || await requestCallMicrophone()
    if (this.disposed || this.finished) { stream.getTracks().forEach((track) => track.stop()); return false }
    this.stream = stream
    return true
  }

  private createPeer(iceServers?: RTCIceServer[]) {
    this.pc = new RTCPeerConnection({ iceServers: iceServers || [{ urls: "stun:stun.l.google.com:19302" }] })
    const pc = this.pc
    this.audio = this.options.remoteAudioEl || new Audio()
    this.audio.autoplay = true
    this.audio.setAttribute("playsinline", "")
    pc.ontrack = (event) => {
      if (!this.audio || this.finished) return
      this.audio.srcObject = event.streams[0] || new MediaStream([event.track])
      void this.resumeAudio()
    }
    pc.onicecandidate = (event) => {
      if (!event.candidate || this.finished) return
      void this.request("/signaling", {
        sdp_type: "ice", candidate: event.candidate.candidate,
        sdp_mid: event.candidate.sdpMid, sdp_mline_index: event.candidate.sdpMLineIndex,
      }).catch((error) => { if (!this.finished) void this.fail(error.message) })
    }
    pc.onconnectionstatechange = () => {
      if (this.finished) return
      if (pc.connectionState === "connected") {
        clearTimeout(this.deadline)
        clearTimeout(this.disconnectTimer)
        if (this.snapshot.state !== "active") {
          this.change({ state: "active" })
          if (this.options.isAgent) void this.status("active").catch((error) => void this.fail(error.message))
        }
      } else if (pc.connectionState === "failed") {
        void this.fail("The audio connection could not be established. Please try another network or message us here.")
      } else if (pc.connectionState === "disconnected") {
        clearTimeout(this.disconnectTimer)
        this.disconnectTimer = setTimeout(() => void this.fail("The call disconnected. Please call again or continue in chat."), 10_000)
      }
    }
    this.stream?.getTracks().forEach((track) => pc.addTrack(track, this.stream!))
    return pc
  }

  async start() {
    if (this.started || this.disposed) return
    this.started = true
    if (this.options.isAgent) {
      this.change({ state: "ringing" })
      this.setDeadline(60_000, "missed", "This call was not answered in time.")
      void this.poll()
      return
    }
    this.change({ state: "connecting", error: null })
    this.setDeadline(60_000, "missed", "Our team couldn’t answer this time. Please leave a message here and we’ll help you.")
    try {
      if (!await this.acquire()) return
      const initial = await this.request<SignalResponse>("/signaling")
      if (this.finished || this.disposed || this.remoteEnded(initial.call.status)) return
      const pc = this.createPeer(initial.ice_servers)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await this.request("/signaling", { sdp_type: "offer", sdp: offer.sdp })
      if (this.finished || this.disposed) return
      this.change({ state: "ringing" })
      void this.poll()
    } catch (error) { if (!this.finished) await this.fail(this.message(error)) }
  }

  async answer() {
    if (this.finished || this.disposed || this.pc || this.snapshot.state !== "ringing") return
    this.change({ state: "connecting", error: null })
    this.setDeadline(30_000, "failed", "The call could not connect. Please try again.")
    try {
      if (!await this.acquire()) return
      await this.request("", { action: "accept" }, "PATCH")
      const initial = await this.request<SignalResponse>("/signaling")
      if (this.finished || this.disposed || this.remoteEnded(initial.call.status)) return
      this.createPeer(initial.ice_servers)
      await this.signals(initial.data)
      // If the visitor's offer has not arrived yet, polling will apply it.
    } catch (error) { if (!this.finished) await this.fail(this.message(error)) }
  }

  private async signals(messages: Signal[]) {
    const pc = this.pc
    if (!pc || this.finished || this.processingSignals) return
    this.processingSignals = true
    try {
      // SDP must be applied before any remote ICE, regardless of event order.
      for (const message of messages.filter((item) => item.event_type !== "webrtc_ice_candidate")) {
        if (this.seen.has(message.id) || !message.metadata.sdp) continue
        if (this.options.isAgent && message.event_type === "webrtc_offer" && !pc.remoteDescription) {
          await pc.setRemoteDescription({ type: "offer", sdp: message.metadata.sdp })
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await this.request("/signaling", { sdp_type: "answer", sdp: answer.sdp })
        } else if (!this.options.isAgent && message.event_type === "webrtc_answer" && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription({ type: "answer", sdp: message.metadata.sdp })
          if (this.snapshot.state !== "active") {
            this.change({ state: "connecting" })
            this.setDeadline(30_000, "failed", "The audio connection could not be established. Please try another network or continue in chat.")
          }
        }
        this.seen.add(message.id)
      }
      if (!pc.remoteDescription) return
      for (const message of messages.filter((item) => item.event_type === "webrtc_ice_candidate")) {
        if (this.seen.has(message.id) || !message.metadata.candidate) continue
        const metadata = message.metadata
        await pc.addIceCandidate({ candidate: metadata.candidate,
          sdpMid: metadata.sdp_mid ?? metadata.candidate_sdp_mid ?? null,
          sdpMLineIndex: metadata.sdp_mline_index ?? metadata.candidate_sdp_mline_index ?? null })
        this.seen.add(message.id)
      }
    } finally { this.processingSignals = false }
  }

  private remoteEnded(status: string) {
    if (["ended", "failed", "missed", "busy"].includes(status)) {
      this.finished = true
      this.release()
      this.change(status === "ended" ? { state: "ended" } : { state: "error", error: status === "busy" ? "Our team couldn’t take this call. Please leave a message here." : "The call could not connect. Please try again or message us here." })
      return true
    }
    return false
  }

  private async poll() {
    if (this.finished || this.disposed) return
    try {
      const response = await this.request<SignalResponse>("/signaling")
      if (this.finished || this.disposed || this.remoteEnded(response.call.status)) return
      await this.signals(response.data)
      this.failures = 0
    } catch (error) {
      if (++this.failures >= 3) { await this.fail(this.message(error)); return }
    }
    if (!this.finished && !this.disposed) this.pollTimer = setTimeout(() => void this.poll(), 1000)
  }

  async resumeAudio() {
    if (!this.audio?.srcObject) return
    try { await this.audio.play(); this.change({ audioBlocked: false }) }
    catch { this.change({ audioBlocked: true }) }
  }

  toggleMute() {
    const muted = !this.snapshot.isMuted
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = !muted })
    this.change({ isMuted: muted })
  }

  async end(decline = false) {
    if (!this.finished) {
      this.finished = true
      this.release()
      this.change({ state: "ended" })
      try { await this.status(decline ? "busy" : "ended", true) }
      catch { this.change({ state: "error", error: "The call closed on this device, but we couldn’t update its status. Please refresh the page." }) }
    }
  }

  private async fail(message: string, status = "failed") {
    if (this.finished || this.disposed) return
    this.finished = true
    this.release()
    this.change({ state: "error", error: message })
    try { await this.status(status, true) } catch { /* Local resources are already stopped. */ }
  }

  private message(error: unknown) {
    return error instanceof Error ? error.message : "The call could not connect. Please try again or message us here."
  }

  private release() {
    clearTimeout(this.pollTimer)
    clearTimeout(this.deadline)
    clearTimeout(this.disconnectTimer)
    if (this.pc) {
      this.pc.onconnectionstatechange = null
      this.pc.onicecandidate = null
      this.pc.ontrack = null
      this.pc.close()
      this.pc = null
    }
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    if (this.audio) { this.audio.pause(); this.audio.srcObject = null; this.audio = null }
  }

  dispose() {
    if (this.disposed) return
    if (this.started && !this.finished) void this.status("ended", true).catch(() => {})
    this.disposed = true
    this.finished = true
    this.release()
  }
}
