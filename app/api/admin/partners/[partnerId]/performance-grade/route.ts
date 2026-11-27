import { NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/admin-auth"
import { GRADED_PARTNER_TYPES, gradeRank, getPerformanceTrack, type GradedPartnerType, type PerformanceGrade, partnerTypesFor } from "@/lib/partner-performance-grading"
import { supabase } from "@/lib/supabase"
import { issueGradeConfirmation } from "@/lib/partner-generated-docs"

const Decision = z.object({
  partnerType: z.enum(GRADED_PARTNER_TYPES as [GradedPartnerType, ...GradedPartnerType[]]),
  grade: z.enum(["UNGRADED", "SILVER", "GOLD", "PLATINUM"]),
  reason: z.string().min(8),
  managementApproved: z.literal(true),
  authorizedReview: z.boolean().default(false),
})
type Ctx = { params: Promise<{ partnerId: string }> }

export async function GET(request: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "Admin") return NextResponse.json({ error: "Management access required" }, { status: 403 })
  const { partnerId } = await params
  const partnerType = new URL(request.url).searchParams.get("partnerType") as GradedPartnerType | null
  if (!partnerType || !GRADED_PARTNER_TYPES.includes(partnerType)) return NextResponse.json({ error: "Choose a graded Partner Type" }, { status: 400 })
  const [{ data: partner }, track, { data: history }] = await Promise.all([
    supabase.from("partners").select("id,partner_id,business_name,partner_type,current_grade").eq("id", partnerId).maybeSingle(),
    getPerformanceTrack(partnerId, partnerType, true),
    supabase.from("partner_grade_decisions").select("*").eq("partner_id", partnerId).eq("partner_type", partnerType).order("created_at", { ascending: false }).limit(30),
  ])
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 })
  if (!partnerTypesFor(String(partner.partner_type)).includes(partnerType)) return NextResponse.json({ error: "This partner is not approved for that Partner Type" }, { status: 409 })
  return NextResponse.json({ partner, track, history: history || [] })
}

