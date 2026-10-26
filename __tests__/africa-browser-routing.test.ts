import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), config: vi.fn(), call: {} as Record<string, unknown>, updates: [] as Record<string, unknown>[] }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock("@/lib/africa-browser-voice", () => ({ africaBrowserConfig: mocks.config }));
import { africaBrowserDestination, africaDepartmentQueue, preparedAfricaOutbound } from "@/lib/africa-browser-routing";
import { normalizeVoiceDestination } from "@/lib/africastalking";
beforeEach(() => {
  vi.clearAllMocks(); mocks.updates = [];
  mocks.rpc.mockResolvedValue({ data: "mp_agent_123", error: null });
  mocks.config.mockResolvedValue({ username: "martpoint" });
  mocks.call = { id: "call-1", business_id: "business-1", sip_to_number: "+2348000000001", sip_from_number: "+2348000000000", sip_call_sid: null, status: "ringing", created_at: new Date().toISOString() };
  mocks.from.mockImplementation(() => {
    let update = false;
    const q = { select: () => q, eq: () => q, or: () => q,
      update: (value: Record<string, unknown>) => { update = true; mocks.updates.push(value); return q; },
      maybeSingle: async () => ({ data: update ? { id: "call-1" } : mocks.call, error: null }),
    }; return q;
  });
});
describe("Africa browser callback routing", () => {
  it("uses documented application.clientName identities without phone normalisation", async () => {
    expect(await africaBrowserDestination("call-1", "business-1", "Sales and demos")).toBe("martpoint.mp_agent_123");
    expect(mocks.rpc).toHaveBeenCalledWith("azera_route_africa_browser", { p_call: "call-1", p_queue: "sales" });
    expect(normalizeVoiceDestination("martpoint.mp_agent_123")).toBe("martpoint.mp_agent_123");
  });
  it.each([["Sales", "sales"], ["Technical support", "support"], ["Billing and Onboarding", "onboarding"], ["General", "customer_support"]])("maps %s to %s", (label, queue) => expect(africaDepartmentQueue(label)).toBe(queue));
  it("keeps existing phone/SIP fallbacks when migration or registration is unavailable", async () => {
    mocks.rpc.mockRejectedValue(new Error("Missing migration"));
    expect(await africaBrowserDestination("call-1", "business-1", "Sales")).toBeNull();
  });
  it("binds only a recent server-prepared outgoing call and the stored contact number", async () => {
    expect(await preparedAfricaOutbound("martpoint.mp_123", "+2348000000001", "ATVId_123")).toMatchObject({ id: "call-1" });
    expect(mocks.updates).toContainEqual(expect.objectContaining({ sip_call_sid: "ATVId_123" }));
  });
  it("rejects arbitrary destinations, another app identity, stale preparations and session replacement", async () => {
    expect(await preparedAfricaOutbound("martpoint.mp_123", "+19999999999", "ATVId_123")).toBeNull();
    expect(await preparedAfricaOutbound("other.mp_123", "+2348000000001", "ATVId_123")).toBeNull();
    mocks.call.created_at = new Date(Date.now()-180_000).toISOString();
    expect(await preparedAfricaOutbound("martpoint.mp_123", "+2348000000001", "ATVId_123")).toBeNull();
    mocks.call.sip_call_sid = "ATVId_original";
    expect(await preparedAfricaOutbound("martpoint.mp_123", "+2348000000001", "ATVId_new")).toBeNull();
    expect(mocks.updates).toEqual([]);
  });
  it("rejects provider session strings that could modify database filters", async () => {
    expect(await preparedAfricaOutbound("martpoint.mp_123", "+2348000000001", "id,or(status.eq.active)")).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
