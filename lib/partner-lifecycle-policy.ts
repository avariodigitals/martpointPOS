export type LifecycleInput = {
  acceptedAt: string | null
  effectiveAt: string | null
  onboardingStatus: string
  complianceStatus: string
  listingStatus: string
  performanceStatus: string
  probationStartAt: string | null
  probationEndAt: string | null
  transitionStartAt: string | null
  lastVerifiedActivityAt: string | null
  responseDeadlineAt: string | null
  reviewHoldUntil: string | null
  extensionUntil: string | null
  verifiedActivityCount: number
  activeAppeal: boolean
  activityDuringResponse: boolean
  hasOpportunityInProgress: boolean
  now: Date
}

export type LifecycleDecision = { decision: string; explanation: string; noticeType?: string; nextReviewAt?: Date; listingStatus?: string; performanceStatus?: string }

const day = 86_400_000
export function addBusinessDays(from: Date, count: number, holidays: string[] = []): Date {
  const result = new Date(from)
  let remaining = count
  const holidaySet = new Set(holidays)
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1)
    const weekday = result.getUTCDay()
    const key = result.toISOString().slice(0, 10)
    if (weekday !== 0 && weekday !== 6 && !holidaySet.has(key)) remaining--
  }
  return result
}

export function decidePartnerLifecycle(input: LifecycleInput, config: { probationDays?: number; activityThreshold?: number; reminderDays?: number; warningDays?: number; suspensionDays?: number; responseBusinessDays?: number; holidays?: string[] } = {}): LifecycleDecision {
  const { now } = input
  if (!input.acceptedAt || !input.effectiveAt || !input.transitionStartAt) return { decision: "NO_CLOCK", explanation: "Policy has not been accepted or legally activated; no legacy inactivity clock is running." }
  if (input.onboardingStatus !== "approved" || input.complianceStatus !== "clear") return { decision: "PREREQUISITES_INCOMPLETE", explanation: "Onboarding approval and clear compliance are required before lifecycle qualification." }
  const threshold = Math.max(1, config.activityThreshold ?? 1)
  if (input.probationStartAt && input.probationEndAt) {
    const start = new Date(input.probationStartAt)
    const end = new Date(input.probationEndAt)
    const elapsed = Math.floor((now.getTime() - start.getTime()) / day)
    if (now < end) {
      if (elapsed >= 75 && input.verifiedActivityCount < threshold) return { decision: "PROBATION_DAY_75", explanation: "Final probation reminder: no qualifying verified activity recorded.", noticeType: "probation_day_75", nextReviewAt: end }
      if (elapsed >= 60 && input.verifiedActivityCount < threshold) return { decision: "PROBATION_DAY_60", explanation: "Progress warning: no qualifying verified activity recorded.", noticeType: "probation_day_60", performanceStatus: "at_risk", nextReviewAt: end }
      if (elapsed >= 30 && input.verifiedActivityCount < threshold) return { decision: "PROBATION_DAY_30", explanation: "Progress reminder: no qualifying verified activity recorded.", noticeType: "probation_day_30", nextReviewAt: end }
      return { decision: "PROBATION", explanation: "Probation remains open; activity and onboarding criteria are being tracked.", performanceStatus: "probation", nextReviewAt: end }
    }
    if (input.verifiedActivityCount >= threshold) return { decision: "ELIGIBLE_FOR_LISTING_REVIEW", explanation: "Activity threshold met; an authorized admin must approve directory publication.", listingStatus: input.listingStatus === "published" ? "published" : "eligible", performanceStatus: "compliant" }
    if (input.hasOpportunityInProgress && input.extensionUntil && new Date(input.extensionUntil) > now) return { decision: "PROBATION_EXTENDED", explanation: "An admin-approved extension is active because an opportunity remains in progress.", performanceStatus: "probation", nextReviewAt: new Date(input.extensionUntil) }
    return { decision: "REVIEW_REQUIRED", explanation: "The 90-day probation ended below the configurable verified-activity threshold; response and human review are required.", noticeType: "probation_day_90", performanceStatus: "review_required", nextReviewAt: addBusinessDays(now, config.responseBusinessDays ?? 10, config.holidays) }
  }
  if (input.listingStatus === "suspended" || input.listingStatus === "hidden") return { decision: "NO_ACTIVE_LISTING_CLOCK", explanation: "No active public listing is subject to rolling inactivity." }
  const last = input.lastVerifiedActivityAt ? new Date(input.lastVerifiedActivityAt) : new Date(input.transitionStartAt)
  const inactiveDays = Math.floor((now.getTime() - last.getTime()) / day)
  const reminder = config.reminderDays ?? 30, warning = config.warningDays ?? 60, suspension = config.suspensionDays ?? 90
  if (input.listingStatus === "pending_suspension") {
    if (input.activeAppeal || input.activityDuringResponse || input.reviewHoldUntil && new Date(input.reviewHoldUntil) > now || input.extensionUntil && new Date(input.extensionUntil) > now) return { decision: "SUSPENSION_HELD", explanation: "New verified activity, an active appeal, admin hold, or extension blocks suspension pending human review." }
    if (!input.responseDeadlineAt || new Date(input.responseDeadlineAt) > now) return { decision: "SUSPENSION_NOTICE_WINDOW", explanation: "The recorded response window has not elapsed." }
    return { decision: "SUSPENSION_DUE", explanation: "The notice was delivered and response deadline elapsed without verified activity or an active hold.", listingStatus: "suspended" }
  }
  if (inactiveDays >= suspension) return { decision: "SUSPENSION_NOTICE", explanation: `No verified qualifying activity for ${inactiveDays} days; suspension requires delivered notice and a 10-business-day response period.`, noticeType: "inactivity_90", listingStatus: "pending_suspension" }
  if (inactiveDays >= warning) return { decision: "INACTIVITY_WARNING", explanation: `No verified qualifying activity for ${inactiveDays} days.`, noticeType: "inactivity_60", performanceStatus: "at_risk" }
  if (inactiveDays >= reminder) return { decision: "INACTIVITY_REMINDER", explanation: `No verified qualifying activity for ${inactiveDays} days.`, noticeType: "inactivity_30" }
  return { decision: "ON_TRACK", explanation: `Verified activity was recorded ${inactiveDays} days ago.`, performanceStatus: "on_track" }
}

export function lifecycleNoticeKey(partnerId: string, noticeType: string, anchor: string): string {
  return `partner-lifecycle:${partnerId}:${noticeType}:${anchor.slice(0, 10)}`
}

export function canAutomaticallyReinstate(input: { enabled: boolean; listingStatus: string; accountStatus: string; onboardingStatus: string; complianceStatus: string; hasNewVerifiedActivity: boolean; hasCompletedReview: boolean; hasOpenAppeal: boolean; hasContractualRestriction: boolean }): boolean {
  return input.enabled && input.listingStatus === "suspended" && input.accountStatus === "enabled" && input.onboardingStatus === "approved" && input.complianceStatus === "clear" && input.hasNewVerifiedActivity && input.hasCompletedReview && !input.hasOpenAppeal && !input.hasContractualRestriction
}
