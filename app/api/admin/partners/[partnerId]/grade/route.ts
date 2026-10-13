import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { referralAdminCan } from "@/lib/referral-permissions"
import { issueGradeConfirmation } from "@/lib/partner-generated-docs"
import { emitReferralNotification } from "@/lib/referral-notifications"
import {
  REFERRAL_GRADES,
  REFERRAL_GRADE_LABELS,
  applyGradeProtections,
  evaluateReferralGrade,
  type GradeMetrics,
  type ReferralGrade,
} from "@/lib/partner-grades"

/* ───────────────────────────  Quarterly grade review  ───────────────────────────
 * Grade is a standing decision, not a rate: it never changes commission, access
 * or exclusivity unless a signed schedule says so. The counters below are read
 * from MartPoint records; the two judgement inputs (strategic contribution and
 * management approval) are recorded by the approver, never inferred in code.
 */

const PROTECTED_OR_LATER = [
  "ACCEPTED",
  "QUALIFIED",
  "CONVERTED_UNPAID",
  "PAID_PENDING_ACTIVATION",
  "ACTIVATED_HOLDING",
  "COMMISSION_ELIGIBLE",
  "APPROVED",
  "PAID",
]

const EARNING_STATUSES = ["ELIGIBLE", "APPROVED", "SCHEDULED", "PAID"]

function isoAgo(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString()
}