export async function POST(request: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "Admin") return NextResponse.json({ error: "Management access required" }, { status: 403 })
  const parsed = Decision.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "A grade type, decision reason and Management approval are required" }, { status: 400 })
  const { partnerId } = await params
  const input = parsed.data
  const [{ data: partner }, track, { data: policy }] = await Promise.all([
    supabase.from("partners").select("id,partner_type").eq("id", partnerId).maybeSingle(),
    getPerformanceTrack(partnerId, input.partnerType, true),
    supabase.from("partner_grading_policies").select("id,status,criteria,silver_outcomes,gold_outcomes,platinum_outcomes,silver_min_days,gold_min_days,platinum_min_days").eq("status", "APPROVED").order("effective_at", { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 })
  if (!partnerTypesFor(String(partner.partner_type)).includes(input.partnerType)) return NextResponse.json({ error: "Partner Type is not approved for this partner" }, { status: 409 })
  const policyTypes = Array.isArray(policy?.criteria?.partnerTypes) ? policy.criteria.partnerTypes.map((value: unknown) => String(value).toUpperCase()) : ["CHANNEL", "IMPLEMENTATION"]
  if (gradeRank(input.grade) > gradeRank(track.currentGrade) && !policyTypes.includes(input.partnerType)) return NextResponse.json({ error: "The approved policy does not yet define a grade pathway for this Partner Type" }, { status: 409 })
  const previous = track.currentGrade as PerformanceGrade
  if (input.grade === previous) return NextResponse.json({ error: "The selected grade matches the current grade; choose an actual grade change." }, { status: 409 })
  const reduction = gradeRank(input.grade) < gradeRank(previous)
  if (reduction && !input.authorizedReview) return NextResponse.json({ error: "Grade reduction requires an explicitly authorized review. Confirm the review and record its evidence and reason." }, { status: 409 })
  if (gradeRank(input.grade) > gradeRank(previous)) {
    if (!policy) return NextResponse.json({ error: "The grading policy is still a draft. Management must publish the policy before awarding a new performance grade." }, { status: 409 })
    const criteria = policy?.criteria && typeof policy.criteria === "object" ? policy.criteria as Record<string, unknown> : {}
    const perType = criteria.trackCriteria && typeof criteria.trackCriteria === "object" ? (criteria.trackCriteria as Record<string, Record<string, unknown>>)[input.partnerType] : undefined
    const required = input.grade === "SILVER" ? { outcomes: Number(perType?.silverOutcomes ?? policy?.silver_outcomes), days: Number(perType?.silverMinDays ?? policy?.silver_min_days) }
      : input.grade === "GOLD" ? { outcomes: Number(perType?.goldOutcomes ?? policy?.gold_outcomes), days: Number(perType?.goldMinDays ?? policy?.gold_min_days) }
      : input.grade === "PLATINUM" ? { outcomes: Number(perType?.platinumOutcomes ?? policy?.platinum_outcomes), days: Number(perType?.platinumMinDays ?? policy?.platinum_min_days) }
      : null
    const outcomeCount = input.grade === "SILVER" ? track.lifetimeOutcomes : track.rollingOutcomes
    if (!required || !track.activeAgreement || !track.onboardingComplete || !track.complianceClear || outcomeCount < required.outcomes || track.partnershipDays < required.days) {
      return NextResponse.json({ error: "Verified outcomes, duration, onboarding, active agreement and satisfactory compliance must meet the approved criteria before a grade can be awarded." }, { status: 409 })
    }
  }
  const now = new Date().toISOString()
  const { error: gradeError } = await supabase.from("partner_type_grades").upsert({
    partner_id: partnerId, partner_type: input.partnerType, current_grade: input.grade,
    policy_id: policy?.id || null, effective_at: now, last_reviewed_at: now, updated_at: now,
  }, { onConflict: "partner_id,partner_type" })
  if (gradeError) return NextResponse.json({ error: "Could not save the per-type grade" }, { status: 500 })
  const decision = reduction ? "DOWNGRADED" : "APPROVED"
  const { error: historyError } = await supabase.from("partner_grade_decisions").insert({
    partner_id: partnerId, partner_type: input.partnerType, previous_grade: previous, new_grade: input.grade,
    decision, reason: input.reason, policy_id: policy?.id || null, decided_by: session.userId,
    decided_by_name: session.name || session.username,
    evidence: { lifetimeOutcomes: track.lifetimeOutcomes, rollingOutcomes: track.rollingOutcomes, outcomeReferences: track.outcomeReferences, rollingOutcomeReferences: track.rollingOutcomeReferences, partnershipDays: track.partnershipDays, activeAgreement: track.activeAgreement, onboardingComplete: track.onboardingComplete, complianceClear: track.complianceClear, authorizedReview: input.authorizedReview },
  })
  if (historyError) return NextResponse.json({ error: "Grade saved but decision audit could not be written; contact support before continuing" }, { status: 500 })
  const gradedTypes = partnerTypesFor(String(partner.partner_type || ""))
  const { data: allTypeGrades } = await supabase.from("partner_type_grades").select("partner_type,current_grade").eq("partner_id", partnerId)
  if (gradedTypes.length && gradedTypes.every((type) => allTypeGrades?.some((row) => row.partner_type === type))) {
    const currentOverall = (allTypeGrades || []).reduce<PerformanceGrade>((best, row) => gradeRank(row.current_grade) > gradeRank(best) ? row.current_grade as PerformanceGrade : best, "UNGRADED")
    await supabase.from("partners").update({ current_grade: currentOverall, grade_review_date: now.slice(0, 10) }).eq("id", partnerId)
  }
  await supabase.from("partner_notifications").insert({
    partner_id: partnerId, type: reduction ? "partner_grade_downgraded" : "partner_grade_decision",
    title: reduction ? "Partner grade updated after review" : "Partner grade decision recorded",
    body: `Your ${input.partnerType.toLowerCase()} grade has been updated to ${input.grade}. View the Partner Performance section for your current status and progression details.`,
    link: "/partner/performance", source_type: "partner_grade_decision", source_id: partnerId,
  })
  const certificate = await issueGradeConfirmation(partnerId, {
    newGrade: input.grade, previousGrade: previous, partnerType: input.partnerType, basis: input.reason,
  }, { id: session.userId, name: session.name || session.username }).catch(() => ({ ok: false }))
  return NextResponse.json({ ok: true, decision, previous, grade: input.grade, partnerType: input.partnerType, certificateIssued: certificate.ok })
}
