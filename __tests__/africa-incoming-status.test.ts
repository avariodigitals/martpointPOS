import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), updates: [] as { table: string; value: Record<string, unknown> }[], call: {} as Record<string, unknown> }));
vi.mock("@/lib/admin-auth", () => ({ getSession: async () => ({ userId: "00000000-0000-4000-8000-000000000011", role: "Sales" }), hasPermission: () => true }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: mocks.from } }));
import { PATCH } from "@/app/api/azera/calls/[id]/africa-browser/route";
beforeEach(() => {
  vi.clearAllMocks(); mocks.updates = [];
  mocks.call = { id: "call-1", status: "ringing", answered_at: null, sip_provider: "africas_talking", direction: "inbound" };
  mocks.from.mockImplementation(table => {
    const q = { select: () => q, eq: () => q, in: () => q,
      update: (value: Record<string, unknown>) => { mocks.updates.push({ table, value }); return q; }, insert: () => q,
      maybeSingle: async () => ({ data: mocks.call, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "azera_call_attempts" ? [{ id: "attempt-1", destination: "martpoint.mp_agent_00000000000040008000000000000011" }] : [], error: null }).then(resolve),
    }; return q;
  });
});
describe("Incoming browser-leg status", () => {
  it("declines only the browser attempt and preserves parent routing to SIP/phone fallback", async () => {
    const response = await PATCH(new Request("https://example.test/status", { method: "PATCH", body: JSON.stringify({ status: "missed" }) }), { params: Promise.resolve({ id: "call-1" }) });
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ status: "ringing", browserLegEnded: true });
    expect(mocks.updates).toContainEqual({ table: "azera_call_attempts", value: expect.objectContaining({ status: "rejected" }) });
    const parent = mocks.updates.find(update => update.table === "azera_calls")?.value;
    expect(parent).toMatchObject({ agent_user_id: null, agent_name: null });
    expect(parent).not.toHaveProperty("status"); expect(parent).not.toHaveProperty("ended_at");
  });
});