function daysBetween(from: string | null, to = new Date()): number {
  if (!from) return 0
  const ms = to.getTime() - new Date(from).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

async function computeMetrics(
  partnerId: string
): Promise<{ metrics: GradeMetrics; observedAt: string; inactiveMonths: number }> {
  const observedAt = new Date().toISOString()
  const since6 = isoAgo(6)
  const since12 = isoAgo(12)

  const [accepted6, accepted12, submitted12, earnings, adjustments, partner, lastLead, lastEarning, reviews] = await Promise.all([
    supabase
      .from("partner_leads")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId)
      .not("referral_reference", "is", null)
      .in("status", PROTECTED_OR_LATER)
      .gte("protection_start_at", since6),
    supabase
      .from("partner_leads")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId)
      .not("referral_reference", "is", null)
      .in("status", PROTECTED_OR_LATER)
      .gte("protection_start_at", since12),
    supabase
      .from("partner_leads")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partnerId)
      .not("referral_reference", "is", null)
      .gte("submitted_at", since12),
    supabase
      .from("partner_commissions")
      .select("business_id, earned_at, basis_amount")
      .eq("partner_id", partnerId)
      .not("earning_kind", "is", null)
      .is("parent_commission_id", null)
      .in("status", EARNING_STATUSES)
      .limit(2000),
    supabase
      .from("partner_commissions")
      .select("commission_amount, created_at")
      .eq("partner_id", partnerId)
      .not("parent_commission_id", "is", null)
      .in("adjustment_kind", ["REFUND", "CREDIT", "CHARGEBACK"])
      .limit(2000),
    supabase.from("partners").select("partner_since").eq("id", partnerId).maybeSingle(),
    supabase
      .from("partner_leads")
      .select("updated_at")
      .eq("partner_id", partnerId)
      .not("referral_reference", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("partner_commissions")
      .select("created_at")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("partner_grade_history")
      .select("previous_grade, new_grade")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  const earningsRows = (earnings.data || []) as Record<string, unknown>[]
  const paidIn = (months: number) => {
    const cutoff = isoAgo(months)
    const set = new Set(
      earningsRows
        .filter((r) => String(r.earned_at || "") >= cutoff)
        .map((r) => String(r.business_id))
    )
    return set.size
  }

  const adjustedAmount = ((adjustments.data || []) as Record<string, unknown>[]).reduce(
    (s, r) => s + Math.abs(Number(r.commission_amount) || 0),
    0
  )
  const basisAmount = earningsRows.reduce((s, r) => s + (Number(r.basis_amount) || 0), 0)
  const submittedCount = submitted12.count || 0
  const acceptedCount = accepted12.count || 0

  const partnerSinceStr = (partner.data as Record<string, unknown> | null)?.partner_since
    ? String((partner.data as Record<string, unknown>).partner_since)
    : null
  // Inactivity is measured from the last thing MartPoint can see the partner do —
  // a referral or an earning — and falls back to the activation date when there is none.
  const lastActivity = [
    (lastLead.data as Record<string, unknown>[] | null)?.[0]?.updated_at,
    (lastEarning.data as Record<string, unknown>[] | null)?.[0]?.created_at,
    partnerSinceStr,
  ]
    .filter(Boolean)
    .map(String)
    .sort()
    .pop() ?? null

  // A review counts as passed when it did not demote the partner; Gold needs two
  // consecutive passes, so the streak is read from the recorded history, not typed in.
  const rank: Record<string, number> = { SILVER: 0, GOLD: 1, PLATINUM: 2, DIAMOND: 3 }
  let passingStreak = 0
  for (const r of (reviews.data as Record<string, unknown>[] | null) || []) {
    const prev = r.previous_grade ? String(r.previous_grade) : null
    const next = r.new_grade ? String(r.new_grade) : null
    if (!next) continue
    if (prev && (rank[next] ?? 0) < (rank[prev] ?? 0)) break
    passingStreak += 1
  }

  return {
    inactiveMonths: Math.floor(daysBetween(lastActivity) / 30),
    observedAt,
    metrics: {
      acceptedReferrals6m: accepted6.count || 0,
      acceptedReferrals12m: acceptedCount,
      paidConversions6m: paidIn(6),
      paidConversions12m: paidIn(12),
      validSubmissionRate: submittedCount > 0 ? Math.round((acceptedCount / submittedCount) * 1000) / 10 : 0,
      refundRate: basisAmount > 0 ? Math.round((adjustedAmount / basisAmount) * 1000) / 10 : 0,
      consecutivePassingReviews: passingStreak,
      misleadingClaim: false,
      consentFailure: false,
      activeAgreement: true,
      orientationCompleted: true,
      daysSinceActivation: daysBetween(partnerSinceStr),
      strategicContribution: false,
      managementApproved: false,
    },
  }
}

/* ─── GET: the review sheet ─── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied
  const { partnerId } = await params
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const [{ data: partner }, { metrics, observedAt, inactiveMonths }, { data: history }] = await Promise.all([
    supabase.from("partners").select("id, partner_id, business_name, partner_type, current_grade, grade_review_date, status").eq("id", partnerId).maybeSingle(),
    computeMetrics(partnerId),
    supabase
      .from("partner_grade_history")
      .select("id, previous_grade, new_grade, review_period, decision_reason, decided_by_name, effective_from, created_at")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  const row = (partner as Record<string, unknown> | null) ?? null
  if (!row || String(row.partner_type) !== "REFERRAL") {
    return NextResponse.json({ error: "Grades apply to Referral Partners only" }, { status: 400 })
  }

  const current = (row.current_grade ? String(row.current_grade) : null) as ReferralGrade | null
  const proposal = evaluateReferralGrade(metrics)

  return NextResponse.json({
    partner: {
      id: String(row.id),
      code: String(row.partner_id),
      name: String(row.business_name || ""),
      currentGrade: current ? REFERRAL_GRADE_LABELS[current] : "Not graded",
      lastReview: row.grade_review_date ? String(row.grade_review_date) : null,
      status: String(row.status),
    },
    metrics,
    observedAt,
    inactiveMonths,
    proposal: { grade: proposal.grade, label: REFERRAL_GRADE_LABELS[proposal.grade], reasons: proposal.reasons },
    protections: applyGradeProtections({
      current,
      proposed: proposal.grade,
      complianceBreach: false,
      inactiveMonths,
      consecutiveMissedQuarters: 0,
      approvedException: false,
    }),
    history: (history || []) as Record<string, unknown>[],
    can: { decide: referralAdminCan(session.role, "grade:decide") },
  })
}

const schema = z.object({
  grade: z.enum(REFERRAL_GRADES),
  reason: z.string().min(5).max(2000),
  reviewPeriod: z.string().max(60).optional(),
  strategicContribution: z.boolean().optional(),
  managementApproved: z.boolean().optional(),
  complianceBreach: z.boolean().optional(),
  consecutiveMissedQuarters: z.coerce.number().int().min(0).max(8).optional(),
  approvedException: z.boolean().optional(),
})

/* ─── POST: record the decision ─── */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  const { partnerId } = await params
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "A grade and a written reason are required" }, { status: 400 })
  if (!referralAdminCan(session.role, "grade:decide")) {
    return NextResponse.json({ error: "Only Management can decide a partner grade" }, { status: 403 })
  }

  const { data: partner } = await supabase
    .from("partners")
    .select("id, partner_type, current_grade, business_name, partner_since")
    .eq("id", partnerId)
    .maybeSingle()
  const row = partner as Record<string, unknown> | null
  if (!row || String(row.partner_type) !== "REFERRAL") {
    return NextResponse.json({ error: "Grades apply to Referral Partners only" }, { status: 400 })
  }

  const previous = (row.current_grade ? String(row.current_grade) : null) as ReferralGrade | null
  const body = parsed.data
  const { metrics, inactiveMonths } = await computeMetrics(partnerId)
  metrics.strategicContribution = Boolean(body.strategicContribution)
  metrics.managementApproved = Boolean(body.managementApproved)

  const proposed = evaluateReferralGrade(metrics)
  // Protections are evaluated against the grade Management actually recorded, so a
  // breach, six idle months or missed quarters cap the decision itself — not just
  // the automatically computed proposal.
  const protected_ = applyGradeProtections({
    current: previous,
    proposed: body.grade,
    complianceBreach: Boolean(body.complianceBreach),
    inactiveMonths,
    consecutiveMissedQuarters: body.consecutiveMissedQuarters ?? 0,
    approvedException: Boolean(body.approvedException),
  })

  // Management may record a grade that differs from the computed proposal, but the
  // protections (breach, inactivity, missed quarters) are applied over it.
  const chosen = protected_.blockedFromPromotion
    ? protected_.grade
    : body.grade === "DIAMOND" && !(metrics.strategicContribution && metrics.managementApproved)
      ? previous ?? "SILVER"
      : body.grade

  const today = new Date()
  const nextReview = new Date(today)
  nextReview.setMonth(nextReview.getMonth() + 3)
  const dateOnly = (d: Date) => d.toISOString().slice(0, 10)

  const { error: updErr } = await supabase
    .from("partners")
    .update({ current_grade: chosen, grade_review_date: dateOnly(today), updated_at: today.toISOString() })
    .eq("id", partnerId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  let documentId: string | null = null
  try {
    const doc = await issueGradeConfirmation(
      partnerId,
      { newGrade: REFERRAL_GRADE_LABELS[chosen], previousGrade: previous ? REFERRAL_GRADE_LABELS[previous] : null, basis: body.reason.trim() },
      { id: session.userId, name: session.name || session.username }
    )
    documentId = doc.ok ? String(doc.document?.id ?? "") || null : null
  } catch (err) {
    console.error("[grade] confirmation document failed:", err)
  }

  const { error: histErr } = await supabase.from("partner_grade_history").insert({
    partner_id: partnerId,
    previous_grade: previous,
    new_grade: chosen,
    review_period: body.reviewPeriod?.trim() || `${today.getFullYear()}-Q${Math.floor(today.getMonth() / 3) + 1}`,
    metrics: { ...metrics, computedProposal: proposed.grade, blockedFromPromotion: protected_.blockedFromPromotion },
    effective_from: dateOnly(today),
    next_review_date: dateOnly(nextReview),
    decision_reason: body.reason.trim(),
    decided_by: session.userId,
    decided_by_name: session.name || session.username,
    document_id: documentId,
  })
  if (histErr) return NextResponse.json({ error: histErr.message }, { status: 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.REFERRAL_GRADE_CHANGED,
    entityType: AUDIT_ENTITIES.PARTNER_GRADE,
    entityId: partnerId,
    metadata: {
      previous,
      chosen,
      computedProposal: proposed.grade,
      reason: body.reason.trim(),
      protectionsApplied: protected_.blockedFromPromotion,
    },
  })

  await emitReferralNotification({
    event: "QUARTERLY_GRADE_REVIEW",
    title: `Grade review: ${REFERRAL_GRADE_LABELS[chosen]}`,
    body: `MartPoint has completed your grade review. ${body.reason.trim()}`,
    partnerId,
    link: "/partner/certification",
    sourceType: "partner_grade",
    sourceId: partnerId,
    emailTo: null,
  })

  return NextResponse.json({ ok: true, grade: chosen })
}
