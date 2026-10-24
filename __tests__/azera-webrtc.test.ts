import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BrowserCall, microphoneError, requestCallMicrophone } from "@/lib/azera-webrtc"

class Peer {
  static instances: Peer[] = []
  signalingState = "stable"
  connectionState = "new"
  remoteDescription: object | null = null
  onconnectionstatechange: (() => void) | null = null
  onicecandidate: ((event: object) => void) | null = null
  ontrack: ((event: object) => void) | null = null
  addTrack = vi.fn()
  addIceCandidate = vi.fn(async () => {})
  close = vi.fn()
  constructor() { Peer.instances.push(this) }
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "caller-offer" }))
  createAnswer = vi.fn(async () => ({ type: "answer", sdp: "agent-answer" }))
  setLocalDescription = vi.fn(async (description) => { this.signalingState = description.type === "offer" ? "have-local-offer" : "stable" })
  setRemoteDescription = vi.fn(async (description) => { this.remoteDescription = description; this.signalingState = description.type === "offer" ? "have-remote-offer" : "stable" })
}
class AudioPlayer {
  static instances: AudioPlayer[] = []
  srcObject: unknown = null
  autoplay = false
  setAttribute = vi.fn()
  play = vi.fn(async () => {})
  pause = vi.fn()
  constructor() { AudioPlayer.instances.push(this) }
}
const stop = vi.fn()
const track = { enabled: true, stop }
const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream
let getUserMedia: ReturnType<typeof vi.fn>
let events: { id: string; event_type: string; actor_type: string; metadata: object }[]
let status: string
let writes: object[]
let sessions: BrowserCall[]
const success = (data: object) => Response.json({ success: true, ...data })
function session(isAgent = false) {
  const current = new BrowserCall({ callId: "call-1", isAgent, authToken: isAgent ? null : "visitor-token", onChange: vi.fn() })
  sessions.push(current)
  return current
}

beforeEach(() => {
  vi.useFakeTimers()
  Peer.instances = []; AudioPlayer.instances = []; events = []; status = "ringing"; writes = []; sessions = []
  stop.mockClear(); track.enabled = true
  getUserMedia = vi.fn(async () => stream)
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
  vi.stubGlobal("RTCPeerConnection", Peer)
  vi.stubGlobal("Audio", AudioPlayer)
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    const actor = (options.headers as Record<string, string>)["X-Azera-Chat-Token"] ? "customer" : "agent"
    if (options.method === "GET") return success({ data: events.filter((event) => event.actor_type !== actor), call: { status }, ice_servers: [] })
    const body = JSON.parse(options.body as string)
    if (url.endsWith("/signaling")) {
      events.push({ id: String(events.length), event_type: body.sdp_type === "ice" ? "webrtc_ice_candidate" : `webrtc_${body.sdp_type}`, actor_type: actor, metadata: body })
    } else { writes.push(body); if (body.status) status = body.status }
    return success({})
  }))
})
afterEach(() => { sessions.forEach((current) => current.dispose()); vi.useRealTimers(); vi.unstubAllGlobals() })

