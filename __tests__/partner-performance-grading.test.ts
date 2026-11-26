import { describe, expect, it } from "vitest"
import { CHANNEL_QUALIFYING_COMMISSION_STATUSES, gradeRank, partnerTypesFor } from "@/lib/partner-performance-grading"

describe("Partner type performance tracks", () => {
  it("excludes refunded, reversed and cancelled Channel earnings from qualifying outcomes", () => {
    expect(CHANNEL_QUALIFYING_COMMISSION_STATUSES).toEqual(["ELIGIBLE", "APPROVED", "SCHEDULED", "PAID"])
    expect(CHANNEL_QUALIFYING_COMMISSION_STATUSES).not.toContain("REVERSED")
    expect(CHANNEL_QUALIFYING_COMMISSION_STATUSES).not.toContain("CANCELLED")
  })

  it("gives a combined Channel + Implementation partner two independent grade tracks", () => {
    expect(partnerTypesFor("CHANNEL_IMPLEMENTATION")).toEqual(["CHANNEL", "IMPLEMENTATION"])
  })

  it.each([
    ["CHANNEL", ["CHANNEL"]],
    ["IMPLEMENTATION", ["IMPLEMENTATION"]],
    ["REFERRAL", ["REFERRAL"]],
    ["TECHNOLOGY", ["TECHNOLOGY"]],
    ["PAYMENT", ["PAYMENT"]],
  ] as const)("does not apply another type's rubric to %s", (partnerType, expected) => {
    expect(partnerTypesFor(partnerType)).toEqual(expected)
  })

  it("orders Ungraded, Silver, Gold and Platinum for the review controls", () => {
    expect(["UNGRADED", "SILVER", "GOLD", "PLATINUM"].map(gradeRank)).toEqual([0, 1, 2, 3])
    expect(gradeRank("DIAMOND")).toBeGreaterThan(gradeRank("PLATINUM"))
  })
})
