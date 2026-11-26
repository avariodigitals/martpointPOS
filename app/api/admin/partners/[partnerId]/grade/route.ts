import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { applyGradeProtections, evaluateReferralGrade, isGradeReduction, REFERRAL_GRADE_LABELS, REFERRAL_GRADES, type ReferralGrade } from "@/lib/partner-grades"
import { calculatePartnerMetrics } from "@/lib/partner-metrics"
import { supabase } from "@/lib/supabase"
import { z } from "zod"

const GradeSchema = z.object({
  grade: z.enum(REFERRAL_GRADES),
  reason: z.string().min(5),
  reviewPeriod: z.string().regex(/^\d{4}-Q[1-4]$/),
  strategicContribution: z.boolean().optional().default(false),
  managementApproved: z.boolean().optional().default(false),
  authorizedReview: z.boolean().optional().default(false),
})

type PartnerRouteContext = { params: Promise<{ partnerId: string }> }

export async function GET(request: Request, { params }: PartnerRouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { partnerId } = await params
  
  try {
    const metrics = await calculatePartnerMetrics(partnerId)
    const { grade: computedGrade, reasons: computedReasons } = evaluateReferralGrade(metrics)

    const [{ data: row }, { data: history }, { data: delivery }] = await Promise.all([
      supabase
        .from("partners")
        .select("id, partner_id, business_name, partner_type, current_grade, grade_review_date, status")
        .eq("id", partnerId)
        .maybeSingle(),
      supabase.from("partner_grade_history").select("new_grade, review_period, effective_from, decision_reason, created_at").eq("partner_id", partnerId).order("created_at", { ascending: false }),
      supabase.from("partner_delivery_verifications").select("id,delivery_type,evidence_reference,verified_at").eq("partner_id", partnerId).eq("approved", true).limit(1).maybeSingle(),
    ])

    if (!row) return NextResponse.json({ error: "Partner not found" }, { status: 404 })
    if (row.partner_type !== "REFERRAL") return NextResponse.json({
      partner: { id: row.id, code: row.partner_id, name: row.business_name, currentGrade: row.current_grade === "UNGRADED" ? "Ungraded" : row.current_grade || "Ungraded", lastReview: row.grade_review_date, status: row.status },
      metrics: null,
      proposal: { grade: null, label: "No approved grading rubric for this Partner Type", reasons: ["Verified business delivery is still required for directory eligibility. Management must approve and publish criteria for this Partner Type before any grade can be assessed."] },
      verifiedDelivery: delivery ? { type: delivery.delivery_type, verifiedAt: delivery.verified_at, evidenceReference: delivery.evidence_reference } : null,
      history: history || [],
      can: { decide: false },
    })

    const currentGrade = typeof row.current_grade === "string" &&
      (REFERRAL_GRADES as readonly string[]).includes(row.current_grade)
      ? REFERRAL_GRADE_LABELS[row.current_grade as ReferralGrade]
      : "Not graded"
    const currentGradeKey = (REFERRAL_GRADES as readonly string[]).includes(String(row.current_grade)) ? row.current_grade as ReferralGrade : null
    const protections = applyGradeProtections({
      current: currentGradeKey,
      proposed: computedGrade || currentGradeKey || "SILVER",
      complianceBreach: metrics.misleadingClaim || metrics.consentFailure,
      inactiveMonths: metrics.inactiveMonths,
      consecutiveMissedQuarters: 0,
      approvedException: false,
    })

    return NextResponse.json({
      partner: {
        id: row.id,
        code: row.partner_id,
        name: row.business_name,
        currentGrade: row.current_grade === "UNGRADED" ? "Ungraded" : currentGrade,
        lastReview: row.grade_review_date,
        status: row.status,
      },
      metrics,
      observedAt: new Date().toISOString(),
      inactiveMonths: metrics.inactiveMonths,
      proposal: {
        grade: delivery ? computedGrade : null,
        label: delivery && computedGrade ? REFERRAL_GRADE_LABELS[computedGrade] : "Ungraded — verified business delivery required",
        reasons: delivery ? computedReasons : [...computedReasons, "At least one MartPoint-verified qualifying business delivery is required before grade assessment."],
      },
      verifiedDelivery: delivery ? { type: delivery.delivery_type, verifiedAt: delivery.verified_at, evidenceReference: delivery.evidence_reference } : null,
      protections,
      history: history || [],
      can: { decide: session.role === "Admin" },
    })
  } catch {
    return NextResponse.json({ error: "Failed to load grade data" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: PartnerRouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "Admin") return NextResponse.json({ error: "Only Management can record partner grade decisions" }, { status: 403 })

  const { partnerId } = await params
  const body = await request.json()
  const parsed = GradeSchema.safeParse(body)

  if (!parsed.success) return NextResponse.json({ error: "A grade and a reason are required" }, { status: 400 })

  const { grade, reason, reviewPeriod, strategicContribution, managementApproved, authorizedReview } = parsed.data

  try {
    const metrics = await calculatePartnerMetrics(partnerId)
    const [{ data: delivery }, { data: partnerType }] = await Promise.all([
      supabase.from("partner_delivery_verifications").select("id").eq("partner_id", partnerId).eq("approved", true).limit(1).maybeSingle(),
      supabase.from("partners").select("partner_type").eq("id", partnerId).maybeSingle(),
    ])
    if (partnerType?.partner_type !== "REFERRAL") return NextResponse.json({ error: "This grade rubric currently applies to Referral Partners only; a Management-approved Partner-Type rubric is required before grading other types" }, { status: 409 })
    if (!delivery) return NextResponse.json({ error: "At least one verified qualifying business delivery is required before a grade can be awarded" }, { status: 409 })
    if (!managementApproved) return NextResponse.json({ error: "Written MartPoint Management approval is required for every grade award" }, { status: 400 })
    if (metrics.daysSinceActivation < 90) {
      return NextResponse.json({ error: "A partner cannot receive a grade before completing the first 90 calendar days" }, { status: 409 })
    }
    const proposal = evaluateReferralGrade({ ...metrics, strategicContribution, managementApproved })
    if (!proposal.grade) {
      return NextResponse.json({ error: proposal.reasons.join(" ") }, { status: 409 })
    }
    const order = REFERRAL_GRADES as readonly string[]
    if (order.indexOf(grade) > order.indexOf(proposal.grade)) {
      return NextResponse.json({ error: `This partner currently qualifies up to ${REFERRAL_GRADE_LABELS[proposal.grade]}. ${proposal.reasons.join(" ")}` }, { status: 409 })
    }
    if (grade === "DIAMOND" && !(strategicContribution && managementApproved)) {
      return NextResponse.json({ error: "Diamond requires documented strategic contribution and Management approval" }, { status: 400 })
    }

    const { data: row } = await supabase
      .from("partners")
      .select("current_grade")
      .eq("id", partnerId)
      .maybeSingle()

    const previous = typeof row?.current_grade === "string" ? row.current_grade : null
    if (isGradeReduction(previous, grade) && !authorizedReview) {
      return NextResponse.json({ error: "A previously awarded grade can be reduced only after a separately documented and explicitly authorized grade review" }, { status: 409 })
    }

    // Record the decision
    await supabase.from("partners").update({
      current_grade: grade,
      grade_review_date: new Date().toISOString(),
    }).eq("id", partnerId)

    await supabase.from("partner_grade_history").insert({
      partner_id: partnerId,
      previous_grade: previous,
      new_grade: grade,
      decision_reason: reason,
      review_period: reviewPeriod,
      metrics: { ...metrics, strategicContribution, managementApproved, authorizedReview },
      decided_by: session.userId,
      decided_by_name: session.name || session.username,
      effective_from: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, grade })
  } catch {
    return NextResponse.json({ error: "Failed to save grade" }, { status: 500 })
  }
}
