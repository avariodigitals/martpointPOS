import { beforeEach, describe, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({ result: vi.fn(), notify: vi.fn(), writes: [] as Record<string, unknown>[] }))
vi.mock("@/lib/admin-notifications", () => ({ notifyAllAdmins: m.notify }))
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: () => {
      const query: Record<string, unknown> = {}
      for (const method of ["select", "eq", "in", "ilike"]) query[method] = () => query
      query.insert = (row: Record<string, unknown>) => {
        m.writes.push(row)
        return query
      }
      query.single = () => m.result()
      query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(m.result()).then(resolve, reject)
      return query
    }
  }
}))
import { fileInboundPartnerEmail, isPartnerMailbox } from "@/lib/partner-emails-inbound"
const email = {
  from: "contact@example.test",
  to: "MartPoint Partners <partners@martpoint.com.ng>",
  subject: "Re: Meeting",
  text: "See you tomorrow",
  html: "",
  messageId: "<reply@example.test>",
  provider: "imap"
}
beforeEach(() => {
  vi.clearAllMocks()
  m.result.mockReset()
  m.writes.length = 0
  m.notify.mockResolvedValue(undefined)
})

describe("partner reply filing", () => {
  it("recognizes the exact partners mailbox and rejects lookalike addresses", () => {
    expect(isPartnerMailbox(email.to)).toBe(true)
    expect(isPartnerMailbox("someone@example.test, PARTNERS@martpoint.com.ng")).toBe(true)
    expect(isPartnerMailbox("otherpartners@martpoint.com.ng")).toBe(false)
    expect(isPartnerMailbox("partners@martpoint.com.ng.evil.test")).toBe(false)
  })
  it("leaves other departments' emails alone", async () => {
    expect(await fileInboundPartnerEmail({ ...email, to: "support@martpoint.com.ng" })).toBe(false)
    expect(m.result).not.toHaveBeenCalled()
  })
  it("files an unambiguous saved contact and notifies admins with an Email-tab link", async () => {
    m.result
      .mockResolvedValueOnce({ data: [{ id: "partner-1" }] })
      .mockResolvedValueOnce({ data: [{ partner_id: "partner-1" }] })
      .mockResolvedValueOnce({ data: { id: "reply-1" } })
    expect(await fileInboundPartnerEmail(email)).toBe(true)
    expect(m.writes[0]).toMatchObject({
      partner_id: "partner-1",
      status: "received",
      direction: "inbound",
      body_text: email.text
    })
    expect(m.notify).toHaveBeenCalledWith(
      expect.objectContaining({ deep_link: "/admin/partners/partner-1?tab=email" })
    )
  })
  it("does not guess when the same contact belongs to different partners", async () => {
    m.result
      .mockResolvedValueOnce({ data: [{ id: "partner-1" }, { id: "partner-2" }] })
      .mockResolvedValueOnce({ data: [] })
    expect(await fileInboundPartnerEmail(email)).toBe(false)
    expect(m.writes).toHaveLength(0)
  })
  it("uses a referenced outbound message only when the sender matches its recipient", async () => {
    m.result
      .mockResolvedValueOnce({ data: [{ partner_id: "partner-2", to_email: email.from }] })
      .mockResolvedValueOnce({ data: { id: "reply-1" } })
    expect(
      await fileInboundPartnerEmail({
        ...email,
        inReplyTo: "<partner-123e4567-e89b-42d3-a456-426614174000@martpoint.com.ng>"
      })
    ).toBe(true)
    expect(m.writes[0].partner_id).toBe("partner-2")
  })
  it("does not let another sender attach mail to a referenced partner", async () => {
    m.result
      .mockResolvedValueOnce({ data: [{ partner_id: "partner-2", to_email: "someone-else@example.test" }] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
    expect(
      await fileInboundPartnerEmail({
        ...email,
        inReplyTo: "<partner-123e4567-e89b-42d3-a456-426614174000@martpoint.com.ng>"
      })
    ).toBe(false)
    expect(m.writes).toHaveLength(0)
  })
  it("deduplicates provider retries without duplicate notifications", async () => {
    m.result
      .mockResolvedValueOnce({ data: [{ id: "partner-1" }] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ error: { code: "23505" } })
    expect(await fileInboundPartnerEmail(email)).toBe(false)
    expect(m.notify).not.toHaveBeenCalled()
  })
  it("propagates temporary persistence errors so IMAP can retry instead of marking mail processed", async () => {
    m.result
      .mockResolvedValueOnce({ data: [{ id: "partner-1" }] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ error: { message: "temporarily unavailable" } })
    await expect(fileInboundPartnerEmail(email)).rejects.toMatchObject({ message: "temporarily unavailable" })
  })
})
