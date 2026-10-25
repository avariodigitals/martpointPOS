import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ order: [] as string[], instances: [] as { disconnect: ReturnType<typeof vi.fn> }[] }))
vi.mock("livekit-client", () => ({
  Track: { Kind: { Audio: "audio" }, Source: { Microphone: "microphone" } },
  RoomEvent: { TrackSubscribed: "track", AudioPlaybackStatusChanged: "playback", Disconnected: "disconnected" },
  Room: class {
    events = new Map<string, (...args: unknown[]) => void>()
    canPlaybackAudio = true
    localParticipant = { publishTrack: vi.fn(async () => { mock.order.push("publish") }) }
    connect = vi.fn(async () => { mock.order.push("connect") })
    disconnect = vi.fn(async () => {})
    startAudio = vi.fn(async () => {})
    on(event: string, callback: (...args: unknown[]) => void) { this.events.set(event, callback); return this }
    removeAllListeners() { this.events.clear() }
    constructor() { mock.instances.push(this) }
  },
}))
import { BrowserPhoneCall } from "@/lib/azera-phone-call"
const track = { enabled: true, stop: vi.fn() }
const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream
let sessions: BrowserPhoneCall[]
let configured: boolean
let status: string
let getUserMedia: ReturnType<typeof vi.fn>
function session() { const call = new BrowserPhoneCall("conversation-1", vi.fn()); sessions.push(call); return call }
beforeEach(() => {
  vi.useFakeTimers(); mock.order.length = 0; mock.instances.length = 0; sessions = []; configured = true; status = "ringing"; track.enabled = true; track.stop.mockClear()
  getUserMedia = vi.fn(async () => { mock.order.push("microphone"); return stream })
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } }); vi.stubGlobal("RTCPeerConnection", class {})
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    if (url === "/api/azera/calls/outbound" && options.method === "GET") return Response.json({ ready: configured })
    if (url === "/api/azera/calls/outbound") { mock.order.push("prepare"); return Response.json({ id: "call-1", token: "test-token", url: "wss://example.test", room: "room" }) }
    if (options.method === "POST") { mock.order.push("dial"); return Response.json({ status }) }
    if (options.method === "DELETE") { mock.order.push("end"); return Response.json({ status: "ended" }) }
    return Response.json({ status })
  }))
})
afterEach(() => { sessions.forEach((call) => call.dispose()); vi.unstubAllGlobals(); vi.useRealTimers() })

describe("Browser-to-phone calls", () => {
  it("joins and publishes microphone before dialing, never launching tel links", async () => {
    const call = session(); await call.start()
    expect(mock.order).toEqual(["microphone", "prepare", "connect", "publish", "dial"])
    expect(call.snapshot.state).toBe("ringing")
    status = "active"; await vi.advanceTimersByTimeAsync(2000)
    expect(call.snapshot.state).toBe("active")
    await call.toggleMute(); expect(track.enabled).toBe(false)
    await call.end(); expect(mock.order.at(-1)).toBe("end"); expect(track.stop).toHaveBeenCalled()
  })
  it("does not ask for microphone or create a call when credentials are missing", async () => {
    configured = false; const call = session(); await call.start()
    expect(call.snapshot).toMatchObject({ state: "error", setupRequired: true })
    expect(getUserMedia).not.toHaveBeenCalled(); expect(mock.order).toEqual([])
  })
  it("does not dial when microphone permission is denied", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"))
    const call = session(); await call.start()
    expect(call.snapshot.error).toContain("allow microphone")
    expect(mock.order).not.toContain("prepare"); expect(mock.order).not.toContain("dial")
  })
  it("never dials twice during repeat start or a disposed Strict Mode probe", async () => {
    const probe = session(); probe.dispose(); await probe.start()
    const call = session(); await Promise.all([call.start(), call.start()])
    expect(mock.order.filter((step) => step === "dial")).toHaveLength(1)
  })
  it("cleans up audio when the customer hangs up", async () => {
    const call = session(); await call.start(); status = "ended"; await vi.advanceTimersByTimeAsync(2000)
    expect(call.snapshot.state).toBe("ended"); expect(track.stop).toHaveBeenCalled(); expect(mock.instances[0].disconnect).toHaveBeenCalled()
  })
  it("keeps the end-call control actionable if server termination fails", async () => {
    const call = session(); await call.start()
    const original = fetch
    vi.stubGlobal("fetch", vi.fn((url, options) => options?.method === "DELETE" ? Promise.resolve(Response.json({ error: "offline" }, { status: 502 })) : original(url, options)))
    expect(await call.end()).toBe(false)
    expect(call.snapshot.error).toContain("End call again")
    expect(track.stop).toHaveBeenCalled()
  })
})
