import { describe, it, expect } from "vitest"
import { supportFollowupAction } from "@/lib/support-followup-policy"
import { sanitizeSupportHtml } from "@/lib/support-html"

const day = 86400000
const started = Date.parse("2026-10-20T10:00:00Z")
const resolved = {
  status: "RESOLVED",
  satisfaction_sent_at: new Date(started).toISOString(),
  auto_close_at: new Date(started + 5 * day).toISOString()
}
describe("ticket confirmation and closure", () => {
  it("retries confirmation before scheduling unattended closure", () => {
    expect(
      supportFollowupAction(
        { status: "RESOLVED", auto_close_at: new Date(started).toISOString() },
        started + 6 * day
      )
    ).toBe("confirm")
  })
  it("waits three days before following up", () => {
    expect(supportFollowupAction(resolved, started + 3 * day - 1)).toBeNull()
    expect(supportFollowupAction(resolved, started + 3 * day)).toBe("remind")
  })
  it("requires a reminder even if five days have already elapsed", () => {
    expect(supportFollowupAction(resolved, started + 7 * day)).toBe("remind")
  })
  it("allows five-day closure only after two days to answer the reminder", () => {
    const ticket = { ...resolved, satisfaction_reminder_sent_at: new Date(started + 3 * day).toISOString() }
    expect(supportFollowupAction(ticket, started + 5 * day - 1)).toBeNull()
    expect(supportFollowupAction(ticket, started + 5 * day)).toBe("close")
  })
  it("gives a delayed reminder two days rather than closing immediately", () => {
    expect(
      supportFollowupAction(
        { ...resolved, satisfaction_reminder_sent_at: new Date(started + 6 * day).toISOString() },
        started + 7 * day
      )
    ).toBeNull()
  })
  it("never closes a reopened ticket or a ticket with a customer response", () => {
    for (const status of ["IN_PROGRESS", "WAITING_CUSTOMER", "CLOSED"]) {
      expect(supportFollowupAction({ ...resolved, status }, started + 10 * day)).toBeNull()
    }
    expect(
      supportFollowupAction({ ...resolved, satisfaction_response: "not_satisfied" }, started + 10 * day)
    ).toBeNull()
  })
})
describe("formatted support replies", () => {
  it("preserves formatting and removes executable pasted content", () => {
    const clean = sanitizeSupportHtml(
      '<p>Hello <strong>Ada</strong></p><ul><li>Fixed</li></ul><script>alert(1)</script><img src="https://example.com/logo.png" onerror="alert(2)"><a href="javascript:alert(3)">click</a>'
    )
    expect(clean).toContain("<strong>Ada</strong>")
    expect(clean).toContain("<ul><li>Fixed</li></ul>")
    expect(clean).not.toMatch(/script|onerror|javascript:/)
  })
})
