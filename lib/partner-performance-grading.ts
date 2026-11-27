import { supabase } from "@/lib/supabase"

export const PERFORMANCE_GRADES = ["UNGRADED", "SILVER", "GOLD", "PLATINUM"] as const
export type PerformanceGrade = (typeof PERFORMANCE_GRADES)[number]
export type GradedPartnerType = "REFERRAL" | "CHANNEL" | "IMPLEMENTATION" | "TECHNOLOGY" | "PAYMENT"
export const GRADED_PARTNER_TYPES: GradedPartnerType[] = ["REFERRAL", "CHANNEL", "IMPLEMENTATION", "TECHNOLOGY", "PAYMENT"]
export const GRADED_PARTNER_TYPE_LABEL: Record<GradedPartnerType, string> = {
  REFERRAL: "Referral Partner", CHANNEL: "Channel Partner", IMPLEMENTATION: "Implementation Partner",
  TECHNOLOGY: "Technology Partner", PAYMENT: "Payment Partner",
}

export const PARTNER_TYPE_OUTCOME_LABEL: Record<GradedPartnerType, string> = {
  REFERRAL: "paid and activated referred customer(s)",
  CHANNEL: "paid and activated customer acquisition(s)",
  IMPLEMENTATION: "completed and accepted implementation(s)",
  TECHNOLOGY: "accepted production integration(s)",
  PAYMENT: "live payment service with verified settlement(s)",
}

export const GRADE_LABEL: Record<PerformanceGrade, string> = {
  UNGRADED: "Ungraded", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum",
}

export const GRADE_REQUIREMENTS = {
  SILVER: { outcomes: 1, days: 90 },
  GOLD: { outcomes: 10, days: 183 },
  PLATINUM: { outcomes: 25, days: 365 },
} as const

export const CHANNEL_QUALIFYING_COMMISSION_STATUSES = ["ELIGIBLE", "APPROVED", "SCHEDULED", "PAID"] as const

export function partnerTypesFor(value: string): GradedPartnerType[] {
  const types: GradedPartnerType[] = []
  if (value.includes("REFERRAL")) types.push("REFERRAL")
  if (value.includes("CHANNEL")) types.push("CHANNEL")
  if (value.includes("IMPLEMENTATION")) types.push("IMPLEMENTATION")
  if (value.includes("TECHNOLOGY")) types.push("TECHNOLOGY")
  if (value.includes("PAYMENT")) types.push("PAYMENT")
  return types
}

export function gradeRank(grade: string | null | undefined): number {
  // Preserve legacy Referral Diamond records in the management review flow.
  // The new progression does not create DIAMOND awards automatically.
  if (String(grade || "").toUpperCase() === "DIAMOND") return 4
  return PERFORMANCE_GRADES.indexOf((grade || "UNGRADED") as PerformanceGrade)
}

