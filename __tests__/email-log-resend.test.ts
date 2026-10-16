import { describe, expect, it } from "vitest"
import { buildResendPayload } from "@/lib/email"
import { messageFromPayload, resendPayloadFromLog } from "@/lib/email-log-resend"

/* ─────────────  Resending a failed email from the logs screen  ─────────────
 * The log row is the only thing the resend route can read, so these tests pin
 * down exactly which rows are replayable and what a replay actually sends.
 */

const storedPayload = {
  to: "sales@martpoint.com.ng",
  cc: "ops@martpoint.com.ng",
  subject: "New Lead: Ajibade YUSUF",
  text: "A new lead came in.",
  html: "<p>A new lead came in.</p>",
  from: "MartPoint <hello@martpoint.com.ng>",
  replyTo: "MartPoint Sales <sales@martpoint.com.ng>",
  route: "lead_submission",
  skipBranding: false,
}

describe("resendPayloadFromLog", () => {
  it("reads back a message stored by sendEmail", () => {
    const ready = resendPayloadFromLog({ metadata: { resend: storedPayload } })
    expect(ready.ok).toBe(true)
    if (!ready.ok) return
    expect(ready.payload).toMatchObject({
      to: "sales@martpoint.com.ng",
      cc: "ops@martpoint.com.ng",
      subject: "New Lead: Ajibade YUSUF",
      route: "lead_submission",
      skipBranding: false,
    })
  })

  it("refuses entries logged before resend history existed", () => {
    const ready = resendPayloadFromLog({ metadata: { html: true, route: "lead_submission" } })
    expect(ready.ok).toBe(false)
    if (ready.ok) return
    expect(ready.reason).toMatch(/predates resend history/i)
  })

  it("refuses a null or missing metadata blob", () => {
    expect(resendPayloadFromLog(null).ok).toBe(false)
    expect(resendPayloadFromLog({ metadata: null }).ok).toBe(false)
  })

  it("refuses a payload with no usable recipient", () => {
    const ready = resendPayloadFromLog({ metadata: { resend: { ...storedPayload, to: "" } } })
    expect(ready.ok).toBe(false)
    if (ready.ok) return
    expect(ready.reason).toMatch(/no usable recipient/i)
  })

  it("refuses a payload with no subject", () => {
    const ready = resendPayloadFromLog({ metadata: { resend: { ...storedPayload, subject: "   " } } })
    expect(ready.ok).toBe(false)
    if (ready.ok) return
    expect(ready.reason).toMatch(/no subject/i)
  })

  it("survives a payload with wrong types without throwing", () => {
    const ready = resendPayloadFromLog({
      metadata: { resend: { to: 123, subject: null, text: {}, html: [] } },
    })
    expect(ready.ok).toBe(false)
  })

  it("coerces missing optional fields to null instead of undefined", () => {
    const ready = resendPayloadFromLog({
      metadata: { resend: { ...storedPayload, from: "", replyTo: undefined, route: null } },
    })
    expect(ready.ok).toBe(true)
    if (!ready.ok) return
    expect(ready.payload.from).toBeNull()
    expect(ready.payload.replyTo).toBeNull()
    expect(ready.payload.route).toBeNull()
  })
})

describe("buildResendPayload", () => {
  it("stores the recipients as they were actually resolved", () => {
    const payload = buildResendPayload(
      { subject: "Hi", text: "body", html: "<p>body</p>", route: "lead_submission" },
      ["sales@martpoint.com.ng"],
      ["ops@martpoint.com.ng"],
    )
    expect(payload).toMatchObject({
      to: "sales@martpoint.com.ng",
      cc: "ops@martpoint.com.ng",
      route: "lead_submission",
      skipBranding: false,
    })
  })

  it("refuses to make a resendable payload when files were attached", () => {
    const payload = buildResendPayload(
      { subject: "Invoice", text: "body", attachments: [{ filename: "invoice.pdf", content: "AAA" }] },
      ["client@example.com"],
      [],
    )
    expect(payload).toBeNull()
  })

  it("round-trips: what sendEmail stored is what the resend route replays", () => {
    const stored = buildResendPayload(
      { subject: "New Lead", text: "plain", html: "<p>rich</p>", replyTo: "Sales <sales@martpoint.com.ng>" },
      ["sales@martpoint.com.ng"],
      [],
    )
    expect(stored).not.toBeNull()
    const ready = resendPayloadFromLog({ metadata: { resend: stored } })
    expect(ready.ok).toBe(true)
    if (!ready.ok) return
    expect(messageFromPayload(ready.payload).subject).toBe("New Lead")
    expect(messageFromPayload(ready.payload).html).toBe("<p>rich</p>")
  })
})

describe("messageFromPayload", () => {
  it("sends the same recipients and subject, and re-brands rather than reusing old HTML", () => {
    const ready = resendPayloadFromLog({ metadata: { resend: storedPayload } })
    expect(ready.ok).toBe(true)
    if (!ready.ok) return
    const message = messageFromPayload(ready.payload)
    expect(message.to).toBe("sales@martpoint.com.ng")
    expect(message.cc).toBe("ops@martpoint.com.ng")
    expect(message.subject).toBe("New Lead: Ajibade YUSUF")
    // skipBranding:false means sendEmail wraps it in the current footer, so a
    // resend picks up today's branding rather than a stale copy.
    expect(message.skipBranding).toBe(false)
    expect(message.html).toBe(storedPayload.html)
  })

  it("drops blank optional fields so they are not sent as empty headers", () => {
    const message = messageFromPayload({
      to: "a@b.com",
      cc: "",
      subject: "Hi",
      text: "body",
      html: "",
      from: null,
      replyTo: null,
      route: null,
      skipBranding: true,
    })
    expect(message.cc).toBeUndefined()
    expect(message.html).toBeUndefined()
    expect(message.from).toBeUndefined()
    expect(message.replyTo).toBeUndefined()
    expect(message.route).toBeUndefined()
    expect(message.skipBranding).toBe(true)
  })
})
