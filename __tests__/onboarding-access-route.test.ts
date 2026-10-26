import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ session: vi.fn(), permission: vi.fn(), from: vi.fn(), update: vi.fn(), send: vi.fn(), mark: vi.fn(), checkins: vi.fn(), qr: vi.fn(), record: {} as Record<string, unknown>, persistError: null as unknown }))
vi.mock("@/lib/admin-auth", () => ({ getSession: mocks.session, hasPermission: mocks.permission }))
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from } }))
vi.mock("@/lib/email", () => ({ sendEmail: mocks.send, REPLY_TO: { sales: "sales@example.test" } }))
vi.mock("@/lib/email-templates", () => ({ renderEmailTemplate: vi.fn(async () => ({ subject: "Default access subject", text: "Default access body" })), brandedEmailHtml: (body: string) => body, getEmailWhiteLogoUrl: () => "https://example.test/logo.svg" }))
vi.mock("@/lib/client-checkins", () => ({ markAccessSent: mocks.mark, startCheckins: mocks.checkins }))
vi.mock("@/lib/automations", () => ({ getClientCheckinConfig: async () => ({ welcomeEnabled: true }) }))
vi.mock("qrcode", () => ({ default: { toBuffer: mocks.qr } }))
import { GET, POST } from "@/app/api/admin/onboarding/access/route"

const draft = { recordId: "record-1", recipients: "owner@example.test; finance@example.test", softwareUrl: "https://test.example.test/login", linksConfirmed: true, adminUsername: "owner@example.test", tempPassword: "test-only-password", subject: "Updated access instructions", message: "Your custom access message", additionalNote: "Training is tomorrow." }
const request = (overrides: Record<string, unknown> = {}) => new Request("https://example.test/api/admin/onboarding/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, ...overrides }) })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.record = { id: "record-1", email: "original@example.test", business_name: "Test Business", full_name: "Test Contact", product_interest: "retail", business_id: "business-1", access_details: { lastSentAt: "2026-10-20T10:00:00Z" } }
  mocks.persistError = null
  mocks.session.mockResolvedValue({ userId: "admin-1", role: "ADMIN" })
  mocks.permission.mockReturnValue(true)
  mocks.send.mockResolvedValue(true)
  mocks.mark.mockResolvedValue(false)
  mocks.checkins.mockResolvedValue({ ok: true, welcomeSent: true })
  mocks.qr.mockResolvedValue(Buffer.from("test-qr"))
  mocks.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: mocks.record, error: null }) }) }),
    update: mocks.update.mockImplementation(() => ({ eq: async () => ({ error: mocks.persistError }) })),
  }))
})

