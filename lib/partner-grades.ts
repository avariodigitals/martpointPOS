/* ───────────────────────────  Referral Partner grades (pure)  ───────────────────────────
 * Grades are recognised performance tiers for the REFERRAL partner type only.
 * A grade NEVER changes commission, access or exclusivity — any commercial
 * change must appear in a signed Commission Schedule.
 */

export const REFERRAL_GRADES = ["SILVER", "GOLD", "PLATINUM", "DIAMOND"] as const
export type ReferralGrade = (typeof REFERRAL_GRADES)[number]

export const REFERRAL_GRADE_LABELS: Record<ReferralGrade, string> = {
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  DIAMOND: "Diamond",
}

export interface GradeMetrics {
  /** Trailing-window counters (evaluated over the stated review period). */
  acceptedReferrals6m: number
  acceptedReferrals12m: number
  paidConversions6m: number
  paidConversions12m: number
  /** Percentage 0–100 of submissions that were valid (accepted or progressed). */
  validSubmissionRate: number
  /** Percentage 0–100 of referred cancellations or refunds. */
  refundRate: number
  /** Consecutive quarterly reviews that passed (Gold requires 2). */
  consecutivePassingReviews: number
  /** Conduct gates. */
  misleadingClaim: boolean
  consentFailure: boolean
  /** Activation / orientation state. */
  activeAgreement: boolean
  orientationCompleted: boolean
  daysSinceActivation: number
  /** Diamond only. */
  strategicContribution: boolean
  managementApproved: boolean
}

export const BASE_METRICS: GradeMetrics = {
  acceptedReferrals6m: 0,
  acceptedReferrals12m: 0,
  paidConversions6m: 0,
  paidConversions12m: 0,
  validSubmissionRate: 0,
  refundRate: 0,
  consecutivePassingReviews: 0,
  misleadingClaim: false,
  consentFailure: false,
  activeAgreement: true,
  orientationCompleted: true,
  daysSinceActivation: 0,
  strategicContribution: false,
  managementApproved: false,
}

export interface GradeDecision {
  grade: ReferralGrade
  reasons: string[]
}

export function evaluateReferralGrade(m: GradeMetrics): GradeDecision {
  const reasons: string[] = []
  const cleanConduct = !m.misleadingClaim && !m.consentFailure

  // DIAMOND — 30 accepted + 12 paid in 12 months, ≥90% valid, refunds ≤5%,
  // documented strategic contribution and management approval.
  if (
    m.acceptedReferrals12m >= 30 &&
    m.paidConversions12m >= 12 &&
    m.validSubmissionRate >= 90 &&
    m.refundRate <= 5 &&
    m.strategicContribution &&
    m.managementApproved &&
    cleanConduct
  ) {
    reasons.push("30+ accepted and 12+ paid conversions in 12 months, ≥90% valid, refunds ≤5%, strategic contribution and management approval")
    return { grade: "DIAMOND", reasons }
  }

  // PLATINUM — 15 accepted + 6 paid in 12 months, ≥85% valid, refunds ≤10%.
  if (
    m.acceptedReferrals12m >= 15 &&
    m.paidConversions12m >= 6 &&
    m.validSubmissionRate >= 85 &&
    m.refundRate <= 10 &&
    cleanConduct
  ) {
    reasons.push("15+ accepted and 6+ paid conversions in 12 months, ≥85% valid, refunds ≤10%")
    return { grade: "PLATINUM", reasons }
  }

  // GOLD — 6 accepted + 2 paid in 6 months, ≥80% valid, clean conduct and
  // two consecutive passing quarterly reviews.
  if (
    m.acceptedReferrals6m >= 6 &&
    m.paidConversions6m >= 2 &&
    m.validSubmissionRate >= 80 &&
    m.consecutivePassingReviews >= 2 &&
    cleanConduct
  ) {
    reasons.push("6+ accepted and 2+ paid conversions in 6 months, ≥80% valid, two consecutive passing reviews")
    return { grade: "GOLD", reasons }
  }

  // SILVER — active terms + orientation, and at least one accepted referral in
  // the preceding six months or still within the first 90 days after activation.
  if (
    m.activeAgreement &&
    m.orientationCompleted &&
    (m.acceptedReferrals6m >= 1 || m.daysSinceActivation <= 90)
  ) {
    reasons.push("Active agreement and orientation; baseline referral activity maintained")
    return { grade: "SILVER", reasons }
  }

  reasons.push("Below Silver baseline — agreement, orientation or baseline activity not met")
  return { grade: "SILVER", reasons }
}

/**
 * Promotion and protection rules: a compliance breach blocks promotion and may
 * demote; two consecutive misses normally cause one-grade demotion; six months
 * of inactivity returns the grade to Silver unless an exception is recorded.
 */
export function applyGradeProtections(input: {
  current: ReferralGrade | null
  proposed: ReferralGrade
  complianceBreach: boolean
  inactiveMonths: number
  consecutiveMissedQuarters: number
  approvedException: boolean
}): { grade: ReferralGrade; demoted: boolean; blockedFromPromotion: boolean } {
  const order: ReferralGrade[] = ["SILVER", "GOLD", "PLATINUM", "DIAMOND"]
  const currentIdx = input.current ? order.indexOf(input.current) : 0

  if (input.complianceBreach) {
    return { grade: "SILVER", demoted: currentIdx > 0, blockedFromPromotion: true }
  }
  if (input.inactiveMonths >= 6 && !input.approvedException) {
    return { grade: "SILVER", demoted: currentIdx > 0, blockedFromPromotion: true }
  }
  if (input.consecutiveMissedQuarters >= 2 && currentIdx > 0) {
    return { grade: order[currentIdx - 1], demoted: true, blockedFromPromotion: true }
  }

  const proposedIdx = order.indexOf(input.proposed)
  const capped = input.consecutiveMissedQuarters >= 1 ? Math.min(proposedIdx, currentIdx) : proposedIdx
  return { grade: order[capped], demoted: false, blockedFromPromotion: capped < proposedIdx }
}
