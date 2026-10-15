import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({
  from: vi.fn(),
  results: [] as unknown[],
  updates: [] as unknown[],
  inserts: [] as Array<{ table: string; value: Record<string, unknown> }>,
  tables: [] as string[],
}))
vi.mock("@/lib/supabase", () => ({ supabase: { from: db.from }, isSupabaseConfigured: () => true }))
vi.mock("@/lib/automations", () => ({
  getAutomationByKey: vi.fn(), enqueueAutomation: vi.fn(),
  getClientCheckinConfig: vi.fn(), sendClientCheckinEmail: vi.fn(),
}))
import { recordInstallCheckin, recordUsagePing, runDormancySweep } from "@/lib/client-checkins"
import { getClientCheckinConfig, sendClientCheckinEmail } from "@/lib/automations"

beforeEach(() => {
  db.results = []; db.updates = []; db.inserts = []; db.tables = []
  db.from.mockReset()
  vi.mocked(getClientCheckinConfig).mockReset()
  vi.mocked(sendClientCheckinEmail).mockReset()
  db.from.mockImplementation((table: string) => {
    db.tables.push(table)
    const result = db.results.shift()
    const chain: Record<string, unknown> = {
      select: () => chain, not: () => chain, limit: () => chain, eq: () => chain,
      is: () => chain, in: () => chain, lt: () => chain, neq: () => chain, order: () => chain,
      maybeSingle: () => chain, single: () => chain,
      update: (value: unknown) => { db.updates.push(value); return chain },
      insert: (value: unknown) => { db.inserts.push({ table, value: value as Record<string, unknown> }); return chain },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    }
    return chain
  })
})
const deployment = (id: string) => ({ business_id: id, environment_url: "https://shop.merchant.com/pos/" })

describe("usage ping identity and persistence (offline)", () => {
  it("saves one known client and confirms a persisted row", async () => {
    db.results = [{ data: [deployment("one")] }, { data: [{ id: "one" }] }]
    expect(await recordUsagePing("https://shop.merchant.com/pos/")).toEqual({ matched: true, outcome: "saved", businessId: "one" })
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0]).toMatchObject({ last_usage_at: expect.any(String), last_seen_at: expect.any(String) })
  })
  it("refuses a hostname belonging to different clients", async () => {
    db.results = [{ data: [deployment("one"), deployment("two")] }]
    expect(await recordUsagePing("shop.merchant.com")).toEqual({ matched: false, outcome: "ambiguous" })
    expect(db.updates).toHaveLength(0)
  })
  it("allows multiple deployment rows for the same client", async () => {
    db.results = [{ data: [deployment("one"), deployment("one")] }, { data: [{ id: "one" }] }]
    expect(await recordUsagePing("shop.merchant.com")).toEqual({ matched: true, outcome: "saved", businessId: "one" })
  })
  it("refuses ambiguous website fallback", async () => {
    db.results = [{ data: [] }, { data: [
      { id: "one", website: "https://shop.merchant.com" },
      { id: "two", website: "https://shop.merchant.com" },
    ] }]
    expect(await recordUsagePing("shop.merchant.com")).toEqual({ matched: false, outcome: "ambiguous" })
    expect(db.updates).toHaveLength(0)
  })
  it.each([{ error: { message: "database unavailable" } }, { data: [] }])("does not acknowledge a failed or missing saved row", async (saved) => {
    db.results = [{ data: [deployment("one")] }, saved]
    expect(await recordUsagePing("shop.merchant.com")).toEqual({ matched: false, outcome: "save_failed", businessId: "one" })
  })
  it("does not use fallback after a deployment query error", async () => {
    db.results = [{ error: { message: "database unavailable" } }]
    expect(await recordUsagePing("shop.merchant.com")).toEqual({ matched: false, outcome: "save_failed" })
    expect(db.from).toHaveBeenCalledTimes(1)
  })
  it("does not touch unknown clients", async () => {
    db.results = [{ data: [] }, { data: [] }]
    expect(await recordUsagePing("unknown.merchant.com")).toEqual({ matched: false, outcome: "unmatched" })
    expect(db.updates).toHaveLength(0)
  })
})

