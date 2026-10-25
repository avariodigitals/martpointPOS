import { beforeEach, describe, expect, it, vi } from "vitest";
import nextConfig from "@/next.config";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/azera-call-access", () => ({
  getCallAccess: mocks.access,
  callIceServers: () => [{ urls: "stun:example.test" }],
}));
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));
vi.mock("@/lib/admin-auth", () => ({
  getSession: vi.fn(),
  hasPermission: () => true,
}));
vi.mock("@/lib/azera-public-auth", () => ({
  tokenFromRequest: () => "visitor-token",
  verifyConversationToken: () => ({
    conversationId: "conversation-1",
    businessId: "business-1",
    externalId: "visitor-1",
  }),
}));
import { PATCH } from "@/app/api/azera/calls/[id]/route";
import { GET, POST } from "@/app/api/azera/calls/[id]/signaling/route";
import { POST as createCall } from "@/app/api/azera/calls/route";

const params = { params: Promise.resolve({ id: "call-1" }) };
const call = {
  id: "call-1",
  call_type: "webrtc",
  status: "ringing",
  direction: "inbound",
  agent_user_id: null,
  answered_at: null,
};
let query: Record<string, ReturnType<typeof vi.fn>>;
function request(body: object, method = "POST") {
  return new Request("https://example.test/api/azera/calls/call-1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  query = Object.fromEntries(
    [
      "select",
      "eq",
      "gte",
      "is",
      "update",
      "insert",
      "in",
      "contains",
      "neq",
      "order",
    ].map((key) => [key, vi.fn(() => query)]),
  );
  query.maybeSingle = vi.fn(async () => ({
    data: { status: "ended" },
    error: null,
  }));
  query.limit = vi.fn(async () => ({ data: [], error: null }));
  // Insert is also awaited directly by lifecycle/signaling routes.
  query.insert = vi.fn(async () => ({ error: null }));
  mocks.from.mockReturnValue(query);
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.access.mockResolvedValue({
    call: { ...call },
    actor: { type: "customer", id: null },
  });
});

