import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn(), rpc: vi.fn(), sfu: vi.fn(), ice: vi.fn(), end: vi.fn(), enabled: vi.fn(), queries: [] as Record<string, ReturnType<typeof vi.fn>>[], own: {} as Record<string, unknown>, other: {} as Record<string, unknown> }));
vi.mock("@/lib/azera-call-access", () => ({ getCallAccess: mocks.access }));
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("@/lib/azera-cloudflare-cleanup", () => ({ endCloudflareCall: mocks.end }));
vi.mock("@/lib/cloudflare-rtc", async (original) => ({ ...await original<object>(), sfuRequest: mocks.sfu, cloudflareIceServers: mocks.ice, cloudflareSfuEnabled: mocks.enabled }));
import { GET, POST } from "@/app/api/azera/calls/[id]/cloudflare/route";
const context = { params: Promise.resolve({ id: "call_1" }) };
const call = { id: "call_1", sip_provider: "cloudflare_sfu", agent_user_id: "agent_1", created_at: new Date().toISOString(), status: "ringing", answered_at: null };
const audio = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\n";
const request = (body: object) => new Request("https://example.test/api/azera/calls/call_1/cloudflare", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.queries.length = 0; mocks.own = {}; mocks.other = { publisher_session: "other_session", published: true };
  mocks.enabled.mockReturnValue(true); mocks.ice.mockResolvedValue([{ urls: "stun:test" }]); mocks.end.mockResolvedValue(undefined); mocks.rpc.mockResolvedValue({ data: true });
  mocks.access.mockResolvedValue({ call: { ...call }, actor: { type: "customer", id: null } });
  mocks.from.mockImplementation((table) => {
    const q: Record<string, ReturnType<typeof vi.fn>> = {}; let different = false;
    for (const name of ["select", "eq", "is", "update", "upsert"]) q[name] = vi.fn(() => q);
    q.neq = vi.fn(() => { different = true; return q; });
    q.maybeSingle = vi.fn(async () => ({ data: table === "azera_calls" ? { ...call, media_control_claim: null } : different ? mocks.other : mocks.own, error: null }));
    q.then = vi.fn((resolve) => Promise.resolve({ data: [], error: null }).then(resolve));
    mocks.queries.push(q); return q;
  });
});
afterEach(() => { vi.unstubAllEnvs(); });
describe("Call-scoped Cloudflare operations", () => {
  it("requires call authorization before any provider operation", async () => {
    mocks.access.mockResolvedValue(null);
    expect((await POST(request({ action: "config" }), context)).status).toBe(401);
    expect(mocks.sfu).not.toHaveBeenCalled(); expect(mocks.ice).not.toHaveBeenCalled();
  });
  it("allows identifying an unclaimed ringing call but not subscribing to its audio", async () => {
    mocks.access.mockResolvedValue({ call: { ...call, agent_user_id: null }, actor: { type: "agent", id: "agent_1" } });
    expect(await (await GET(new Request("https://example.test"), context)).json()).toMatchObject({ transport: "cloudflare", ready: false });
    expect((await POST(request({ action: "subscribe" }), context)).status).toBe(403);
    expect(mocks.sfu).not.toHaveBeenCalled();
  });
  it("uses the atomic queue/availability claim when staff answer", async () => {
    mocks.access.mockResolvedValue({ call: { ...call, agent_user_id: null }, actor: { type: "agent", id: "agent_1" } });
    expect((await POST(request({ action: "accept" }), context)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("azera_claim_browser_call", { p_call_id: "call_1", p_agent_id: "agent_1" });
  });
  it("does not allow a public visitor to answer as an agent", async () => {
    expect((await POST(request({ action: "accept" }), context)).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects video before allocating any session", async () => {
    expect((await POST(request({ action: "publish", mid: "0", sessionDescription: { type: "offer", sdp: audio + "m=video 9 RTP/SAVPF 96\r\n" } }), context)).status).toBe(400);
    expect(mocks.sfu).not.toHaveBeenCalled();
  });
  it("persists the publisher session before allocating audio and returns no session locator or secret", async () => {
    mocks.sfu.mockResolvedValueOnce({ sessionId: "publisher_1" }).mockResolvedValueOnce({ sessionDescription: { type: "answer", sdp: audio }, tracks: [{ mid: "0" }] });
    const response = await POST(request({ action: "publish", mid: "0", sessionDescription: { type: "offer", sdp: audio } }), context);
    expect(response.status).toBe(200);
    expect(mocks.queries.some((q) => q.update.mock.calls.some(([value]) => value.publisher_session === "publisher_1"))).toBe(true);
    expect(JSON.stringify(await response.json())).not.toContain("publisher_1");
    expect(mocks.sfu.mock.calls[1][2].tracks).toEqual([{ location: "local", mid: "0", trackName: "microphone" }]);
  });
  it("derives the remote publication from this call, ignoring supplied session IDs", async () => {
    mocks.own = { published: true };
    mocks.sfu.mockResolvedValueOnce({ sessionId: "receiver_1" }).mockResolvedValueOnce({ sessionDescription: { type: "offer", sdp: audio }, tracks: [{ mid: "0" }] });
    expect((await POST(request({ action: "subscribe", sessionId: "other_tenant", trackName: "private" }), context)).status).toBe(200);
    expect(mocks.sfu.mock.calls[1][2].tracks).toEqual([{ location: "remote", sessionId: "other_session", trackName: "microphone" }]);
  });
  it("reuses participant-scoped temporary TURN credentials instead of minting on every poll", async () => {
    mocks.own = { ice_servers: [{ urls: "stun:cached" }] };
    const response = await POST(request({ action: "config" }), context);
    expect(await response.json()).toMatchObject({ iceServers: [{ urls: "stun:cached" }] }); expect(mocks.ice).not.toHaveBeenCalled();
  });
  it("does not claim End call succeeded when media shutdown fails", async () => {
    mocks.end.mockRejectedValue(new Error("Provider offline"));
    expect((await POST(request({ action: "end" }), context)).status).toBe(503);
  });
  it("can clean up an existing call even after new calls are disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    expect((await POST(request({ action: "end" }), context)).status).toBe(200);
    expect(mocks.end).toHaveBeenCalledWith("call_1", "ended");
  });
});
