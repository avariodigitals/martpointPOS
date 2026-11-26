import { describe, expect, it } from "vitest"
import { addBusinessDays, canAutomaticallyReinstate, decidePartnerLifecycle, lifecycleNoticeKey, type LifecycleInput } from "@/lib/partner-lifecycle-policy"

const base: LifecycleInput = {
  acceptedAt: "2026-01-01T00:00:00.000Z", effectiveAt: "2026-01-01T00:00:00.000Z", onboardingStatus: "approved", complianceStatus: "clear",
  listingStatus: "hidden", performanceStatus: "probation", probationStartAt: "2026-01-01T00:00:00.000Z", probationEndAt: "2026-04-01T00:00:00.000Z",
  transitionStartAt: "2026-01-01T00:00:00.000Z", lastVerifiedActivityAt: null, responseDeadlineAt: null, reviewHoldUntil: null, extensionUntil: null,
  verifiedActivityCount: 0, activeAppeal: false, activityDuringResponse: false, hasOpportunityInProgress: false, now: new Date("2026-01-01T00:00:00.000Z"),
}
const at = (patch: Partial<LifecycleInput>) => decidePartnerLifecycle({ ...base, ...patch })

describe("partner lifecycle policy rules", () => {
  it("does not backdate clocks before policy acceptance and effective transition", () => {
    expect(at({ acceptedAt: null }).decision).toBe("NO_CLOCK")
    expect(at({ transitionStartAt: null }).decision).toBe("NO_CLOCK")
  })
  it("requires onboarding approval and clear compliance before qualification", () => {
    expect(at({ onboardingStatus: "incomplete" }).decision).toBe("PREREQUISITES_INCOMPLETE")
    expect(at({ complianceStatus: "under_review" }).decision).toBe("PREREQUISITES_INCOMPLETE")
  })
  it("fires day 30, 60 and 75 reminders only below activity threshold", () => {
    expect(at({ now: new Date("2026-01-31T00:00:00Z") }).noticeType).toBe("probation_day_30")
    expect(at({ now: new Date("2026-03-02T00:00:00Z") }).noticeType).toBe("probation_day_60")
    expect(at({ now: new Date("2026-03-17T00:00:00Z") }).noticeType).toBe("probation_day_75")
    expect(at({ now: new Date("2026-03-17T00:00:00Z"), verifiedActivityCount: 1 }).noticeType).toBeUndefined()
  })
  it("marks day 90 review below threshold, and eligibility above it", () => {
    const day90 = new Date("2026-04-01T00:00:00Z")
    expect(at({ now: day90 }).decision).toBe("REVIEW_REQUIRED")
    expect(at({ now: day90, verifiedActivityCount: 1 }).decision).toBe("ACTIVITY_REVIEW_MET_DELIVERY_REQUIRED")
    expect(at({ now: day90, verifiedActivityCount: 1, directoryEligible: true }).decision).toBe("ELIGIBLE_FOR_LISTING_REVIEW")
  })
  it("honours an operator-configured qualifying activity threshold", () => {
    const day90 = new Date("2026-04-01T00:00:00Z")
    expect(decidePartnerLifecycle({ ...base, now: day90, verifiedActivityCount: 1 }, { activityThreshold: 2 }).decision).toBe("REVIEW_REQUIRED")
    expect(decidePartnerLifecycle({ ...base, now: day90, verifiedActivityCount: 2 }, { activityThreshold: 2 }).decision).toBe("ACTIVITY_REVIEW_MET_DELIVERY_REQUIRED")
    expect(decidePartnerLifecycle({ ...base, now: day90, verifiedActivityCount: 2, directoryEligible: true }, { activityThreshold: 2 }).decision).toBe("ELIGIBLE_FOR_LISTING_REVIEW")
  })
  it("does not qualify a probation extension without an in-progress opportunity and admin extension", () => {
    expect(at({ now: new Date("2026-04-02T00:00:00Z"), hasOpportunityInProgress: true }).decision).toBe("REVIEW_REQUIRED")
    expect(at({ now: new Date("2026-04-02T00:00:00Z"), hasOpportunityInProgress: true, extensionUntil: "2026-04-10T00:00:00Z" }).decision).toBe("PROBATION_EXTENDED")
  })
  it("uses verified activity for rolling 30/60/90 day notices, not login signals", () => {
    const rolling = { ...base, probationStartAt: null, probationEndAt: null, listingStatus: "published", transitionStartAt: "2026-01-01T00:00:00Z" }
    expect(decidePartnerLifecycle({ ...rolling, now: new Date("2026-01-31T00:00:00Z") }).noticeType).toBe("inactivity_30")
    expect(decidePartnerLifecycle({ ...rolling, now: new Date("2026-03-02T00:00:00Z") }).noticeType).toBe("inactivity_60")
    expect(decidePartnerLifecycle({ ...rolling, now: new Date("2026-04-01T00:00:00Z") }).noticeType).toBe("inactivity_90")
    expect(decidePartnerLifecycle({ ...rolling, lastVerifiedActivityAt: "2026-03-20T00:00:00Z", now: new Date("2026-04-01T00:00:00Z") }).decision).toBe("ON_TRACK")
  })
  it("keeps pending suspension visible during notice response time and blocks suspension for appeal, extension or hold", () => {
    const pending = { ...base, probationStartAt: null, probationEndAt: null, listingStatus: "pending_suspension", transitionStartAt: "2026-01-01T00:00:00Z", responseDeadlineAt: "2026-04-10T00:00:00Z" }
    expect(decidePartnerLifecycle({ ...pending, now: new Date("2026-04-12T00:00:00Z"), responseDeadlineAt: null }).decision).toBe("SUSPENSION_NOTICE_WINDOW")
    expect(decidePartnerLifecycle({ ...pending, now: new Date("2026-04-05T00:00:00Z") }).decision).toBe("SUSPENSION_NOTICE_WINDOW")
    expect(decidePartnerLifecycle({ ...pending, now: new Date("2026-04-12T00:00:00Z"), activeAppeal: true }).decision).toBe("SUSPENSION_HELD")
    expect(decidePartnerLifecycle({ ...pending, now: new Date("2026-04-12T00:00:00Z"), extensionUntil: "2026-04-20T00:00:00Z" }).decision).toBe("SUSPENSION_HELD")
    expect(decidePartnerLifecycle({ ...pending, now: new Date("2026-04-12T00:00:00Z"), reviewHoldUntil: "2026-04-20T00:00:00Z" }).decision).toBe("SUSPENSION_HELD")
    expect(decidePartnerLifecycle({ ...pending, now: new Date("2026-04-12T00:00:00Z"), activityDuringResponse: true }).decision).toBe("SUSPENSION_HELD")
    expect(decidePartnerLifecycle({ ...pending, now: new Date("2026-04-12T00:00:00Z") }).listingStatus).toBe("suspended")
  })
  it("uses recorded business days and Nigerian holiday dates for response windows", () => {
    expect(addBusinessDays(new Date("2026-01-02T00:00:00Z"), 2, ["2026-01-05"]).toISOString().slice(0, 10)).toBe("2026-01-07")
  })
  it("creates deterministic notice idempotency keys", () => {
    expect(lifecycleNoticeKey("p1", "inactivity_30", "2026-01-01T12:00:00Z")).toBe("partner-lifecycle:p1:inactivity_30:2026-01-01")
  })
  it("automatically reinstates only with the flag, verified new activity, completed review, and no holds", () => {
    const input = { enabled: true, listingStatus: "suspended", accountStatus: "enabled", onboardingStatus: "approved", complianceStatus: "clear", hasNewVerifiedActivity: true, hasCompletedReview: true, hasOpenAppeal: false, hasContractualRestriction: false }
    expect(canAutomaticallyReinstate(input)).toBe(true)
    expect(canAutomaticallyReinstate({ ...input, enabled: false })).toBe(false)
    expect(canAutomaticallyReinstate({ ...input, hasOpenAppeal: true })).toBe(false)
    expect(canAutomaticallyReinstate({ ...input, hasContractualRestriction: true })).toBe(false)
    expect(canAutomaticallyReinstate({ ...input, hasCompletedReview: false })).toBe(false)
  })
})