describe("Azera call routes", () => {
  it("does not let the old lifecycle or signaling route orphan a paid AI session", async () => {
    mocks.access.mockResolvedValue({
      call: { ...call, sip_provider: "openai_realtime", status: "active" },
      actor: { type: "customer", id: null },
    });
    expect(
      (await PATCH(request({ status: "ended" }, "PATCH"), params)).status,
    ).toBe(409);
    expect(
      (await POST(request({ sdp_type: "offer", sdp: "v=0" }), params)).status,
    ).toBe(409);
    expect(query.update).not.toHaveBeenCalled();
    expect(query.insert).not.toHaveBeenCalled();
  });
  it("does not create or ring a call when no agent has a recent online heartbeat", async () => {
    query.maybeSingle.mockResolvedValue({
      data: {
        id: "conversation-1",
        business_id: "business-1",
        external_id: "visitor-1",
      },
      error: null,
    });
    const response = await createCall(
      request({
        business_id: "business-1",
        conversation_id: "conversation-1",
        customer_external_id: "visitor-1",
        source: "public_site",
        call_type: "webrtc",
        direction: "inbound",
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("unavailable for a live call"),
    });
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("does not let public callers initiate telecom or outbound calls", async () => {
    const response = await createCall(
      request({
        business_id: "business-1",
        source: "public_site",
        call_type: "sip",
        direction: "outbound",
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("allows same-origin microphone access without opening camera or geolocation", async () => {
    const rules = await nextConfig.headers!();
    const headers = rules.find((rule) => rule.source === "/:path*")!.headers;
    expect(headers).toContainEqual({
      key: "Permissions-Policy",
      value: "camera=(), microphone=(self), geolocation=()",
    });
  });

  it("rejects unauthorized reads, signals and lifecycle changes without writes", async () => {
    mocks.access.mockResolvedValue(null);
    expect(
      (await GET(new Request("https://example.test"), params)).status,
    ).toBe(401);
    expect(
      (await POST(request({ sdp_type: "offer", sdp: "offer" }), params)).status,
    ).toBe(401);
    expect(
      (await PATCH(request({ status: "ended" }, "PATCH"), params)).status,
    ).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("lets a visitor end their call but cannot alter provider or agent data", async () => {
    const response = await PATCH(
      request(
        {
          status: "ended",
          agent_user_id: "attacker",
          sip_cost_cents: 0,
          duration_seconds: 900,
        },
        "PATCH",
      ),
      params,
    );
    expect(response.status).toBe(200);
    const update = query.update.mock.calls[0][0];
    expect(update).toMatchObject({ status: "ended", duration_seconds: 0 });
    expect(update).not.toHaveProperty("agent_user_id");
    expect(update).not.toHaveProperty("sip_cost_cents");
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "ended",
        actor_type: "customer",
        actor_id: null,
      }),
    );
  });

  it.each([{ action: "accept" }, { status: "active" }, { status: "answered" }])(
    "does not let visitors answer their own call: %j",
    async (body) => {
      expect((await PATCH(request(body, "PATCH"), params)).status).toBe(403);
      expect(query.update).not.toHaveBeenCalled();
    },
  );

  it("atomically claims a ringing call for one agent and reports claim races", async () => {
    mocks.access.mockResolvedValue({
      call,
      actor: { type: "agent", id: "agent-1" },
    });
    expect(
      (await PATCH(request({ action: "accept" }, "PATCH"), params)).status,
    ).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("azera_claim_browser_call", {
      p_call_id: "call-1",
      p_agent_id: "agent-1",
    });
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(
      (await PATCH(request({ action: "accept" }, "PATCH"), params)).status,
    ).toBe(409);
  });

  it("stores valid active status, not the unsupported answered status", async () => {
    mocks.access.mockResolvedValue({
      call: { ...call, agent_user_id: "agent-1" },
      actor: { type: "agent", id: "agent-1" },
    });
    await PATCH(request({ status: "answered" }, "PATCH"), params);
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        answered_at: expect.any(String),
      }),
    );
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "answered" }),
    );
  });

  it("rejects another agent and never resurrects a terminal call", async () => {
    mocks.access.mockResolvedValue({
      call: { ...call, agent_user_id: "agent-2" },
      actor: { type: "agent", id: "agent-1" },
    });
    expect(
      (await PATCH(request({ action: "accept" }, "PATCH"), params)).status,
    ).toBe(409);
    mocks.access.mockResolvedValue({
      call: { ...call, status: "ended" },
      actor: { type: "agent", id: "agent-1" },
    });
    const response = await PATCH(
      request({ status: "active" }, "PATCH"),
      params,
    );
    expect(await response.json()).toMatchObject({ data: { status: "ended" } });
    expect(query.update).not.toHaveBeenCalled();
  });

  it("preserves ICE mid and line index including older cached client field names", async () => {
    await POST(
      request({
        sdp_type: "ice",
        candidate: "candidate",
        candidate_sdp_mid: "audio",
        candidate_sdp_mline_index: 0,
      }),
      params,
    );
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: null,
        metadata: expect.objectContaining({
          sdp_mid: "audio",
          sdp_mline_index: 0,
        }),
      }),
    );
  });

  it("only returns the other party’s connection messages with no-store headers", async () => {
    const response = await GET(new Request("https://example.test"), params);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(query.neq).toHaveBeenCalledWith("actor_type", "customer");
    expect(await response.json()).toMatchObject({
      call: { status: "ringing" },
    });
  });

  it("rejects malformed signaling, incorrect SDP roles and unclaimed agent signaling", async () => {
    expect(
      (await POST(request({ sdp_type: "answer", sdp: "answer" }), params))
        .status,
    ).toBe(403);
    expect(
      (
        await POST(
          request({
            sdp_type: "ice",
            candidate: "candidate",
            sdp_mline_index: -1,
          }),
          params,
        )
      ).status,
    ).toBe(400);
    mocks.access.mockResolvedValue({
      call,
      actor: { type: "agent", id: "agent-1" },
    });
    expect(
      (await POST(request({ sdp_type: "answer", sdp: "answer" }), params))
        .status,
    ).toBe(409);
    expect(query.insert).not.toHaveBeenCalled();
  });
});
