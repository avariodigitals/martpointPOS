import { describe, expect, it } from "vitest"
import { hasSyncFlag, scopeUids, describeImapError, LEAD_INBOX_SYNC_FLAG } from "../lib/lead-email-sync"
import { inboundMessageKey } from "../lib/lead-emails-inbound"

describe("hasSyncFlag", () => {
  it("recognises the private imported tag in any casing", () => {
    expect(hasSyncFlag(["\\Seen", LEAD_INBOX_SYNC_FLAG])).toBe(true)
    expect(hasSyncFlag(["$martpointleadmail"])).toBe(true)
    expect(hasSyncFlag(new Set([LEAD_INBOX_SYNC_FLAG]))).toBe(true)
  })

  it("treats unflagged mail as waiting to be imported", () => {
    expect(hasSyncFlag(["\\Seen"])).toBe(false)
    expect(hasSyncFlag(undefined)).toBe(false)
  })
})

describe("scopeUids", () => {
  it("keeps the newest messages, oldest first", () => {
    const uids = Array.from({ length: 450 }, (_, i) => i + 1)
    const scoped = scopeUids(uids)
    expect(scoped).toHaveLength(400)
    expect(scoped[0]).toBe(51)
    expect(scoped[scoped.length - 1]).toBe(450)
  })
})

describe("describeImapError", () => {
  it("explains an unresolvable host, which is nearly always an address in the host field", () => {
    const msg = describeImapError("getaddrinfo ENOTFOUND mail@martpoint.com.ng", "mail@martpoint.com.ng")
    expect(msg).toContain("mail@martpoint.com.ng")
    expect(msg).toContain("mail.martpoint.com.ng")
    expect(msg).toContain("Settings → Email")
  })

  it("recognises the other DNS failure shapes the mail server returns", () => {
    expect(describeImapError("getaddrinfo EBUSY smtp@martpoint.com.ng", "smtp@martpoint.com.ng")).toContain("could not be resolved")
    expect(describeImapError("getaddrinfo ENOTFOUND x", "x")).toContain("could not be resolved")
  })

  it("points at credentials when the failure is authentication", () => {
    const msg = describeImapError("AUTHENTICATIONFAILED", "mail.martpoint.com.ng")
    expect(msg).toContain("app password")
  })

  it("passes an unrecognised error through unchanged", () => {
    expect(describeImapError("socket hang up", "mail.martpoint.com.ng")).toBe("socket hang up")
  })
})

describe("inboundMessageKey", () => {
  it("uses the real Message-ID when the client sent one", () => {
    expect(inboundMessageKey({ messageId: " <abc@mail> ", from: "a@b.com", subject: "Re: Quote", sentAt: null }))
      .toBe("<abc@mail>")
  })

  it("gives a stable key to mail without a Message-ID so it is not filed twice", () => {
    const base = { messageId: null, from: "lead@business.com", subject: "Re: Pricing", sentAt: "2026-10-16T09:00:00.000Z" }
    expect(inboundMessageKey(base)).toBe(inboundMessageKey(base))
    expect(inboundMessageKey({ ...base, sentAt: "2026-10-17T09:00:00.000Z" })).not.toBe(inboundMessageKey(base))
  })

  it("returns null when there is nothing to fingerprint", () => {
    expect(inboundMessageKey({ messageId: null, from: "", subject: "", sentAt: null })).toBeNull()
  })
})
