import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AzeraRealtimeCall } from "@/lib/azera-realtime-call";
const track = { enabled: true, stop: vi.fn() };
const stream = {
  getTracks: () => [track],
  getAudioTracks: () => [track],
} as unknown as MediaStream;
const peers: Peer[] = [];
class Peer {
  localDescription = { sdp: "v=0\r\noffer" };
  connectionState = "new";
  onconnectionstatechange: (() => void) | null = null;
  ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
  dc = {
    onopen: null as (() => void) | null,
    onmessage: null as ((event: { data: string }) => void) | null,
    send: vi.fn(),
    close: vi.fn(),
  };
  addTrack = vi.fn();
  createDataChannel = vi.fn(() => this.dc);
  createOffer = vi.fn(async () => this.localDescription);
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = vi.fn(async () => {});
  close = vi.fn();
  constructor() {
    peers.push(this);
  }
}
let calls: AzeraRealtimeCall[];
const handoff = vi.fn();
const make = () => {
  const call = new AzeraRealtimeCall(stream, "visitor-token", vi.fn(), handoff);
  calls.push(call);
  return call;
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  calls = [];
  track.enabled = true;
  vi.stubGlobal("RTCPeerConnection", Peer);
  vi.stubGlobal("document", {
    createElement: () => ({
      autoplay: false,
      setAttribute: vi.fn(),
      play: vi.fn(async () => {}),
      pause: vi.fn(),
      remove: vi.fn(),
      srcObject: null,
    }),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options: RequestInit) =>
      Response.json(
        options.method === "POST"
          ? { id: "call-1", answer: "v=0\r\nanswer", maxSeconds: 600 }
          : { ended: true },
      ),
    ),
  );
});
afterEach(() => {
  calls.forEach((call) => call.dispose());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("Direct browser AI audio lifecycle", () => {
  it("uses the local microphone and secured SDP endpoint without provider keys or LiveKit", async () => {
    const call = make();
    await call.start();
    expect(peers.at(-1)!.addTrack).toHaveBeenCalledWith(track, stream);
    expect(fetch).toHaveBeenCalledWith(
      "/api/azera/voice/realtime",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Azera-Chat-Token": "visitor-token",
        }),
      }),
    );
    expect(peers.at(-1)!.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "v=0\r\nanswer",
    });
    expect(call.snapshot.state).toBe("connecting");
    peers.at(-1)!.connectionState = "connected";
    peers.at(-1)!.onconnectionstatechange?.();
    expect(call.snapshot.state).toBe("active");
  });
  it("does not make two paid sessions for duplicate start or a Strict Mode probe", async () => {
    const probe = make();
    probe.dispose();
    await probe.start();
    const call = make();
    await Promise.all([call.start(), call.start()]);
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([, options]) => options?.method === "POST"),
    ).toHaveLength(1);
  });
  it("mutes locally and closes both microphone and provider after ten minutes", async () => {
    const call = make();
    await call.start();
    peers.at(-1)!.connectionState = "connected";
    peers.at(-1)!.onconnectionstatechange?.();
    call.toggleMute();
    expect(track.enabled).toBe(false);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(track.stop).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "/api/azera/voice/realtime?id=call-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(call.snapshot.state).toBe("ended");
  });
  it("ends the AI session before requesting a human, and suppresses duplicate tool events", async () => {
    const call = make();
    await call.start();
    const listener = peers.at(-1)!.dc.onmessage!;
    listener({
      data: JSON.stringify({
        type: "response.function_call_arguments.done",
        name: "request_human",
      }),
    });
    listener({
      data: JSON.stringify({
        type: "response.function_call_arguments.done",
        name: "request_human",
      }),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(handoff).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalled();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([, options]) => options?.method === "DELETE"),
    ).toHaveLength(1);
  });
  it("keeps shutdown failures visible and does not claim a human handoff", async () => {
    const call = make();
    await call.start();
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json({ error: "Shutdown unconfirmed" }, { status: 503 }),
    );
    peers.at(-1)!.dc.onmessage?.({
      data: JSON.stringify({
        type: "response.function_call_arguments.done",
        name: "request_human",
      }),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(handoff).not.toHaveBeenCalled();
    expect(call.snapshot).toMatchObject({
      state: "error",
      error: expect.stringContaining("shutdown could not be confirmed"),
    });
  });
});
