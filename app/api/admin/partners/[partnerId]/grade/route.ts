import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { applyGradeProtections, evaluateReferralGrade, REFERRAL_GRADE_LABELS, REFERRAL_GRADES, type ReferralGrade } from "@/lib/partner-grades"
import { calculatePartnerMetrics } from "@/lib/partner-metrics"
import { supabase } from "@/lib/supabase"
import { z } from "zod"

const GradeSchema = z.object({
  grade: z.enum(REFERRAL_GRADES),
  reason: z.string().min(5),
  reviewPeriod: z.string().regex(/^\d{4}-Q[1-4]$/),
  strategicContribution: z.boolean().optional().default(false),
  managementApproved: z.boolean().optional().default(false),
})

type PartnerRouteContext = { params: Promise<{ partnerId: string }> }

export async function GET(request: Request, { params }: PartnerRouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { partnerId } = await params
  
  try {
    const metrics = await calculatePartnerMetrics(partnerId)
    const { grade: computedGrade, reasons: computedReasons } = evaluateReferralGrade(metrics)

    const [{ data: row }, { data: history }] = await Promise.all([
      supabase
        .from("partners")
        .select("id, partner_id, business_name, current_grade, grade_review_date, status")
        .eq("id", partnerId)
        .maybeSingle(),
      supabase.from("partner_grade_history").select("new_grade, review_period, effective_from, decision_reason, created_at").eq("partner_id", partnerId).order("created_at", { ascending: false }),
    ])

    if (!row) return NextResponse.json({ error: "Partner not found" }, { status: 404 })

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
        currentGrade,
        lastReview: row.grade_review_date,
        status: row.status,
      },
      metrics,
      observedAt: new Date().toISOString(),
      inactiveMonths: metrics.inactiveMonths,
      proposal: {
        grade: computedGrade,
        label: computedGrade ? REFERRAL_GRADE_LABELS[computedGrade] : "Not eligible yet",
        reasons: computedReasons,
      },
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

  const { grade, reason, reviewPeriod, strategicContribution, managementApproved } = parsed.data

  try {
    const metrics = await calculatePartnerMetrics(partnerId)
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
      metrics: { ...metrics, strategicContribution, managementApproved },
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
