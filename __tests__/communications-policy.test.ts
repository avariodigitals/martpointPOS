import { describe, expect, it } from "vitest"
import { communicationRequestId } from "@/lib/communication-idempotency"
import { communicationStopReason, communicationWorkflowSchema, mergeCommunicationTemplate, normalizeCommunicationPhone, smsLength } from "@/lib/communications-policy"
describe("direct communications policy", () => {
  it("normalizes Nigerian and international phone numbers without accepting malformed destinations", () => {
    expect(normalizeCommunicationPhone("0803 123 4567")).toBe("+2348031234567")
    expect(normalizeCommunicationPhone("2348031234567")).toBe("+2348031234567")
    expect(normalizeCommunicationPhone("+44 7700 900123")).toBe("+447700900123")
    for (const value of ["", "hello", "+23412", "+2348031234567, +2348031111111"]) expect(normalizeCommunicationPhone(value)).toBe("")
  })
  it("counts GSM extension characters and Unicode segments", () => {
    expect(smsLength("a".repeat(160)).segments).toBe(1)
    expect(smsLength("a".repeat(161)).segments).toBe(2)
    expect(smsLength("^".repeat(81)).segments).toBe(2)
    expect(smsLength("ọ".repeat(71))).toMatchObject({ encoding: "Unicode", segments: 2 })
  })
  it("allows each workflow to choose automatic sending or staff approval", () => {
    const workflow = { name: "Follow up", channel: "email", mode: "ai", instructions: "Help the lead", trigger: "new_lead" }
    expect(communicationWorkflowSchema.parse(workflow)).toMatchObject({ enabled: false, require_approval: false, stop_on_reply: true })
    expect(communicationWorkflowSchema.parse({ ...workflow, require_approval: true }).require_approval).toBe(true)
    expect(communicationWorkflowSchema.safeParse({ ...workflow, max_steps: 11 }).success).toBe(false)
    expect(communicationWorkflowSchema.safeParse({ ...workflow, mode: "template" }).success).toBe(false)
  })
  it("stops closed, converted, paused, suppressed and replied leads", () => {
    for (const input of [{ status: "Won" }, { status: "Lost" }, { status: "New", converted: true }, { status: "New", reminders_paused: true }, { status: "New", suppressed: true }, { status: "New", stopOnReply: true, lastOutbound: "2026-10-30", lastInbound: "2026-10-31" }]) expect(communicationStopReason(input)).toBeTruthy()
    expect(communicationStopReason({ status: "New", stopOnReply: true, enrolledAt: "2026-10-30", lastInbound: "2026-10-31" })).toBeNull()
    expect(communicationStopReason({ status: "New", stopOnReply: false, lastOutbound: "2026-10-30", lastInbound: "2026-10-31" })).toBeNull()
  })
  it("personalizes names without interpreting arbitrary instructions or changing destinations", () => {
    expect(mergeCommunicationTemplate("Hi {{name}} at {{business}}, about {{product}}", { full_name: "Ada", business_name: "Shop", product_interest: "Retail" })).toBe("Hi Ada at Shop, about Retail")
  })
  it("makes repeated batch submissions idempotent per lead", () => {
    expect(communicationRequestId("batch", "lead-a")).toBe(communicationRequestId("batch", "lead-a"))
    expect(communicationRequestId("batch", "lead-a")).not.toBe(communicationRequestId("batch", "lead-b"))
    expect(communicationRequestId("batch", "lead-a")).toMatch(/^[0-9a-f-]{14}4[0-9a-f-]{21}$/)
  })
})
