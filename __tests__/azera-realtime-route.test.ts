import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  verify: vi.fn(),
  access: vi.fn(),
  create: vi.fn(),
  hangup: vi.fn(),
  provider: vi.fn(),
  rows: [] as { data: unknown; error?: unknown }[],
}));
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));
vi.mock("@/lib/azera-public-auth", () => ({
  tokenFromRequest: () => "test",
  verifyConversationToken: mocks.verify,
}));
vi.mock("@/lib/azera-identity", () => ({
  isConversationIdentityMatch: (
    claims: { conversationId: string },
    row: { id: string },
  ) => claims.conversationId === row.id,
}));
vi.mock("@/lib/azera-call-access", () => ({ getCallAccess: mocks.access }));
vi.mock("@/lib/azera-realtime", () => ({
  realtimeProvider: mocks.provider,
  createRealtimeCall: mocks.create,
  hangupRealtimeCall: mocks.hangup,
  voiceInstructions: () => "public knowledge only",
  realtimeVoiceEnabled: () => true,
}));
import { GET, POST, DELETE, PATCH } from "@/app/api/azera/voice/realtime/route";
const conversation = {
  id: "conversation-1",
  business_id: "business-1",
  external_id: "visitor-1",
  channel: "website",
  status: "open",
};
const request = (method = "POST", body: object = { sdp: "v=0\r\noffer" }) =>
  new Request("https://example.test/api/azera/voice/realtime?id=call-1", {
    method,
    ...(method === "POST"
      ? {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows.length = 0;
  mocks.verify.mockReturnValue({ conversationId: "conversation-1" });
  mocks.provider.mockResolvedValue({ apiKey: "never-send-this-key" });
  mocks.rpc.mockResolvedValue({ data: "call-1", error: null });
  mocks.create.mockResolvedValue({
    providerId: "rtc_test",
    answer: "v=0\r\nanswer",
  });
  mocks.hangup.mockResolvedValue(undefined);
  mocks.access.mockResolvedValue({
    actor: { type: "customer" },
    call: {
      id: "call-1",
      sip_provider: "openai_realtime",
      sip_call_sid: "rtc_test",
      created_at: new Date().toISOString(),
      answered_at: null,
    },
  });
  mocks.from.mockImplementation(() => {
    const q = {} as Record<string, unknown>;
    for (const key of ["select", "eq", "update", "in"]) q[key] = vi.fn(() => q);
    q.maybeSingle = q.limit = vi.fn(
      async () => mocks.rows.shift() || { data: null, error: null },
    );
    q.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ error: null }).then(resolve);
    return q;
  });
});
function allowed() {
  mocks.rows.push(
    { data: conversation },
    { data: { voice_realtime_enabled: true } },
    { data: [{ title: "Retail", content: "Approved public reference" }] },
    { data: { id: "call-1" } },
  );
}
describe("Public AI voice boundary", () => {
  it("rejects unauthorised visitors before allocating a paid provider session", async () => {
    mocks.verify.mockReturnValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not allow a conversation token to act for another conversation", async () => {
    mocks.rows.push({ data: { ...conversation, id: "someone-else" } });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("keeps voice opt-in and refuses a call when disabled", async () => {
    mocks.rows.push(
      { data: conversation },
      { data: { voice_realtime_enabled: false } },
    );
    expect((await POST(request())).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("honours durable database limits before contacting the provider", async () => {
    allowed();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("returns only app call ID and SDP, not provider credentials or its private call ID", async () => {
    allowed();
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "call-1",
      answer: "v=0\r\nanswer",
      maxSeconds: 600,
    });
    expect(mocks.create).toHaveBeenCalledWith(
      "v=0\r\noffer",
      "public knowledge only",
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });
  it("closes a provider session if its call reference cannot be persisted", async () => {
    allowed();
    mocks.rows[3] = { data: null, error: { code: "database-error" } };
    expect((await POST(request())).status).toBe(503);
    expect(mocks.hangup).toHaveBeenCalledWith("rtc_test");
  });
  it("does not label a provider shutdown failure as an ended call", async () => {
    mocks.hangup.mockRejectedValueOnce(new Error("provider unavailable"));
    expect((await DELETE(request("DELETE"))).status).toBe(503);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("will not use the AI endpoint to end a human website call", async () => {
    mocks.access.mockResolvedValue({
      actor: { type: "customer" },
      call: { sip_provider: null },
    });
    expect((await DELETE(request("DELETE"))).status).toBe(403);
    expect(mocks.hangup).not.toHaveBeenCalled();
  });
  it("marks an authorised audio connection and exposes only an enabled flag", async () => {
    expect((await PATCH(request("PATCH"))).status).toBe(200);
    mocks.rows.push(
      { data: conversation },
      { data: { voice_realtime_enabled: true } },
    );
    expect(await (await GET(request("GET"))).json()).toEqual({ enabled: true });
  });
});
