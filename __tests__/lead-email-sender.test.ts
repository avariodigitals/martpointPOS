import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/admin-mailbox-correspondence", () => ({ mirrorSentMessageToMailbox: vi.fn() }))

import { resolveLeadSenders } from "../lib/lead-email-outbound"
import type { EmailSettings } from "../lib/email"

function settings(overrides: Partial<EmailSettings> = {}): EmailSettings {
  return {
    provider: "resend",
    resendApiKey: "",
    brevoApiKey: "",
    fromEmail: "",
    notifyEmail: "",
    signature: "",
    signatureHtml: "",
    profileSignatureHtmlTemplate: "",
    smtp: { host: "", port: 465, secure: true, user: "", pass: "", fromEmail: "" },
    imap: { host: "", port: 993, secure: true, user: "", pass: "", mailbox: "INBOX" },
    routes: {},
    ...overrides,
  }
}

describe("resolveLeadSenders", () => {
  it("uses the public account sender when the SMTP From field holds only a display name", () => {
    const s = settings({ fromEmail: "MartPoint <hello@martpoint.com.ng>", smtp: { host: "smtp.martpoint.com.ng", port: 465, secure: true, user: "sales@martpoint.com.ng", pass: "x", fromEmail: "MartPoint Solutions" } })
    expect(resolveLeadSenders(s).from).toBe("MartPoint <hello@martpoint.com.ng>")
  })

  it("uses the address inside angle brackets and keeps the name", () => {
    const s = settings({ fromEmail: "MartPoint Solutions <hello@martpoint.com.ng>", smtp: { ...settings().smtp, user: "sales@martpoint.com.ng", fromEmail: "MartPoint Sales <sales@martpoint.com.ng>" } })
    expect(resolveLeadSenders(s).from).toBe("MartPoint Solutions <hello@martpoint.com.ng>")
  })

  it("falls back to the account sender when no mailbox address exists", () => {
    const s = settings({ fromEmail: "MartPoint <hello@martpoint.com.ng>", smtp: { ...settings().smtp, fromEmail: "MartPoint Solutions" } })
    const r = resolveLeadSenders(s)
    expect(r.from).toBe("MartPoint <hello@martpoint.com.ng>")
    expect(r.replyTo).toBe("MartPoint Sales <sales@martpoint.com.ng>")
  })

  it("keeps the public sender and routes replies to Sales", () => {
    const s = settings({ fromEmail: "MartPoint <hello@martpoint.com.ng>", smtp: { ...settings().smtp, user: "sales@martpoint.com.ng" } })
    const r = resolveLeadSenders(s)
    expect(r.from).toBe("MartPoint <hello@martpoint.com.ng>")
    expect(r.replyTo).toBe("MartPoint Sales <sales@martpoint.com.ng>")
  })
})

describe("send as a salesperson", () => {
  const mailbox = settings({
    fromEmail: "MartPoint Solutions <hello@martpoint.com.ng>",
    smtp: { host: "mail.martpoint.com.ng", port: 465, secure: true, user: "sales@martpoint.com.ng", pass: "x", fromEmail: "MartPoint Solutions" },
  })

  it("fronts the public address with the sender's name", () => {
    expect(resolveLeadSenders(mailbox, "Ralph").from).toBe("Ralph <hello@martpoint.com.ng>")
  })

  it("keeps replies in the one mailbox the IMAP sync reads, whoever sends", () => {
    const r = resolveLeadSenders(mailbox, "Ada")
    expect(r.replyTo).toBe("MartPoint Sales <sales@martpoint.com.ng>")
    expect(r.replyTo).toContain("sales@martpoint.com.ng")
  })

  it("falls back to the configured display name when no sender is given", () => {
    expect(resolveLeadSenders(mailbox).from).toBe("MartPoint Solutions <hello@martpoint.com.ng>")
    expect(resolveLeadSenders(mailbox, "   ").from).toBe("MartPoint Solutions <hello@martpoint.com.ng>")
  })
})
