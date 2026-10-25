import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const sdk = vi.hoisted(() => ({ events: new Map<string, (...args: unknown[]) => void>(), call: vi.fn(), hangup: vi.fn(), mute: vi.fn(), unmute: vi.fn(), hold: vi.fn(), unhold: vi.fn(), dtmf: vi.fn(), destroy: vi.fn(), tokens: [] as string[] }))
vi.mock("africastalking-client", () => ({ default: { Client: class {
  constructor(token: string) { sdk.tokens.push(token) }
  on(event: string, callback: (...args: unknown[]) => void) { sdk.events.set(event, callback) }
  call = sdk.call; hangup = sdk.hangup; mute = sdk.mute; unmute = sdk.unmute; hold = sdk.hold; unhold = sdk.unhold; dtmf = sdk.dtmf; destroy = sdk.destroy
} } }))
import { AfricaBrowserCall } from "@/lib/africa-browser-call"
const stop = vi.fn(), stream = { getTracks: () => [{ stop }] }
let engines: AfricaBrowserCall[]
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); sdk.events.clear(); sdk.tokens.length = 0; engines = []
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => stream) } }); vi.stubGlobal("RTCPeerConnection", class {})
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/azera/calls/africa-browser" ? Response.json({ id: "call-1", token: "test-capability", phone: "+2348000000001" }) : Response.json({ status: "ended" })))
})
afterEach(() => { engines.forEach(engine => engine.dispose()); vi.unstubAllGlobals(); vi.useRealTimers() })
function engine() { const value = new AfricaBrowserCall("conversation-1", vi.fn()); engines.push(value); return value }
describe("Africa’s Talking browser calling", () => {
  it("uses a capability token, releases the permission probe and dials only once after SDK readiness", async () => {
    const value = engine(); await value.start()
    expect(stop).toHaveBeenCalledOnce(); expect(sdk.call).not.toHaveBeenCalled()
    sdk.events.get("ready")?.(); sdk.events.get("ready")?.()
    expect(sdk.call).toHaveBeenCalledOnce(); expect(sdk.call).toHaveBeenCalledWith("+2348000000001")
    expect(sdk.tokens).toEqual(["test-capability"])
    expect(value.snapshot.state).toBe("ringing")
  })
  it("reports connection only when the provider accepts, and applies real SDK mute/hold/keypad controls", async () => {
    const value = engine(); await value.start(); sdk.events.get("ready")?.(); sdk.events.get("callaccepted")?.()
    expect(value.snapshot.state).toBe("active")
    await value.toggleMute(); expect(sdk.mute).toHaveBeenCalledOnce()
    await value.toggleMute(); expect(sdk.unmute).toHaveBeenCalledOnce()
    await value.toggleHold(); expect(sdk.hold).toHaveBeenCalledOnce(); expect(value.snapshot.held).toBe(true)
    await value.toggleHold(); expect(sdk.unhold).toHaveBeenCalledOnce()
    value.dtmf("1"); value.dtmf(";dial=999"); expect(sdk.dtmf).toHaveBeenCalledOnce(); expect(sdk.dtmf).toHaveBeenCalledWith("1")
  })
  it("does not request a token or place a call after microphone denial", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException("Denied", "NotAllowedError"))
    const value = engine(); await value.start()
    expect(fetch).not.toHaveBeenCalled(); expect(sdk.call).not.toHaveBeenCalled(); expect(value.snapshot.error).toContain("allow microphone")
  })
  it("shows a setup error instead of launching FaceTime or a device dialler", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Configure Africa’s Talking" }, { status: 503 })))
    const value = engine(); await value.start()
    expect(value.snapshot).toMatchObject({ state: "error", setupRequired: true })
    expect(sdk.call).not.toHaveBeenCalled()
  })
  it("never starts from a disposed Strict Mode probe or duplicates a start", async () => {
    const probe = engine(); probe.dispose(); await probe.start()
    expect(fetch).not.toHaveBeenCalled()
    const value = engine(); await Promise.all([value.start(), value.start()]); sdk.events.get("ready")?.()
    expect(sdk.call).toHaveBeenCalledOnce()
  })
  it("hangs up and destroys the browser session when a call times out", async () => {
    const value = engine(); await value.start(); sdk.events.get("ready")?.(); await vi.advanceTimersByTimeAsync(75_000)
    expect(sdk.hangup).toHaveBeenCalledOnce(); expect(sdk.destroy).toHaveBeenCalledOnce(); expect(value.snapshot.state).toBe("error")
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => String(init?.body).includes('"missed"'))).toBe(true)
  })
  it("cleans up when the remote party hangs up and saves the end state", async () => {
    const value = engine(); await value.start(); sdk.events.get("callaccepted")?.(); sdk.events.get("hangup")?.()
    expect(sdk.destroy).toHaveBeenCalledOnce(); expect(value.snapshot.state).toBe("ended")
  })
  it("keeps the staff session alive only while a call is active", async () => {
    const value = engine(); await value.start(); sdk.events.get("callaccepted")?.()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(vi.mocked(fetch).mock.calls.some(([url]) => url === "/api/admin/session")).toBe(true)
    await value.end(); const count = vi.mocked(fetch).mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000); expect(vi.mocked(fetch).mock.calls.length).toBe(count)
  })
})
