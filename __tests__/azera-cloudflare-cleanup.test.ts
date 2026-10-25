import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), close: vi.fn(), rowError: false, locked: false, claimBusy: false, updates: [] as Record<string, unknown>[] }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/cloudflare-rtc", () => ({ closeSfuSession: mocks.close }));
import { endCloudflareCall } from "@/lib/azera-cloudflare-cleanup";
beforeEach(() => {
  vi.clearAllMocks(); mocks.updates = []; mocks.rowError = false; mocks.locked = false; mocks.claimBusy = false; mocks.close.mockResolvedValue(undefined);
  mocks.from.mockImplementation((table) => {
    const q: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const name of ["select", "eq", "is"]) q[name] = vi.fn(() => q);
    q.update = vi.fn((fields) => { mocks.updates.push(fields); return q; });
    q.maybeSingle = vi.fn(async () => ({ data: mocks.claimBusy ? null : { id: "call_1", answered_at: null }, error: null }));
    q.then = vi.fn((resolve) => Promise.resolve(table === "azera_cloudflare_participants" ? { data: [{ publisher_session: "publisher_1", subscriber_session: "receiver_1", operation_claim: mocks.locked ? "op_1" : null }], error: mocks.rowError } : { error: null }).then(resolve));
    return q;
  });
});
describe("Cloudflare teardown", () => {
  it("closes provider media before saving ended state", async () => {
    await endCloudflareCall("call_1");
    expect(mocks.close).toHaveBeenCalledWith("publisher_1"); expect(mocks.close).toHaveBeenCalledWith("receiver_1");
    expect(mocks.updates.some((fields) => fields.status === "ended")).toBe(true);
  });
  it("does not claim termination when provider closure is unconfirmed", async () => {
    mocks.close.mockRejectedValue(new Error("provider unavailable"));
    await expect(endCloudflareCall("call_1")).rejects.toThrow();
    expect(mocks.updates.some((fields) => fields.status === "ended" || fields.closed_at)).toBe(false);
    expect(mocks.updates.at(-1)).toMatchObject({ media_control_claim: null });
  });
  it("refuses to race pending track allocation", async () => {
    mocks.locked = true; await expect(endCloudflareCall("call_1")).rejects.toThrow("setup is still finishing"); expect(mocks.close).not.toHaveBeenCalled();
  });
  it("rejects competing termination claims", async () => {
    mocks.claimBusy = true; await expect(endCloudflareCall("call_1")).rejects.toThrow("already in progress"); expect(mocks.close).not.toHaveBeenCalled();
  });
});
