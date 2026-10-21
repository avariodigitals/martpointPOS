import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { evaluateReferralGrade, REFERRAL_GRADE_LABELS, REFERRAL_GRADES, type ReferralGrade } from "@/lib/partner-grades"
import { calculatePartnerMetrics } from "@/lib/partner-metrics"
import { supabase } from "@/lib/supabase"
import { z } from "zod"

const GradeSchema = z.object({
  grade: z.enum(REFERRAL_GRADES),
  reason: z.string().min(5),
})

type PartnerRouteContext = { params: Promise<{ partnerId: string }> }

export async function GET(request: Request, { params }: PartnerRouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { partnerId } = await params
  
  try {
    const metrics = await calculatePartnerMetrics(partnerId)
    const { grade: computedGrade, reasons: computedReasons } = evaluateReferralGrade(metrics)

    const { data: row } = await supabase
      .from("partners")
      .select("id, partner_id, business_name, current_grade, grade_review_date")
      .eq("id", partnerId)
      .maybeSingle()

    if (!row) return NextResponse.json({ error: "Partner not found" }, { status: 404 })

    const currentGrade = typeof row.current_grade === "string" &&
      (REFERRAL_GRADES as readonly string[]).includes(row.current_grade)
      ? REFERRAL_GRADE_LABELS[row.current_grade as ReferralGrade]
      : "Not graded"

    return NextResponse.json({
      partner: {
        name: row.business_name,
        currentGrade,
        lastReview: row.grade_review_date,
      },
      metrics,
      proposal: {
        grade: computedGrade,
        label: REFERRAL_GRADE_LABELS[computedGrade],
        reasons: computedReasons,
      }
    })
  } catch {
    return NextResponse.json({ error: "Failed to load grade data" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: PartnerRouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { partnerId } = await params
  const body = await request.json()
  const parsed = GradeSchema.safeParse(body)

  if (!parsed.success) return NextResponse.json({ error: "A grade and a reason are required" }, { status: 400 })

  const { grade, reason } = parsed.data

  try {
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
      effective_from: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, grade })
  } catch {
    return NextResponse.json({ error: "Failed to save grade" }, { status: 500 })
  }
}
