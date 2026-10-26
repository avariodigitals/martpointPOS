import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ events: new Map<string, (...args: unknown[]) => void>(), answer: vi.fn(), hangup: vi.fn(), destroy: vi.fn(), mute: vi.fn(), unmute: vi.fn(), hold: vi.fn(), unhold: vi.fn(), dtmf: vi.fn() }));
vi.mock("africastalking-client", () => ({ default: { Client: class {
  on(event: string, callback: (...args: unknown[]) => void) { sdk.events.set(event, callback); }
  answer = sdk.answer; hangup = sdk.hangup; destroy = sdk.destroy; mute = sdk.mute; unmute = sdk.unmute; hold = sdk.hold; unhold = sdk.unhold; dtmf = sdk.dtmf;
} } }));
import { AfricaIncomingPhone } from "@/lib/africa-incoming-phone";
let phone: AfricaIncomingPhone;
const stop = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); sdk.events.clear();
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) } });
  vi.stubGlobal("RTCPeerConnection", class {}); vi.stubGlobal("document", { getElementById: () => null });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    const action = init?.body ? JSON.parse(String(init.body)).action : "";
    return Response.json(action === "register" ? { token: "temporary-token" } : init?.method === "GET" || !init?.method ? { call: { id: "call-1", status: "ringing", customer_phone: "+2348000000001" } } : { ok: true });
  }));
  phone = new AfricaIncomingPhone(vi.fn());
});
afterEach(async () => { await phone.stop(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const flush = async () => { await vi.advanceTimersByTimeAsync(1); };
describe("Persistent receiving browser phone", () => {
  it("advertises readiness only after SDK registration and does not dial anyone", async () => {
    await phone.start(["sales"]);
    expect(phone.snapshot.state).toBe("connecting");
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => String(init?.body).includes('"action":"ready"'))).toBe(false);
    sdk.events.get("ready")?.(); await flush();
    expect(phone.snapshot.state).toBe("ready"); expect(stop).toHaveBeenCalledOnce();
  });
  it("loads the assigned caller, answers explicitly and saves active only after provider acceptance", async () => {
    await phone.start(["support"]); sdk.events.get("ready")?.(); await flush();
    sdk.events.get("incomingcall")?.({ from: "+2348000000001" }); await flush();
    expect(phone.snapshot.state).toBe("ringing"); expect(sdk.answer).not.toHaveBeenCalled();
    await phone.answer(); expect(sdk.answer).toHaveBeenCalledOnce(); expect(phone.snapshot.state).toBe("ringing");
    sdk.events.get("callaccepted")?.(); await flush();
    expect(phone.snapshot.state).toBe("active");
    phone.mute(); phone.hold(); phone.dtmf("1"); phone.dtmf("bad");
    expect(sdk.mute).toHaveBeenCalledOnce(); expect(sdk.hold).toHaveBeenCalledOnce(); expect(sdk.dtmf).toHaveBeenCalledOnce();
  });
  it("saves a declined call as missed and leaves the receiving phone ready", async () => {
    await phone.start(["onboarding"]); sdk.events.get("ready")?.(); await flush();
    sdk.events.get("incomingcall")?.(); await flush(); await phone.end();
    expect(sdk.hangup).toHaveBeenCalledOnce(); expect(phone.snapshot.state).toBe("ready");
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => String(init?.body).includes('"status":"missed"'))).toBe(true);
    expect(sdk.destroy).not.toHaveBeenCalled();
  });
  it("removes availability on provider disconnect", async () => {
    await phone.start(["sales"]); sdk.events.get("closed")?.(); await flush();
    expect(phone.snapshot.state).toBe("error"); expect(sdk.destroy).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => String(init?.body).includes('"action":"stop"'))).toBe(true);
  });
  it("does not request a token after microphone denial", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    await phone.start(["sales"]); expect(phone.snapshot.state).toBe("error");
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => String(init?.body).includes('"action":"register"'))).toBe(false);
  });
  it("does not leave an old ready callback alive after going offline", async () => {
    await phone.start(["sales"]); const ready = sdk.events.get("ready"); await phone.stop(); ready?.(); await flush();
    expect(phone.snapshot.state).toBe("off");
  });
});
