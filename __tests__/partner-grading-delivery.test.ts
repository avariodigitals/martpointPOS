import { describe, expect, it } from "vitest"
import { agreementTypeKeys, earningBasesFor } from "@/lib/partner-agreement-content"
import { BASE_METRICS, evaluateReferralGrade, isGradeReduction } from "@/lib/partner-grades"

describe("partner grading and delivery policy", () => {
  it("keeps every new partner ungraded until delivery is verified", () => {
    const result = evaluateReferralGrade({
      ...BASE_METRICS,
      daysSinceActivation: 120,
      activeAgreement: true,
      orientationCompleted: true,
      acceptedReferrals6m: 3,
      verifiedQualifyingDelivery: false,
    })
    expect(result.grade).toBeNull()
    expect(result.reasons.join(" ")).toContain("verified qualifying business delivery")
  })

  it("does not award before day 90 even with delivery", () => {
    const result = evaluateReferralGrade({
      ...BASE_METRICS,
      daysSinceActivation: 89,
      activeAgreement: true,
      orientationCompleted: true,
      acceptedReferrals6m: 1,
      verifiedQualifyingDelivery: true,
    })
    expect(result.grade).toBeNull()
    expect(result.reasons.join(" ")).toContain("90 calendar days")
  })

  it("makes Silver eligible only after day 90 and verified qualifying delivery", () => {
    const result = evaluateReferralGrade({
      ...BASE_METRICS,
      daysSinceActivation: 90,
      activeAgreement: true,
      orientationCompleted: true,
      acceptedReferrals6m: 1,
      verifiedQualifyingDelivery: true,
    })
    expect(result.grade).toBe("SILVER")
  })

  it("preserves historic grades unless a separately authorized review lowers them", () => {
    expect(isGradeReduction("GOLD", "SILVER")).toBe(true)
    expect(isGradeReduction("SILVER", "GOLD")).toBe(false)
    expect(isGradeReduction("UNGRADED", "SILVER")).toBe(false)
    expect(isGradeReduction(null, "SILVER")).toBe(false)
  })

  it.each([
    ["GOLD", { acceptedReferrals6m: 6, paidConversions6m: 2, validSubmissionRate: 80, consecutivePassingReviews: 2 }],
    ["PLATINUM", { acceptedReferrals12m: 15, paidConversions12m: 6, validSubmissionRate: 85, refundRate: 10 }],
    ["DIAMOND", { acceptedReferrals12m: 30, paidConversions12m: 12, validSubmissionRate: 90, refundRate: 5, strategicContribution: true, managementApproved: true }],
  ] as const)("keeps %s subject to its published thresholds and delivery gate", (grade, metrics) => {
    const result = evaluateReferralGrade({
      ...BASE_METRICS,
      daysSinceActivation: 365,
      activeAgreement: true,
      orientationCompleted: true,
      verifiedQualifyingDelivery: true,
      ...metrics,
    })
    expect(result.grade).toBe(grade)
  })

  it.each([
    ["REFERRAL", ["referral"]],
    ["CHANNEL", ["channel"]],
    ["IMPLEMENTATION", ["implementation"]],
    ["CHANNEL_IMPLEMENTATION", ["channel", "implementation"]],
    ["TECHNOLOGY", ["technology"]],
    ["PAYMENT", ["payment_provider"]],
  ])("retains the applicable schedule set for %s", (partnerType, expected) => {
    expect(agreementTypeKeys(partnerType)).toEqual(expected)
    expect(earningBasesFor(partnerType)).toHaveLength(expected.length)
  })
})
