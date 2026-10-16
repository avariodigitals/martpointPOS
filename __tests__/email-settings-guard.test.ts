import { describe, expect, it } from "vitest"
import { isBadHost, validateEmailSettings } from "../lib/email-settings-guard"

describe("isBadHost", () => {
  it("flags a mail address used as a server name", () => {
    // The exact value that silently killed the lead mailbox.
    expect(isBadHost("mail@martpoint.com.ng")).toBe(true)
    expect(isBadHost("smtp@martpoint.com.ng")).toBe(true)
  })

  it("flags spaces", () => {
    expect(isBadHost("mail.martpoint.com.ng ")).toBe(false)
    expect(isBadHost("mail martpoint.com.ng")).toBe(true)
  })

  it("accepts real server names, and empty is not an error", () => {
    expect(isBadHost("mail.martpoint.com.ng")).toBe(false)
    expect(isBadHost("smtp.yourprovider.com")).toBe(false)
    expect(isBadHost("")).toBe(false)
    expect(isBadHost(undefined)).toBe(false)
  })
})

describe("validateEmailSettings", () => {
  const valid = {
    provider: "resend",
    fromEmail: "MartPoint Sales <sales@martpoint.com.ng>",
    smtp: { host: "mail.martpoint.com.ng", user: "sales@martpoint.com.ng" },
    imap: { host: "mail.martpoint.com.ng", user: "sales@martpoint.com.ng" },
  }

  it("accepts a correct mailbox config", () => {
    expect(validateEmailSettings(valid)).toBeNull()
  })

  it("rejects an IMAP host that is an address, naming the field", () => {
    const reason = validateEmailSettings({ ...valid, imap: { ...valid.imap, host: "mail@martpoint.com.ng" } })
    expect(reason).toContain("IMAP host")
    expect(reason).toContain("mail@martpoint.com.ng")
    expect(reason).toContain("mail.martpoint.com.ng")
  })

  it("rejects an SMTP host that is an address", () => {
    const reason = validateEmailSettings({ ...valid, smtp: { ...valid.smtp, host: "smtp@martpoint.com.ng" } })
    expect(reason).toContain("SMTP host")
  })

  it("rejects an account From that is only a display name", () => {
    const reason = validateEmailSettings({ ...valid, fromEmail: "MartPoint Solutions" })
    expect(reason).toContain("From address")
    expect(reason).toContain("MartPoint Solutions")
  })

  it("allows an empty account From (the default is used)", () => {
    expect(validateEmailSettings({ ...valid, fromEmail: "" })).toBeNull()
  })

  it("does not police the SMTP display-name field, which may legitimately be a name", () => {
    expect(validateEmailSettings({ ...valid, smtp: { ...valid.smtp, fromEmail: "MartPoint Solutions" } })).toBeNull()
  })

  it("leaves an unrelated settings payload alone", () => {
    expect(validateEmailSettings({})).toBeNull()
  })
})
