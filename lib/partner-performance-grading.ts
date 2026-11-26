import { supabase } from "@/lib/supabase"

export const PERFORMANCE_GRADES = ["UNGRADED", "SILVER", "GOLD", "PLATINUM"] as const
export type PerformanceGrade = (typeof PERFORMANCE_GRADES)[number]
export type GradedPartnerType = "CHANNEL" | "IMPLEMENTATION"

export const GRADE_LABEL: Record<PerformanceGrade, string> = {
  UNGRADED: "Ungraded", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum",
}

export const GRADE_REQUIREMENTS = {
  SILVER: { outcomes: 1, days: 90 },
  GOLD: { outcomes: 10, days: 183 },
  PLATINUM: { outcomes: 25, days: 365 },
} as const

export function partnerTypesFor(value: string): GradedPartnerType[] {
  const types: GradedPartnerType[] = []
  if (value.includes("CHANNEL")) types.push("CHANNEL")
  if (value.includes("IMPLEMENTATION")) types.push("IMPLEMENTATION")
  return types
}

export function gradeRank(grade: string | null | undefined): number {
  return PERFORMANCE_GRADES.indexOf((grade || "UNGRADED") as PerformanceGrade)
}

export async function getPerformanceTrack(partnerId: string, partnerType: GradedPartnerType, includeLegacyGrade = false) {
  const [{ data: partner }, { data: policy }, { data: existingGrade }, { data: outcomes }, { data: lifecycle }, { data: agreements }] = await Promise.all([
    supabase.from("partners").select("partner_since,status,application_id,partner_type,current_grade").eq("id", partnerId).maybeSingle(),
    supabase.from("partner_grading_policies").select("*").eq("status", "APPROVED").order("effective_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("partner_type_grades").select("current_grade,last_reviewed_at").eq("partner_id", partnerId).eq("partner_type", partnerType).maybeSingle(),
    supabase.from("partner_delivery_verifications").select("outcome_reference,evidence_reference,verified_at").eq("partner_id", partnerId).eq("partner_type", partnerType).eq("approved", true),
    supabase.from("partner_lifecycle").select("onboarding_status,compliance_status").eq("partner_id", partnerId).maybeSingle(),
    supabase.from("partner_agreements").select("id").eq("partner_id", partnerId).in("status", ["EXECUTED", "ACTIVE"]).limit(1),
  ])
  const since = partner?.partner_since ? new Date(partner.partner_since) : null
  const days = since ? Math.max(0, Math.floor((Date.now() - since.getTime()) / 86400000)) : 0
  const windowDays = Number(policy?.rolling_window_days || 365)
  const windowStart = Date.now() - windowDays * 86400000
  const unique = new Map<string, { reference: string; verifiedAt: string }>()
  const rolling = new Map<string, { reference: string; verifiedAt: string }>()
  for (const row of outcomes || []) {
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
  const gradeNeeds: Record<Exclude<PerformanceGrade, "UNGRADED">, { outcomes: number; days: number }> = {
    SILVER: { outcomes: Number(policy?.silver_outcomes || 1), days: Number(policy?.silver_min_days || 90) },
    GOLD: { outcomes: Number(policy?.gold_outcomes || 10), days: Number(policy?.gold_min_days || 183) },
    PLATINUM: { outcomes: Number(policy?.platinum_outcomes || 25), days: Number(policy?.platinum_min_days || 365) },
  }
  const next = current === "UNGRADED" ? "SILVER" : current === "SILVER" ? "GOLD" : current === "GOLD" ? "PLATINUM" : null
  const count = next === "SILVER" ? unique.size : rolling.size
  const requirement = next ? gradeNeeds[next] : null
  const outstanding = [
    ...(!activeAgreement ? ["Active executed partner agreement"] : []),
    ...(!onboardingComplete ? ["Completed partner onboarding"] : []),
    ...(!complianceClear ? ["Satisfactory compliance status"] : []),
    ...(requirement && count < requirement.outcomes ? [`${requirement.outcomes - count} more verified qualifying ${partnerType === "CHANNEL" ? "customer acquisition(s)" : "accepted implementation(s)"}`] : []),
    ...(requirement && days < requirement.days ? [`${requirement.days - days} more days in the partnership`] : []),
    "Management performance review and approval",
  ]
  const ready = Boolean(policy && activeAgreement && onboardingComplete && complianceClear && requirement && count >= requirement.outcomes && days >= requirement.days)
  return {
    partnerType, currentGrade: current, nextGrade: next, qualifyingOutcomes: count,
    lifetimeOutcomes: unique.size, rollingOutcomes: rolling.size,
    outcomeReferences: [...(next === "SILVER" ? unique : rolling).values()], rollingOutcomeReferences: [...rolling.values()],
    partnershipDays: days, requiredOutcomes: requirement?.outcomes ?? null,
    requiredDays: requirement?.days ?? null, progressPercent: requirement ? Math.min(100, Math.round(Math.min(count / requirement.outcomes, days / requirement.days) * 100)) : 100,
    activeAgreement, onboardingComplete, complianceClear, eligibleForAssessment: ready,
    outstanding, policyStatus: policy ? "APPROVED" : "DRAFT", policyVersion: policy?.version || "1.0",
    currentGradeLastReviewedAt: existingGrade?.last_reviewed_at || null,
  }
}