describe("install token check-ins (offline)", () => {
  it("credits a valid usage token and stamps both usage columns", async () => {
    db.results = [
      { data: { id: "t1", business_id: "one" } },
      { data: [{ id: "one" }] },
      { data: null },
      { data: null },
    ]
    expect(await recordInstallCheckin({ token: "secret-token" })).toEqual({ matched: true })
    expect(db.tables).toEqual(["install_tokens", "businesses", "install_tokens", "usage_ping_log"])
    expect(db.updates[0]).toMatchObject({ last_usage_at: expect.any(String), last_seen_at: expect.any(String) })
    expect(JSON.stringify(db.inserts)).not.toContain("secret-token")
  })
  it("system pings with a token never count as POS usage", async () => {
    db.results = [
      { data: { id: "t1", business_id: "one" } },
      { data: [{ id: "one" }] },
      { data: null },
      { data: null },
    ]
    expect(await recordInstallCheckin({ token: "secret-token", type: "system" })).toEqual({ matched: true })
    expect(db.updates[0]).toEqual({ last_system_ping_at: expect.any(String) })
  })
  it("refuses to acknowledge a token check-in the database did not save", async () => {
    db.results = [
      { data: { id: "t1", business_id: "one" } },
      { error: { message: "database unavailable" } },
      { data: null },
      { data: null },
    ]
    expect(await recordInstallCheckin({ token: "secret-token" })).toEqual({ matched: false })
    expect(db.inserts[0].value).toMatchObject({ outcome: "save_failed", business_id: "one" })
  })
  it("logs an unknown token as invalid without revealing the reason", async () => {
    db.results = [{ data: null }, { data: null }]
    expect(await recordInstallCheckin({ token: "stale-or-stolen" })).toEqual({ matched: false })
    expect(db.tables).toEqual(["install_tokens", "usage_ping_log"])
    expect(db.inserts[0].value).toMatchObject({ outcome: "invalid", business_id: null, detail: null })
  })
  it("rejects anonymous system heartbeats instead of crediting them", async () => {
    db.results = [{ data: null }]
    expect(await recordInstallCheckin({ key: "shop.merchant.com", type: "system" })).toEqual({ matched: false })
    expect(db.tables).toEqual(["usage_ping_log"])
    expect(db.updates).toHaveLength(0)
    expect(db.inserts[0].value).toMatchObject({ source: "hostname", ping_type: "system", outcome: "invalid" })
  })
  it("keeps the legacy hostname path working and logs it for diagnostics", async () => {
    db.results = [{ data: [deployment("one")] }, { data: [{ id: "one" }] }, { data: null }]
    expect(await recordInstallCheckin({ key: "https://shop.merchant.com/pos/" })).toEqual({ matched: true })
    expect(db.inserts[0].value).toMatchObject({
      source: "hostname", ping_type: "usage", outcome: "saved",
      business_id: "one", detail: "shop.merchant.com",
    })
  })
})

describe("dormancy sweep (offline)", () => {
  const quietBusiness = {
    id: "one", business_name: "Ada's Fresh Mart", primary_contact_name: "Ada",
    primary_email: "ada@merchant.com", status: "ACTIVE",
    last_usage_at: "2026-09-01T00:00:00.000Z", last_dormant_email_at: null,
  }

  it("sends nothing while automatic dormancy emails are off", async () => {
    vi.mocked(getClientCheckinConfig).mockResolvedValue({ dormantEnabled: false } as never)
    expect(await runDormancySweep()).toEqual({ checked: 0, sent: 0, failed: 0, skipped: true })
    expect(db.from).not.toHaveBeenCalled()
  })
  it("claims the row with a compare-and-set before sending and records the delivery", async () => {
    db.results = [
      { data: [quietBusiness] },
      { data: [{ id: "one" }] },
      { data: null },
    ]
    vi.mocked(getClientCheckinConfig).mockResolvedValue({ dormantEnabled: true } as never)
    vi.mocked(sendClientCheckinEmail).mockResolvedValue({ sent: true } as never)
    expect(await runDormancySweep()).toEqual({ checked: 1, sent: 1, failed: 0, skipped: false })
    expect(db.updates[0]).toEqual({ last_dormant_email_at: expect.any(String) })
    expect(sendClientCheckinEmail).toHaveBeenCalledWith(expect.objectContaining({ id: "one" }), "client_dormant", expect.anything())
    expect(db.inserts[0].value).toMatchObject({ business_id: "one", status: "sent", quiet_since: quietBusiness.last_usage_at })
  })
  it("skips a client a concurrent job already claimed", async () => {
    db.results = [{ data: [quietBusiness] }, { data: [] }]
    vi.mocked(getClientCheckinConfig).mockResolvedValue({ dormantEnabled: true } as never)
    expect(await runDormancySweep()).toEqual({ checked: 1, sent: 0, failed: 0, skipped: false })
    expect(sendClientCheckinEmail).not.toHaveBeenCalled()
    expect(db.inserts).toHaveLength(0)
  })
  it("releases the claim and records the failure when sending fails", async () => {
    db.results = [
      { data: [quietBusiness] },
      { data: [{ id: "one" }] },
      { data: null },
      { data: null },
    ]
    vi.mocked(getClientCheckinConfig).mockResolvedValue({ dormantEnabled: true } as never)
    vi.mocked(sendClientCheckinEmail).mockResolvedValue({ sent: false, error: "Resend refused" } as never)
    expect(await runDormancySweep()).toEqual({ checked: 1, sent: 0, failed: 1, skipped: false })
    expect(db.updates).toHaveLength(2)
    expect(db.updates[1]).toEqual({ last_dormant_email_at: null })
    expect(db.inserts[0].value).toMatchObject({ status: "failed", error: "Resend refused" })
  })
})
