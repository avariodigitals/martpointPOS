import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "crypto"
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  context: vi.fn(),
  actor: vi.fn(),
  send: vi.fn(),
  smtp: vi.fn(),
  settings: vi.fn(),
  result: vi.fn(),
  audit: vi.fn(),
  operations: [] as { table: string; method: string; args: unknown[] }[]
}))
vi.mock("@/lib/admin-auth", () => ({ authorizeAdmin: m.auth, getUserById: m.actor }))
vi.mock("@/lib/admin-types", () => ({ authorize: () => true }))
vi.mock("@/lib/audit", () => ({ recordAudit: m.audit, auditContextFromSession: () => ({}) }))
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }))
vi.mock("@/lib/email", () => ({
  REPLY_TO: { partners: "MartPoint Partners <partners@martpoint.com.ng>" },
  getEmailSettings: m.settings,
  sendEmail: m.send
}))
vi.mock("@/lib/email-smtp", () => ({ sendEmailViaSmtp: m.smtp }))
vi.mock("@/lib/settings", () => ({ getEmailFooterSettings: async () => ({}) }))
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: (table: string) => {
      const query: Record<string, unknown> = {}
      for (const method of ["select", "eq", "order", "range", "insert", "update"])
        query[method] = (...args: unknown[]) => {
          m.operations.push({ table, method, args })
          return query
        }
      for (const method of ["single", "maybeSingle"]) query[method] = () => m.result()
      query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(m.result()).then(resolve, reject)
      return query
    }
  }
}))
vi.mock("@/lib/partner-email", async (original) => ({
  ...(await original<typeof import("@/lib/partner-email")>()),
  loadPartnerEmailContext: m.context
}))

import { GET, POST } from "@/app/api/admin/partners/[partnerId]/emails/route"
import { POST as preview } from "@/app/api/admin/partners/[partnerId]/emails/preview/route"
const partnerId = "123e4567-e89b-42d3-a456-426614174000"
const input = {
  recipient: "partner@example.test",
  subject: "Meeting tomorrow",
  bodyHtml: "<p>Hello <strong>there</strong></p>",
  requestId: "223e4567-e89b-42d3-a456-426614174000"
}
const params = { params: Promise.resolve({ partnerId }) }
const request = (body = input) =>
  new Request(`http://localhost/api/admin/partners/${partnerId}/emails`, {
    method: "POST",
    body: JSON.stringify(body)
  })
const row = {
  id: "email-id",
  direction: "outbound",
  from_email: "sender@example.test",
  to_email: input.recipient,
  subject: input.subject,
  body_text: "Hello there",
  status: "pending",
  created_at: "2026-10-28T12:00:00Z"
}

beforeEach(() => {
  vi.clearAllMocks()
  m.operations.length = 0
  m.auth.mockResolvedValue({
    session: { userId: "admin-id", name: "Admin", username: "admin", role: "Admin" },
    denied: null
  })
  m.actor.mockResolvedValue({ name: "Jane", signatureHtml: "<p>Jane's personal signature</p>" })
  m.context.mockResolvedValue({
    partner: { id: partnerId },
    recipients: [{ email: input.recipient, label: "Partner contact" }]
  })
  m.send.mockResolvedValue(true)
  m.smtp.mockResolvedValue(true)
  m.settings.mockResolvedValue({ provider: "resend", fromEmail: "sender@example.test" })
  m.audit.mockResolvedValue(undefined)
  m.result.mockReset()
})

