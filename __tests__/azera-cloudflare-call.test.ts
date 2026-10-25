import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudflareCall, WebsiteCall } from "@/lib/azera-cloudflare-call";
const sdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\na=candidate:test\r\n";
class Peer {
  static instances: Peer[] = [];
  connectionState = "new"; iceGatheringState = "complete"; localDescription: { type: string; sdp: string; toJSON: () => object } | null = null;
  onconnectionstatechange: (() => void) | null = null; ontrack: ((event: unknown) => void) | null = null;
  close = vi.fn(); addTransceiver = vi.fn(() => ({ mid: "0" })); addEventListener = vi.fn(); removeEventListener = vi.fn();
  constructor() { Peer.instances.push(this); }
  createOffer = vi.fn(async () => ({ type: "offer", sdp })); createAnswer = vi.fn(async () => ({ type: "answer", sdp }));
  setLocalDescription = vi.fn(async (value) => { this.localDescription = { ...value, toJSON: () => value }; });
  setRemoteDescription = vi.fn(async () => {});
}
class Player {
  autoplay = false; srcObject: unknown; play = vi.fn(async () => {}); pause = vi.fn(); setAttribute = vi.fn();
}
const stop = vi.fn(); const track = { enabled: true, stop };
const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
let sessions: CloudflareCall[]; let ready: boolean; let ended: boolean; let rejectEnd: boolean; let actions: string[];
const current = (agent = false) => { const value = new CloudflareCall({ callId: "call_1", isAgent: agent, authToken: "visitor_token", onChange: vi.fn() }); sessions.push(value); return value; };
beforeEach(() => {
  vi.useFakeTimers(); Peer.instances = []; sessions = []; ready = false; ended = false; rejectEnd = false; actions = []; stop.mockClear(); track.enabled = true;
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => stream) } }); vi.stubGlobal("RTCPeerConnection", Peer); vi.stubGlobal("Audio", Player); vi.stubGlobal("MediaStream", class {});
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    if (options.method === "GET") return Response.json({ success: true, transport: "cloudflare", ready, status: ended ? "ended" : "ringing" });
    const { action } = JSON.parse(options.body); actions.push(action);
    if (action === "config") return Response.json({ success: true, iceServers: [], maxSeconds: 1800 });
    if (action === "publish") return Response.json({ success: true, sessionDescription: { type: "answer", sdp } });
    if (action === "subscribe") return Response.json({ success: true, sessionDescription: { type: "offer", sdp } });
    if (action === "end" && rejectEnd) return Response.json({ success: false }, { status: 503 });
    return Response.json({ success: true });
  }));
});
afterEach(() => { sessions.forEach((session) => session.dispose()); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("Managed Cloudflare browser audio", () => {
  it("does not request the staff microphone until Answer and claims before publishing", async () => {
    const agent = current(true); await agent.start();
    expect(agent.snapshot.state).toBe("ringing"); expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    await agent.answer();
    expect(actions.indexOf("accept")).toBeLessThan(actions.indexOf("publish"));
  });
  it("waits for both connected peers and completed provider negotiation before showing active", async () => {
    const caller = current(); await caller.start();
    expect(caller.snapshot.state).toBe("connecting"); expect(actions).not.toContain("connected");
    const publisher = Peer.instances[0]; publisher.connectionState = "connected"; publisher.onconnectionstatechange?.(); await flush();
    ready = true; await vi.advanceTimersByTimeAsync(1500);
    expect(actions).toContain("subscribe"); expect(actions).toContain("answer"); expect(caller.snapshot.state).not.toBe("active");
    const receiver = Peer.instances[1]; receiver.connectionState = "connected"; receiver.onconnectionstatechange?.(); await flush();
    expect(actions).toContain("connected"); expect(caller.snapshot.state).toBe("active");
    caller.toggleMute(); expect(track.enabled).toBe(false);
    await caller.end(); expect(stop).toHaveBeenCalled(); expect(publisher.close).toHaveBeenCalled(); expect(receiver.close).toHaveBeenCalled();
  });
  it("stops audio immediately but keeps failed provider shutdown visible and retryable", async () => {
    const caller = current(); await caller.start(); rejectEnd = true;
    await caller.end(); expect(stop).toHaveBeenCalled(); expect(caller.snapshot.state).toBe("error"); expect(caller.snapshot.error).toContain("shutdown");
    rejectEnd = false; await caller.end(); expect(caller.snapshot.state).toBe("ended");
  });
  it("observes remote hangup without creating a replacement session", async () => {
    const caller = current(); await caller.start(); ended = true; await vi.advanceTimersByTimeAsync(1500);
    expect(caller.snapshot.state).toBe("ended"); expect(stop).toHaveBeenCalled(); expect(actions.filter((action) => action === "publish")).toHaveLength(1);
  });
  it("ends unanswered calls and cancels all polling", async () => {
    const caller = current(); await caller.start(); await vi.advanceTimersByTimeAsync(60_000);
    expect(caller.snapshot.state).toBe("error"); expect(actions).toContain("end");
    const calls = vi.mocked(fetch).mock.calls.length; await vi.advanceTimersByTimeAsync(5000); expect(vi.mocked(fetch).mock.calls.length).toBe(calls);
  });
  it("does not start a disposed React Strict Mode probe", async () => {
    const wrapper = new WebsiteCall({ callId: "call_1", isAgent: false, localStream: stream, onChange: vi.fn() });
    wrapper.dispose(); await wrapper.start(); expect(fetch).not.toHaveBeenCalled(); expect(stop).not.toHaveBeenCalled();
  });
});
