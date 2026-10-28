import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  notify: vi.fn(),
  hangup: vi.fn(),
  expiredAi: [] as Record<string, unknown>[],
  due: [] as Record<string, unknown>[],
  stale: [] as Record<string, unknown>[],
  claimError: null as null | { code: string },
  queries: [] as {
    table: string;
    update: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: mocks.from },
}));
vi.mock("@/lib/admin-notifications", () => ({ notifyAllAdmins: mocks.notify }));
vi.mock("@/lib/azera-realtime", () => ({ hangupRealtimeCall: mocks.hangup }));
// These provider jobs have their own suites. Do not let local Cloudflare
// credentials or an unmocked campaign RPC change this scheduler unit fixture.
vi.mock("@/lib/cloudflare-rtc", () => ({ cloudflareSfuConfigured: () => false }));
vi.mock("@/lib/azera-campaign-worker", () => ({ dispatchAzeraCampaignCall: vi.fn(async () => ({ dispatched: false })) }));
import { GET } from "@/app/api/cron/azera-contact-centre/route";
import { GET as voicemailRetention } from "@/app/api/cron/azera-voicemails/route";
const request = (authorised = true) =>
  new Request("https://example.test/api/cron/azera-contact-centre", {
    headers: authorised ? { Authorization: "Bearer test-cron-secret" } : {},
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.due = [];
  mocks.stale = [];
  mocks.claimError = null;
  mocks.queries.length = 0;
  mocks.expiredAi = [];
  mocks.hangup.mockResolvedValue(undefined);
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  mocks.from.mockImplementation((table) => {
    let columns = "";
    const q = { table } as Record<string, unknown>;
    q.select = vi.fn((value: string) => {
      columns = value;
      return q;
    });
    for (const name of ["update", "eq", "lt", "lte", "neq", "order", "in"])
      q[name] = vi.fn(() => q);
    q.limit = vi.fn(async () => ({
      data: columns.includes("sip_call_sid")
        ? mocks.expiredAi
        : columns.includes("updated_at")
          ? mocks.stale
          : mocks.due,
      error: null,
    }));
    q.insert = vi.fn(async () => ({ error: mocks.claimError }));
    q.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ error: null }).then(resolve);
    mocks.queries.push(q as (typeof mocks.queries)[number]);
    return q;
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
});
describe("Contact-centre scheduled operations", () => {
  it("forcibly ends an overdue AI provider session independently of the browser", async () => {
    mocks.expiredAi = [
      {
        id: "ai-call-1",
        sip_call_sid: "rtc_test",
        answered_at: new Date(Date.now() - 700_000).toISOString(),
      },
    ];
    expect((await GET(request())).status).toBe(200);
    expect(mocks.hangup).toHaveBeenCalledWith("rtc_test");
    expect(
      mocks.queries.some((q) =>
        q.update.mock.calls.some(
          ([update]) =>
            update.final_outcome === "voice_time_limit" &&
            update.status === "ended",
        ),
      ),
    ).toBe(true);
  });
  it("does not claim an expired AI call ended when the provider shutdown fails", async () => {
    mocks.expiredAi = [
      { id: "ai-call-1", sip_call_sid: "rtc_test", answered_at: null },
    ];
    mocks.hangup.mockRejectedValueOnce(new Error("Provider unavailable"));
    expect((await GET(request())).status).toBe(503);
    expect(
      mocks.queries.some((q) =>
        q.update.mock.calls.some(([update]) => update.status === "ended"),
      ),
    ).toBe(false);
  });
  it("fails closed without a configured cron secret, including voicemail deletion", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request())).status).toBe(401);
    expect((await voicemailRetention(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated scheduled requests before database work", async () => {
    expect((await GET(request(false))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("flags unconfirmed sends as unknown without automatically resending", async () => {
    expect((await GET(request())).status).toBe(200);
    const pending = mocks.queries.find((q) => q.table === "azera_messages")!;
    expect(pending.update).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_status: "unknown" }),
    );
    expect(pending.lt).toHaveBeenCalledWith(
      "delivery_updated_at",
      expect.any(String),
    );
  });
  it("sends a due follow-up notification once and uses an absolute working deep link in email", async () => {
    mocks.due = [
      {
        id: "call-1",
        customer_name: "Test Customer",
        follow_up_at: "2026-10-25T07:00:00Z",
      },
    ];
    expect((await (await GET(request())).json()).reminded).toBe(1);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OMNICHANNEL_FOLLOWUP",
        deep_link: "/admin/azera/reports?call=call-1",
        email: expect.objectContaining({
          text: expect.stringContaining("/admin/azera/reports?call=call-1"),
        }),
      }),
    );
    expect(mocks.notify.mock.calls[0][0].email.text).toMatch(
      /https?:\/\/[^/]+\/admin\/azera/,
    );
    mocks.claimError = { code: "23505" };
    await GET(request());
    expect(mocks.notify).toHaveBeenCalledOnce();
  });
  it("does not close a call that received a newer heartbeat after the sweep's lookup", async () => {
    mocks.stale = [
      {
        id: "stale-call",
        updated_at: "2026-10-25T07:00:00Z",
        answered_at: "2026-10-25T06:59:00Z",
      },
    ];
    await GET(request());
    const update = mocks.queries.find((q) =>
      q.update.mock.calls.some(
        ([value]) => value.final_outcome === "agent_disconnected",
      ),
    )!;
    expect(update.eq).toHaveBeenCalledWith(
      "updated_at",
      "2026-10-25T07:00:00Z",
    );
  });
});
