import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ settings: vi.fn(), send: vi.fn(), smtp: vi.fn(), insert: vi.fn() }))
vi.mock("@/lib/email", () => ({
  getEmailSettings: m.settings, sendEmail: m.send,
  isSmtpConfigured: () => true, REPLY_TO: { sales: "sales@martpoint.com.ng" }
}))
vi.mock("@/lib/email-smtp", () => ({ sendEmailViaSmtp: m.smtp }))
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: () => ({ insert: m.insert }) }
}))
import { sendLeadEmail } from "@/lib/lead-email-outbound"

const attachment = { filename: "proposal.pdf", content: Buffer.from("%PDF-1.4 test document").toString("base64") }
const input = { leadId: "lead-id", to: "lead@example.test", subject: "Proposal", body: "See attachment", attachments: [attachment] }
beforeEach(() => {
  vi.clearAllMocks()
  m.settings.mockResolvedValue({
    provider: "resend", resendApiKey: "configured", fromEmail: "hello@martpoint.com.ng",
    signatureHtml: "", signature: "", smtp: { user: "sales@martpoint.com.ng", fromEmail: "" }
  })
  m.send.mockResolvedValue(true)
  m.smtp.mockResolvedValue(true)
  m.insert.mockImplementation((row) => ({ select: () => ({ single: async () => ({ data: { id: "email-id", ...row } }) }) }))
})

describe("lead document delivery", () => {
  it("passes intact attachment bytes to the provider and records filenames and sizes without storing file content in the thread", async () => {
    const result = await sendLeadEmail(input)
    expect(result.sent).toBe(true)
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ attachments: [attachment] }))
    expect(result.email?.metadata?.attachments).toEqual([{ filename: "proposal.pdf", size: 22 }])
    expect(JSON.stringify(m.insert.mock.calls[0][0])).not.toContain(attachment.content)
  })
  it("preserves attachments when retrying with the account sender", async () => {
    m.send.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    expect((await sendLeadEmail(input)).sent).toBe(true)
    expect(m.send).toHaveBeenCalledTimes(2)
    for (const [message] of m.send.mock.calls) expect(message.attachments).toEqual([attachment])
  })
  it("passes attachment bytes through the SMTP path", async () => {
    m.settings.mockResolvedValue({
      provider: "brevo", brevoApiKey: "", fromEmail: "hello@martpoint.com.ng",
      signatureHtml: "", signature: "", smtp: { user: "sales@martpoint.com.ng", fromEmail: "" }
    })
    const previousKey = process.env.BREVO_API_KEY
    delete process.env.BREVO_API_KEY
    try {
      expect((await sendLeadEmail(input)).sent).toBe(true)
      expect(m.send).not.toHaveBeenCalled()
      expect(m.smtp).toHaveBeenCalledWith(expect.objectContaining({ attachments: [attachment] }), expect.anything(), expect.any(String), [input.to])
    } finally {
      if (previousKey !== undefined) process.env.BREVO_API_KEY = previousKey
    }
  })
})