export async function getPerformanceTrack(partnerId: string, partnerType: GradedPartnerType, includeLegacyGrade = false) {
  const [{ data: partner }, { data: policy }, { data: existingGrade }, { data: outcomes }, { data: lifecycle }, { data: agreements }] = await Promise.all([
    supabase.from("partners").select("partner_since,partner_type_activation_dates,status,application_id,partner_type,current_grade").eq("id", partnerId).maybeSingle(),
    supabase.from("partner_grading_policies").select("*").eq("status", "APPROVED").order("effective_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("partner_type_grades").select("current_grade,last_reviewed_at").eq("partner_id", partnerId).eq("partner_type", partnerType).maybeSingle(),
    supabase.from("partner_delivery_verifications").select("delivery_type,outcome_reference,evidence_reference,verified_at").eq("partner_id", partnerId).eq("partner_type", partnerType).eq("approved", true),
    supabase.from("partner_lifecycle").select("onboarding_status,compliance_status").eq("partner_id", partnerId).maybeSingle(),
    supabase.from("partner_agreements").select("id").eq("partner_id", partnerId).in("status", ["EXECUTED", "ACTIVE"]).limit(1),
  ])
  const activationDates = partner?.partner_type_activation_dates && typeof partner.partner_type_activation_dates === "object"
    ? partner.partner_type_activation_dates as Record<string, string>
    : {}
  const sinceValue = activationDates[partnerType] || partner?.partner_since
  const since = sinceValue ? new Date(sinceValue) : null
  const days = since ? Math.max(0, Math.floor((Date.now() - since.getTime()) / 86400000)) : 0
  const rawCriteria = policy?.criteria && typeof policy.criteria === "object" ? policy.criteria as Record<string, unknown> : {}
  const perType = rawCriteria.trackCriteria && typeof rawCriteria.trackCriteria === "object" ? (rawCriteria.trackCriteria as Record<string, Record<string, unknown>>)[partnerType] : undefined
  const windowDays = Number(perType?.assessmentWindowDays || policy?.rolling_window_days || 365)
  const windowStart = Date.now() - windowDays * 86400000
  const unique = new Map<string, { reference: string; verifiedAt: string }>()
  const rolling = new Map<string, { reference: string; verifiedAt: string }>()
  const paidAcquisitionType = partnerType === "CHANNEL" ? "channel_sale" : partnerType === "REFERRAL" ? "referral_conversion" : null
  const acquisitionEvidenceIds = paidAcquisitionType
    ? [...new Set((outcomes || []).filter((row) => row.delivery_type === paidAcquisitionType).map((row) => String(row.evidence_reference || "")).filter(Boolean))]
    : []
  const validAcquisitionEvidenceIds = new Set<string>()
  if (acquisitionEvidenceIds.length) {
    const { data: currentSalesCommissions } = await supabase.from("partner_commissions")
      .select("id")
      .eq("partner_id", partnerId)
      .eq("attribution_type", partnerType === "CHANNEL" ? "SALES" : "ORIGINATING")
      .in("id", acquisitionEvidenceIds)
      .in("status", [...CHANNEL_QUALIFYING_COMMISSION_STATUSES])
      .not("payment_id", "is", null)
      .not("activation_at", "is", null)
    for (const commission of currentSalesCommissions || []) validAcquisitionEvidenceIds.add(String(commission.id))
  }
  for (const row of outcomes || []) {
    // Refunded, reversed or voided acquisition earnings no longer count.
    if (row.delivery_type === "channel_sale" || row.delivery_type === "referral_conversion") {
      if (!validAcquisitionEvidenceIds.has(String(row.evidence_reference || ""))) continue
    }
    const reference = String(row.outcome_reference || row.evidence_reference || "").trim()
    if (!reference || !row.verified_at) continue
    const entry = { reference, verifiedAt: row.verified_at }
    unique.set(reference.toLowerCase(), entry)
    if (new Date(row.verified_at).getTime() >= windowStart) rolling.set(reference.toLowerCase(), entry)
  }
  // The legacy system stored one grade for the whole partner record. Surface it
  // for management review until a per-type decision is entered; do not duplicate
  // it into the new per-type table automatically.
  const legacyGrade = includeLegacyGrade || partnerTypesFor(String(partner?.partner_type || "")).length === 1 ? partner?.current_grade : null
  const current = (existingGrade?.current_grade || legacyGrade || "UNGRADED") as PerformanceGrade
  const onboardingComplete = lifecycle?.onboarding_status === "complete" || lifecycle?.onboarding_status === "completed" || lifecycle?.onboarding_status === "approved"
  const complianceClear = ["clear", "satisfactory", "compliant"].includes(String(lifecycle?.compliance_status || "").toLowerCase())
  const activeAgreement = Array.isArray(agreements) ? agreements.length > 0 : Boolean(agreements)
  const enabledTypes = Array.isArray(rawCriteria.partnerTypes) ? rawCriteria.partnerTypes.map((value: unknown) => String(value).toUpperCase()) : ["CHANNEL", "IMPLEMENTATION"]
  const policyEnablesTrack = Boolean(policy && enabledTypes.includes(partnerType))
  const gradeNeeds: Record<Exclude<PerformanceGrade, "UNGRADED">, { outcomes: number; days: number }> = {
    SILVER: { outcomes: Number(perType?.silverOutcomes ?? policy?.silver_outcomes ?? 1), days: Number(perType?.silverMinDays ?? policy?.silver_min_days ?? 90) },
    GOLD: { outcomes: Number(perType?.goldOutcomes ?? policy?.gold_outcomes ?? 10), days: Number(perType?.goldMinDays ?? policy?.gold_min_days ?? 183) },
    PLATINUM: { outcomes: Number(perType?.platinumOutcomes ?? policy?.platinum_outcomes ?? 25), days: Number(perType?.platinumMinDays ?? policy?.platinum_min_days ?? 365) },
  }
  const next = current === "UNGRADED" ? "SILVER" : current === "SILVER" ? "GOLD" : current === "GOLD" ? "PLATINUM" : null
  const count = next === "SILVER" ? unique.size : rolling.size
  const requirement = next ? gradeNeeds[next] : null
  const outstanding = [
    ...(!activeAgreement ? ["Active executed partner agreement"] : []),
    ...(!onboardingComplete ? ["Completed partner onboarding"] : []),
    ...(!complianceClear ? ["Satisfactory compliance status"] : []),
    ...(!policyEnablesTrack ? ["Management must publish an approved policy with criteria for this Partner Type"] : []),
    ...(requirement && count < requirement.outcomes ? [`${requirement.outcomes - count} more verified ${PARTNER_TYPE_OUTCOME_LABEL[partnerType]}`] : []),
    ...(requirement && days < requirement.days ? [`${requirement.days - days} more days in the partnership`] : []),
    "Management performance review and approval",
  ]
  const ready = Boolean(policyEnablesTrack && activeAgreement && onboardingComplete && complianceClear && requirement && count >= requirement.outcomes && days >= requirement.days)
  return {
    partnerType, currentGrade: current, nextGrade: next, qualifyingOutcomes: count,
    lifetimeOutcomes: unique.size, rollingOutcomes: rolling.size,
    outcomeReferences: [...(next === "SILVER" ? unique : rolling).values()], rollingOutcomeReferences: [...rolling.values()],
    partnershipDays: days, requiredOutcomes: requirement?.outcomes ?? null,
    requiredDays: requirement?.days ?? null, progressPercent: requirement ? Math.min(100, Math.round(Math.min(count / requirement.outcomes, days / requirement.days) * 100)) : 100,
    activeAgreement, onboardingComplete, complianceClear, eligibleForAssessment: ready,
    outstanding, policyStatus: !policy ? "DRAFT" : policyEnablesTrack ? "APPROVED" : "NOT_CONFIGURED", policyVersion: policy?.version || "1.0",
    currentGradeLastReviewedAt: existingGrade?.last_reviewed_at || null,
  }
}