describe("Admin onboarding access send and resend", () => {
  it("requires onboarding permission before reading credentials or sending", async () => {
    mocks.permission.mockReturnValue(false)
    expect((await POST(request())).status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it("sends the edited content only to explicit recipients, saves a reusable snapshot and does not restart check-ins", async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    const result = await response.json()
    const synced = `${draft.message}\n\nSoftware URL: ${draft.softwareUrl}`
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: ["owner@example.test", "finance@example.test"], subject: draft.subject, text: `${synced}\n\n${draft.additionalNote}`, useRouteRecipients: false, route: "onboarding_access" }))
    expect(result).toMatchObject({ success: true, sent: true, persisted: true, accessDetails: { recipients: "owner@example.test, finance@example.test", subject: draft.subject, message: synced, additionalNote: draft.additionalNote, sendCount: 2, deliveryStatus: "PROVIDER_ACCEPTED" } })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ access_details: result.accessDetails }))
    expect(mocks.checkins).not.toHaveBeenCalled()
  })
  it("never advances lastSentAt or starts check-ins after a failed send", async () => {
    mocks.send.mockResolvedValue(false)
    expect((await POST(request())).status).toBe(502)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.mark).not.toHaveBeenCalled()
  })
  it.each([{ recipients: "" }, { recipients: "invalid" }, { recipients: [] }, { subject: "Header\r\nBcc: other@example.test" }, { message: " " }])("rejects invalid drafts without sending or persisting", async (invalid) => {
    expect((await POST(request(invalid))).status).toBe(400)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("reports persistence failures separately from successful provider acceptance", async () => {
    mocks.persistError = { message: "test save failure" }
    const result = await (await POST(request())).json()
    expect(result).toMatchObject({ success: true, sent: true, persisted: false })
    expect(result.warning).toContain("Do not send it again")
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })
  it("regenerates selected QR codes, attaches new uploads and saves filenames rather than file content", async () => {
    const result = await (await POST(request({ attachLoginQr: true, attachments: [{ name: "welcome.txt", content: "dGVzdA==" }] }))).json()
    expect(mocks.qr).toHaveBeenCalledWith(draft.softwareUrl, expect.any(Object))
    expect(mocks.send.mock.calls[0][0].attachments).toHaveLength(2)
    expect(result.accessDetails.attachmentNames).toEqual(["welcome.txt", "martpoint-login-qr.png"])
    expect(result.accessDetails.attachments).toBeUndefined()
  })
  it("does not silently send an incomplete welcome kit", async () => {
    expect((await POST(request({ attachments: [{ name: "broken.txt", content: "" }] }))).status).toBe(400)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it("starts the welcome sequence only for the first accepted access send", async () => {
    mocks.mark.mockResolvedValue(true)
    await POST(request())
    expect(mocks.checkins).toHaveBeenCalledWith("business-1", { sendWelcome: true })
  })
  it.each([{ linksConfirmed: false }, { linksConfirmed: undefined }, { softwareUrl: "client.martpoint.com.ng/login" }, { softwareUrl: "http:///login" }, { softwareUrl: "javascript:alert(1)" }, { softwareUrl: "https://user:password@example.com/login" }, { onlineStoreUrl: "not a link" }])("blocks unconfirmed or malformed links before sending", async (invalid) => {
    expect((await POST(request(invalid))).status).toBe(400)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.qr).not.toHaveBeenCalled()
  })
  it("repairs stale labelled and previously saved links in a resend and its QR", async () => {
    mocks.record.access_details = { softwareUrl: "https://old.example.test/wrong", lastSentAt: "2026-10-20T10:00:00Z" }
    const response = await POST(request({ softwareUrl: "https://actual.example.test/retail/index.php/login", message: "Hello\nSoftware URL: https://old.example.test/wrong\nUse https://old.example.test/wrong\n\nPersonal note", attachLoginQr: true }))
    expect(response.status).toBe(200)
    const sent = mocks.send.mock.calls[0][0]
    expect(sent.text).not.toContain("old.example.test")
    expect(sent.text).toContain("Personal note")
    expect(sent.text).toContain("https://actual.example.test/retail/index.php/login")
    expect(mocks.qr).toHaveBeenCalledWith("https://actual.example.test/retail/index.php/login", expect.anything())
  })
  it("loads only deployment URLs for the selected record without guessing from the business name or exposing credentials", async () => {
    mocks.from.mockImplementation((table: string) => {
      const q = { select: vi.fn(() => q), eq: vi.fn(() => q), single: async () => ({ data: mocks.record, error: null }), maybeSingle: async () => ({ data: table === "business_deployments" ? { admin_url: "https://actual.example.test/custom/login", online_store_url: "https://shop.example.test" } : null, error: null }) }
      return q
    })
    const response = await GET(new Request("https://example.test/api/admin/onboarding/access?recordId=record-1"))
    expect(await response.json()).toEqual({ softwareUrl: "https://actual.example.test/custom/login", onlineStoreUrl: "https://shop.example.test" })
    expect(response.headers.get("Cache-Control")).toContain("no-store")
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it("requires permission to look up deployment links", async () => {
    mocks.permission.mockReturnValue(false)
    expect((await GET(new Request("https://example.test/api/admin/onboarding/access?recordId=record-1"))).status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it("does not invent a login link when no deployment exists", async () => {
    mocks.from.mockImplementation(() => {
      const q = { select: () => q, eq: () => q, single: async () => ({ data: mocks.record, error: null }), maybeSingle: async () => ({ data: null, error: null }) }
      return q
    })
    const result = await (await GET(new Request("https://example.test/api/admin/onboarding/access?recordId=record-1"))).json()
    expect(result).toEqual({ softwareUrl: "", onlineStoreUrl: "" })
    expect(JSON.stringify(result)).not.toContain("testbusiness.martpoint")
  })
  it("resolves the business from the onboarding lead when business_id has not been persisted", async () => {
    mocks.record.business_id = null; mocks.record.lead_id = "lead-1"
    const filters: unknown[][] = []
    mocks.from.mockImplementation((table: string) => {
      const q = { select: () => q, eq: (...args: unknown[]) => { filters.push(args); return q }, single: async () => ({ data: mocks.record, error: null }), maybeSingle: async () => ({ data: table === "businesses" ? { id: "resolved-business" } : { admin_url: "https://example.com/exact-entry", online_store_url: null }, error: null }) }
      return q
    })
    const response = await GET(new Request("https://example.test/api/admin/onboarding/access?recordId=record-1"))
    expect(await response.json()).toEqual({ softwareUrl: "https://example.com/exact-entry", onlineStoreUrl: "" })
    expect(filters).toContainEqual(["source_lead_id", "lead-1"])
    expect(filters).toContainEqual(["business_id", "resolved-business"])
  })
})