describe("partner email routes", () => {
  it("requires partner view permission for history and manage permission for sending and preview", async () => {
    m.auth.mockResolvedValue({ session: null, denied: new Response("Forbidden", { status: 403 }) })
    expect((await GET(new Request("http://localhost"), params)).status).toBe(403)
    expect((await POST(request(), params)).status).toBe(403)
    expect((await preview(request(), params)).status).toBe(403)
    expect(m.auth.mock.calls).toEqual([
      ["partners", "view"],
      ["partners", "manage"],
      ["partners", "manage"]
    ])
    expect(m.context).not.toHaveBeenCalled()
    expect(m.send).not.toHaveBeenCalled()
  })
  it("rejects an email address not saved under this partner", async () => {
    m.result.mockResolvedValueOnce({ data: null, error: null })
    const response = await POST(request({ ...input, recipient: "stranger@example.test" }), params)
    expect(response.status).toBe(400)
    expect(m.send).not.toHaveBeenCalled()
  })
  it("rejects blank rich text and newline-injected subjects", async () => {
    expect((await POST(request({ ...input, bodyHtml: "<p><br></p>" }), params)).status).toBe(400)
    expect(
      (await POST(request({ ...input, subject: "Hello\r\nBcc: hidden@example.test" }), params)).status
    ).toBe(400)
    expect(m.send).not.toHaveBeenCalled()
  })
  it("never sends when the attempt cannot be saved", async () => {
    m.result
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ error: { message: "table unavailable" } })
    expect((await POST(request(), params)).status).toBe(500)
    expect(m.send).not.toHaveBeenCalled()
  })
  it("saves before sending, uses only the chosen recipient, and records the personal signature and provider acceptance", async () => {
    m.result
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: row })
      .mockResolvedValueOnce({ data: { ...row, status: "accepted" } })
    m.send.mockImplementation(async () => {
      expect(m.operations.some((op) => op.method === "insert")).toBe(true)
      return true
    })
    const response = await POST(request(), params)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.sent).toBe(true)
    expect(data.email.status).toBe("accepted")
    expect(m.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: input.recipient,
        useRouteRecipients: false,
        replyTo: "MartPoint Partners <partners@martpoint.com.ng>",
        html: expect.stringContaining("Jane's personal signature")
      })
    )
    const saved = m.operations.find((op) => op.method === "insert")?.args[0]
    expect(saved).toMatchObject({
      partner_id: partnerId,
      status: "pending",
      sent_by: "admin-id",
      sent_by_name: "Jane"
    })
    expect(m.audit).toHaveBeenCalled()
  })
  it("records provider failure without claiming successful delivery", async () => {
    m.result
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: row })
      .mockResolvedValueOnce({ data: { ...row, status: "failed" } })
    m.send.mockResolvedValue(false)
    const data = await (await POST(request(), params)).json()
    expect(data.sent).toBe(false)
    expect(data.email.status).toBe("failed")
    expect(data.warning).toMatch(/provider/)
  })
  it("uses the configured SMTP mailbox without falling through to an API provider", async () => {
    m.settings.mockResolvedValue({
      provider: "smtp", fromEmail: "api@example.test",
      smtp: { fromEmail: "mailbox@example.test", user: "login@example.test" }
    })
    m.result
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: row })
      .mockResolvedValueOnce({ data: { ...row, status: "accepted" } })
    const data = await (await POST(request(), params)).json()
    expect(data.sent).toBe(true)
    expect(m.send).not.toHaveBeenCalled()
    expect(m.smtp).toHaveBeenCalledWith(
      expect.objectContaining({ to: input.recipient, replyTo: "MartPoint Partners <partners@martpoint.com.ng>" }),
      expect.objectContaining({ provider: "smtp" }),
      "mailbox@example.test", [input.recipient]
    )
    expect(m.operations.find((op) => op.method === "insert")?.args[0]).toMatchObject({
      from_email: "mailbox@example.test", provider: "smtp"
    })
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ entityType: "partner" }))
  })
  it("does not resend an identical network retry", async () => {
    const request_hash = createHash("sha256")
      .update(JSON.stringify(["admin-id", input.recipient, input.subject, input.bodyHtml]))
      .digest("hex")
    m.result.mockResolvedValueOnce({ data: { ...row, status: "accepted", request_hash } })
    expect((await (await POST(request(), params)).json()).sent).toBe(true)
    expect(m.send).not.toHaveBeenCalled()
  })
  it("refuses to reuse a request id for different content", async () => {
    m.result.mockResolvedValueOnce({ data: { ...row, request_hash: "different" } })
    expect((await POST(request(), params)).status).toBe(409)
    expect(m.send).not.toHaveBeenCalled()
  })
  it("does not send a concurrent duplicate attempt", async () => {
    m.result.mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({ error: { code: "23505" } })
    expect((await POST(request(), params)).status).toBe(409)
    expect(m.send).not.toHaveBeenCalled()
  })
  it("warns if the final history status cannot be updated and does not ask the user to resend", async () => {
    m.result
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: row })
      .mockResolvedValueOnce({ error: { message: "offline" } })
    const data = await (await POST(request(), params)).json()
    expect(data.sent).toBe(true)
    expect(data.warning).toContain("Do not resend")
  })
  it("scopes paginated history to the selected partner", async () => {
    m.result.mockResolvedValueOnce({ data: [row] })
    const data = await (await GET(new Request("http://localhost?offset=50"), params)).json()
    expect(data.emails).toHaveLength(1)
    expect(data.canSend).toBe(true)
    expect(m.operations).toContainEqual({
      table: "partner_emails",
      method: "eq",
      args: ["partner_id", partnerId]
    })
    expect(m.operations).toContainEqual({ table: "partner_emails", method: "range", args: [50, 100] })
  })
  it("previews the same personal signature and banner without sending mail", async () => {
    const data = await (await preview(request(), params)).json()
    expect(data.html).toContain("Jane's personal signature")
    expect(data.html).toContain("footerbanner.png")
    expect(m.send).not.toHaveBeenCalled()
  })
  it("keeps the normal email preview and sent document identical", async () => {
    const styledInput = { ...input, layout: "normal" }
    const previewData = await (await preview(request(styledInput), params)).json()
    m.result.mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({ data: row }).mockResolvedValueOnce({ data: { ...row, status: "accepted" } })
    expect((await POST(request(styledInput), params)).status).toBe(200)
    expect(m.send.mock.calls[0][0].html).toBe(previewData.html)
    expect(previewData.html).toContain('data-martpoint-layout="normal"')
    expect(previewData.html).not.toContain("linear-gradient")
  })
})
