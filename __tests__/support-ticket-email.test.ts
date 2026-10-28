import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("@/lib/admin-auth", () => ({ getUserById: vi.fn() }))
vi.mock("@/lib/email", () => ({
  getEmailSettings: vi.fn(),
  sendEmail: vi.fn(),
  REPLY_TO: { support: "support@martpoint.com.ng" }
}))
vi.mock("@/lib/supabase", () => ({ supabase: {}, isSupabaseConfigured: () => true }))
import { getUserById } from "@/lib/admin-auth"
import { getEmailSettings, sendEmail } from "@/lib/email"
import { sendTicketRequesterEmail } from "@/lib/support-ticket-email"

const ticket = {
  id: "ticket-1",
  ticket_number: "MPS-2026-00001",
  subject: "Billing issue",
  requester_name: "Ada",
  requester_email: "ada@example.com"
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getEmailSettings).mockResolvedValue({
    fromEmail: "support@martpoint.com.ng",
    signatureHtml: "<p>Global signature</p>"
  } as Awaited<ReturnType<typeof getEmailSettings>>)
  vi.mocked(getUserById).mockResolvedValue({
    name: "Ralph",
    username: "ralph",
    signatureHtml: "<p>Ralph’s own signature</p>"
  } as NonNullable<Awaited<ReturnType<typeof getUserById>>>)
  vi.mocked(sendEmail).mockResolvedValue(true)
})
describe("support update emails", () => {
  it("uses the authenticated actor’s current signature and preserves rich formatting", async () => {
    const result = await sendTicketRequesterEmail({
      ticket,
      actorId: "logged-in-user",
      message: "Invoice updated",
      messageHtml: "<p>Invoice <strong>updated</strong></p>"
    })
    expect(getUserById).toHaveBeenCalledWith("logged-in-user")
    expect(result.sent).toBe(true)
    const email = vi.mocked(sendEmail).mock.calls[0][0]
    expect(email.to).toBe("ada@example.com")
    expect(email.useRouteRecipients).toBe(false)
    expect(email.html).toContain("<strong>updated</strong>")
    expect(email.html).toContain("Ralph’s own signature")
    expect(email.html).not.toContain("Global signature")
    expect(email.replyTo).toBe("support@martpoint.com.ng")
    expect(email.headers?.["Message-ID"]).toContain("support-ticket-1-")
  })
  it("keeps a provider rejection visible as failure", async () => {
    vi.mocked(sendEmail).mockResolvedValue(false)
    const result = await sendTicketRequesterEmail({ ticket, message: "Update", actorId: "logged-in-user" })
    expect(result.sent).toBe(false)
    expect(result.status).toBe("failed")
    expect(result.error).toMatch(/provider did not accept/)
  })
  it("does not silently redirect a missing requester to the general notification list", async () => {
    const result = await sendTicketRequesterEmail({
      ticket: { ...ticket, requester_email: "" },
      message: "Update"
    })
    expect(result.status).toBe("no_recipient")
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
