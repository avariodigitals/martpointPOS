import { describe, expect, it } from "vitest"
import { gradeRank, partnerTypesFor } from "@/lib/partner-performance-grading"

describe("Partner type performance tracks", () => {
  it("gives a combined Channel + Implementation partner two independent grade tracks", () => {
    expect(partnerTypesFor("CHANNEL_IMPLEMENTATION")).toEqual(["CHANNEL", "IMPLEMENTATION"])
  })

  it.each([
    ["CHANNEL", ["CHANNEL"]],
    ["IMPLEMENTATION", ["IMPLEMENTATION"]],
    ["REFERRAL", []],
    ["TECHNOLOGY", []],
    ["PAYMENT", []],
  ] as const)("does not apply another type's rubric to %s", (partnerType, expected) => {
    expect(partnerTypesFor(partnerType)).toEqual(expected)
  })

  it("orders Ungraded, Silver, Gold and Platinum for the review controls", () => {
    expect(["UNGRADED", "SILVER", "GOLD", "PLATINUM"].map(gradeRank)).toEqual([0, 1, 2, 3])
  })
})
