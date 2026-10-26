import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn(), rpc: vi.fn(), capability: vi.fn(), role: "Admin", status: "ACTIVE", permission: true, updates: [] as Record<string, unknown>[] }));
vi.mock("@/lib/admin-auth", () => ({ getSession: mocks.session, hasPermission: () => mocks.permission }));
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("@/lib/africa-browser-voice", () => ({ africaBrowserConfig: async () => ({ apiKey: "never-return-this-key", phone: "+2348000000000", username: "martpoint" }), africaBrowserReady: () => true, africaCapability: mocks.capability }));
vi.mock("@/lib/africastalking", () => ({ resolveAfricaBusinessId: async () => "business-1" }));
import { GET, POST } from "@/app/api/azera/calls/africa-browser/agent/route";
const request = (body: Record<string, unknown> = {}) => new Request("https://example.test/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lease: "00000000-0000-4000-8000-000000000001", action: "register", queues: ["sales"], ...body }) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.role = "Admin"; mocks.status = "ACTIVE"; mocks.permission = true; mocks.updates = [];
  mocks.session.mockResolvedValue({ userId: "agent-1", name: "Agent", role: "Admin" });
  mocks.capability.mockResolvedValue("short-lived-incoming-token"); mocks.rpc.mockResolvedValue({ data: "mp_agent_123", error: null });
  mocks.from.mockImplementation(table => {
    const q = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q,
      update: (value: Record<string, unknown>) => { mocks.updates.push(value); return q; },
      maybeSingle: async () => ({ data: table === "users" ? { id: "agent-1", role: mocks.role, status: mocks.status } : table === "azera_africa_browser_agents" ? { user_id: "agent-1", ready: false, queues: ["sales"] } : { id: "call-1", customer_phone: "+2348000000001" }, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    }; return q;
  });
});
describe("Authenticated receiving phone API", () => {
  it("issues only an incoming token and never exposes the permanent API key", async () => {
    const response = await POST(request()); const result = await response.json();
    expect(response.status).toBe(200); expect(result.token).toBe("short-lived-incoming-token");
    expect(JSON.stringify(result)).not.toContain("never-return-this-key");
    expect(mocks.capability).toHaveBeenCalledWith(expect.anything(), "mp_agent_123", true);
    expect(mocks.rpc).toHaveBeenCalledWith("azera_register_africa_browser", expect.objectContaining({ p_user: "agent-1", p_business: "business-1", p_queues: ["sales"] }));
  });
  it("refuses a second live tab or an unfinished call before requesting a token", async () => {
    mocks.rpc.mockResolvedValue({ data: null });
    expect((await POST(request())).status).toBe(409); expect(mocks.capability).not.toHaveBeenCalled();
  });
  it.each([["Finance", "ACTIVE"], ["Admin", "DISABLED"]])("refuses ineligible database user %s/%s", async (role, status) => {
    mocks.role = role; mocks.status = status;
    expect((await POST(request())).status).toBe(403); expect(mocks.capability).not.toHaveBeenCalled();
  });
  it("requires authentication and valid queues", async () => {
    expect((await POST(request({ queues: ["not-a-department"] }))).status).toBe(400);
    mocks.session.mockResolvedValue(null); expect((await GET()).status).toBe(403);
  });
  it("sets ready only on the separate SDK readiness action", async () => {
    await POST(request({ action: "ready" })); expect(mocks.updates).toContainEqual(expect.objectContaining({ ready: true }));
    mocks.updates = []; await POST(request({ action: "stop" }));
    expect(mocks.updates).toContainEqual({ ready: false, last_seen_at: new Date(0).toISOString() });
  });
  it("expires availability when the provider refuses a token", async () => {
    mocks.capability.mockRejectedValue(new Error("Activation required"));
    expect((await POST(request())).status).toBe(502);
    expect(mocks.updates).toContainEqual(expect.objectContaining({ ready: false }));
  });
});
