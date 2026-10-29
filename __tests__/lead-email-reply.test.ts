import { describe, expect, it } from "vitest"
import { leadReplyRecipients } from "@/lib/lead-email-reply"

const original = {
  direction: "inbound", fromEmail: "Lead <lead@example.test>",
  toEmail: "sales@martpoint.com.ng, Manager <manager@example.test>",
  metadata: { cc: "Finance <finance@example.test>, LEAD@example.test, manager@example.test, hello@martpoint.com.ng" },
}
const lead = { email: "lead@example.test", additionalEmail: "owner@example.test" }
const own = ["sales@martpoint.com.ng", "hello@martpoint.com.ng"]
describe("visible lead reply recipients", () => {
  it("shows all To/Cc participants once and excludes our sending accounts", () => {
    expect(leadReplyRecipients(original, lead, own, true)).toEqual({
      to: ["lead@example.test"], cc: ["manager@example.test", "finance@example.test", "owner@example.test"],
    })
  })
  it("does not copy anyone for a normal Reply", () => {
    expect(leadReplyRecipients(original, lead, own, false)).toEqual({ to: ["lead@example.test"], cc: [] })
  })
  it("can resume replies to sent messages with the original participants", () => {
    expect(leadReplyRecipients({ ...original, direction: "outbound", toEmail: "lead@example.test" }, lead, own, true)).toEqual({
      to: ["lead@example.test"], cc: ["finance@example.test", "manager@example.test", "owner@example.test"],
    })
  })
})