describe("Azera browser calls", () => {
  it("shows incoming controls immediately and only asks for the agent microphone on Answer", async () => {
    const agent = session(true)
    await agent.start()
    expect(agent.snapshot.state).toBe("ringing")
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it("negotiates both sides, queues ICE until SDP, deduplicates it, and only becomes active on a real connection", async () => {
    const caller = session()
    await caller.start()
    expect(caller.snapshot.state).toBe("ringing")
    events.push({ id: "early-ice", event_type: "webrtc_ice_candidate", actor_type: "customer", metadata: { candidate: "remote-ice", sdp_mid: "audio", sdp_mline_index: 0 } })
    const agent = session(true)
    await agent.start()
    await agent.answer()
    const [callerPeer, agentPeer] = Peer.instances
    expect(writes).toContainEqual({ action: "accept" })
    expect(agentPeer.setRemoteDescription).toHaveBeenCalledWith({ type: "offer", sdp: "caller-offer" })
    expect(agentPeer.addIceCandidate).toHaveBeenCalledWith({ candidate: "remote-ice", sdpMid: "audio", sdpMLineIndex: 0 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(callerPeer.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "agent-answer" })
    expect(caller.snapshot.state).toBe("connecting")
    expect(agentPeer.addIceCandidate).toHaveBeenCalledTimes(1)
    callerPeer.connectionState = agentPeer.connectionState = "connected"
    callerPeer.onconnectionstatechange?.(); agentPeer.onconnectionstatechange?.()
    await Promise.resolve()
    expect(caller.snapshot.state).toBe("active")
    expect(agent.snapshot.state).toBe("active")
    expect(writes).toContainEqual({ status: "active" })
  })

  it("plays remote audio, offers a tap-to-listen fallback, and cleans up tracks", async () => {
    const caller = session()
    await caller.start()
    const audio = AudioPlayer.instances[0]
    audio.play.mockRejectedValueOnce(new Error("autoplay blocked"))
    Peer.instances[0].ontrack?.({ streams: [stream], track })
    await Promise.resolve(); await Promise.resolve()
    expect(audio.srcObject).toBe(stream)
    expect(caller.snapshot.audioBlocked).toBe(true)
    await caller.resumeAudio()
    expect(caller.snapshot.audioBlocked).toBe(false)
    caller.toggleMute(); expect(track.enabled).toBe(false)
    await caller.end()
    expect(stop).toHaveBeenCalled()
    expect(audio.pause).toHaveBeenCalled()
    expect(audio.srcObject).toBeNull()
    expect(writes).toContainEqual({ status: "ended" })
  })

  it("reports microphone denial accurately and persists failure rather than pretending to ring", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"))
    const caller = session()
    await caller.start()
    expect(caller.snapshot.state).toBe("error")
    expect(caller.snapshot.error).toContain("allow microphone access")
    expect(events).toHaveLength(0)
    expect(writes).toContainEqual({ status: "failed" })
  })

  it("checks HTTP signaling errors rather than silently accepting a 401", async () => {
    const original = globalThis.fetch
    vi.stubGlobal("fetch", vi.fn(async (url, options) => options?.method === "POST"
      ? Response.json({ success: false, error: "Please refresh the page before starting another call." }, { status: 401 })
      : original(url, options)))
    const caller = session()
    await caller.start()
    expect(caller.snapshot.state).toBe("error")
    expect(caller.snapshot.error).toContain("refresh")
    expect(writes).toContainEqual({ status: "failed" })
  })

  it("ends unanswered calls after a minute and stops polling", async () => {
    const caller = session()
    await caller.start()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(caller.snapshot.state).toBe("error")
    expect(writes).toContainEqual({ status: "missed" })
    const count = vi.mocked(fetch).mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(vi.mocked(fetch).mock.calls.length).toBe(count)
  })

  it("propagates a remote hangup and releases local resources", async () => {
    const caller = session()
    await caller.start()
    status = "ended"
    await vi.advanceTimersByTimeAsync(1000)
    expect(caller.snapshot.state).toBe("ended")
    expect(Peer.instances[0].close).toHaveBeenCalled()
    expect(stop).toHaveBeenCalled()
  })

  it("recovers a brief network interruption without failing a reconnected call", async () => {
    const caller = session()
    await caller.start()
    const peer = Peer.instances[0]
    peer.connectionState = "connected"; peer.onconnectionstatechange?.()
    peer.connectionState = "disconnected"; peer.onconnectionstatechange?.()
    await vi.advanceTimersByTimeAsync(3000)
    peer.connectionState = "connected"; peer.onconnectionstatechange?.()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(caller.snapshot.state).toBe("active")
    expect(writes).not.toContainEqual({ status: "failed" })
  })

  it("can answer when the visitor offer arrives after staff click Answer", async () => {
    const agent = session(true)
    await agent.start()
    await agent.answer()
    expect(Peer.instances[0].setRemoteDescription).not.toHaveBeenCalled()
    events.push({ id: "late-offer", actor_type: "customer", event_type: "webrtc_offer", metadata: { sdp: "late-offer" } })
    await vi.advanceTimersByTimeAsync(1000)
    expect(Peer.instances[0].setRemoteDescription).toHaveBeenCalledWith({ type: "offer", sdp: "late-offer" })
    expect(events.some((event) => event.event_type === "webrtc_answer")).toBe(true)
  })

  it("stops a microphone granted after cancellation and creates no peer", async () => {
    let grant!: (value: MediaStream) => void
    getUserMedia.mockReturnValue(new Promise((resolve) => { grant = resolve }))
    const caller = session()
    const starting = caller.start()
    caller.dispose()
    grant(stream)
    await starting
    expect(Peer.instances).toHaveLength(0)
    expect(stop).toHaveBeenCalled()
  })

  it("does not start twice or start a disposed Strict Mode probe", async () => {
    const probe = session(); probe.dispose(); await probe.start()
    const caller = session(); await Promise.all([caller.start(), caller.start()])
    expect(Peer.instances).toHaveLength(1)
    expect(events.filter((event) => event.event_type === "webrtc_offer")).toHaveLength(1)
  })

  it("fails cleanly without a browser media API and distinguishes missing/busy microphones", async () => {
    vi.stubGlobal("navigator", {})
    await expect(requestCallMicrophone()).rejects.toThrow("supported browser")
    expect(microphoneError({ name: "NotFoundError" })).toContain("No microphone")
    expect(microphoneError({ name: "NotReadableError" })).toContain("busy")
  })
})
