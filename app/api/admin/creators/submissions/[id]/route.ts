import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { recordMetricSnapshot, raiseFlag } from "@/lib/creator-challenges"
import { pushCreatorNotification } from "@/lib/creator-notifications"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const REVIEW_ACTIONS = ["approve", "request_correction", "reject", "disqualify", "mark_under_review"] as const

export async function GET(_req: Request, { params }: Params) {
  const { denied } = await authorizeAdmin("creator.submission.review")
  if (denied) return denied
  const { id } = await params

  const { data: s } = await supabase
    .from("creator_submissions")
    .select("*, creators(full_name, creator_id, email, referral_code), creator_challenges(id, name, slug, performance_cutoff, status)")
    .eq("id", id).maybeSingle()
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [{ data: metrics }, { data: flags }, { data: referrals }, { data: history }] = await Promise.all([
    supabase.from("creator_submission_metrics").select("*").eq("submission_id", id).order("captured_at", { ascending: false }),
    supabase.from("creator_flags").select("*").eq("submission_id", id).order("created_at", { ascending: false }),
    supabase.from("creator_referrals").select("id, event_type, lead_id, business_id, created_at, utm_source, utm_medium, utm_campaign")
      .eq("submission_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("creator_submissions").select("id, status, content_url, submitted_at, creator_challenges(name)")
      .eq("creator_id", s.creator_id as string).neq("id", id).order("submitted_at", { ascending: false }).limit(10),
  ])

  return NextResponse.json({
    submission: s,
    metrics: metrics ?? [],
    flags: flags ?? [],
    referrals: referrals ?? [],
    creatorHistory: history ?? [],
  })
}

const reviewSchema = z.object({
  action: z.enum(REVIEW_ACTIONS),
  reviewFeedback: z.string().max(2000).nullish(),   // creator-visible
  decisionReason: z.string().max(2000).nullish(),   // internal
})

const STATUS_FOR: Record<(typeof REVIEW_ACTIONS)[number], string> = {
  approve: "APPROVED",
  request_correction: "NEEDS_CORRECTION",
  reject: "REJECTED",
  disqualify: "DISQUALIFIED",
  mark_under_review: "UNDER_REVIEW",
}

export async function PATCH(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.submission.review")
  if (denied) return denied
  const { id } = await params

  try {
    const body = reviewSchema.parse(await request.json())
    const { data: s } = await supabase
      .from("creator_submissions")
      .select("id, status, creator_id, challenge_id, platform, content_url, creator_challenges(name)")
      .eq("id", id).maybeSingle()
    if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (["reject", "disqualify"].includes(body.action) && !body.decisionReason?.trim()) {
      return NextResponse.json({ error: "An internal decision reason is required for reject/disqualify." }, { status: 400 })
    }

    const next = STATUS_FOR[body.action]
    await supabase.from("creator_submissions").update({
      status: next,
      review_feedback: body.reviewFeedback ?? null,
      decision_reason: body.decisionReason ?? null,
      reviewed_by: session.userId,
      reviewed_by_name: session.name ?? session.username,
      reviewed_at: new Date().toISOString(),
      quarantined: body.action === "disqualify" ? false : undefined,
      updated_at: new Date().toISOString(),
    }).eq("id", id)

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_SUBMISSION_REVIEWED,
      entityType: "creator_submission", entityId: id,
      metadata: { action: body.action, from: s.status, to: next },
    })

    const challengeName = (s.creator_challenges as { name?: string } | null)?.name ?? "the challenge"
    const NOTIFY: Record<string, { title: string; body: string } | undefined> = {
      approve: { title: "Submission approved", body: `Your ${s.platform} content for "${challengeName}" was approved. Its tracking link is now live.` },
      request_correction: { title: "Submission needs correction", body: `Your submission for "${challengeName}" needs changes${body.reviewFeedback ? `: ${body.reviewFeedback}` : "."}` },
      reject: { title: "Submission not accepted", body: `Your submission for "${challengeName}" was not accepted${body.reviewFeedback ? `: ${body.reviewFeedback}` : "."}` },
      disqualify: { title: "Submission disqualified", body: `Your submission for "${challengeName}" was disqualified${body.reviewFeedback ? `: ${body.reviewFeedback}` : "."}` },
    }
    const n = NOTIFY[body.action]
    if (n) {
      void pushCreatorNotification({
        creatorId: s.creator_id as string, type: "CHALLENGE",
        title: n.title, body: n.body, link: `/creator/challenges/${s.challenge_id}`,
      })
    }
    return NextResponse.json({ success: true, status: next })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    return NextResponse.json({ error: "Review failed" }, { status: 500 })
  }
}

/* POST: record a metric snapshot (ADMIN source) or raise a flag. */
const metricSchema = z.object({
  type: z.literal("metric"),
  verified: z.boolean(),
  label: z.string().max(100).nullish(),
  views: z.number().min(0).nullish(), likes: z.number().min(0).nullish(),
  comments: z.number().min(0).nullish(), shares: z.number().min(0).nullish(),
  saves: z.number().min(0).nullish(), engagementRate: z.number().min(0).nullish(),
  clicks: z.number().min(0).nullish(), leads: z.number().min(0).nullish(),
  demoBookings: z.number().min(0).nullish(), signups: z.number().min(0).nullish(),
  conversions: z.number().min(0).nullish(),
})
const flagSchema = z.object({
  type: z.literal("flag"),
  flagType: z.string().min(2).max(60),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().min(3).max(2000),
})
const flagResolveSchema = z.object({
  type: z.literal("resolve_flag"),
  flagId: z.string().uuid(),
  resolution: z.enum(["RESOLVED", "DISMISSED"]),
  note: z.string().max(1000).nullish(),
})
const quarantineSchema = z.object({
  type: z.literal("quarantine"),
  quarantined: z.boolean(),
  reason: z.string().max(500).nullish(),
})
const checkSchema = z.object({ type: z.literal("check_availability") })

export async function POST(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.submission.review")
  if (denied) return denied
  const { id } = await params
  const { data: s } = await supabase
    .from("creator_submissions")
    .select("id, creator_id, challenge_id, content_url, status")
    .eq("id", id).maybeSingle()
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const ctx = auditContextFromSession(session, request)
  const raw = await request.json()

  try {
    const body = metricSchema.or(flagSchema).or(flagResolveSchema).or(quarantineSchema).or(checkSchema).parse(raw)

    if (body.type === "metric") {
      await recordMetricSnapshot(id, {
        source: "ADMIN", verified: body.verified, label: body.label ?? null,
        views: body.views, likes: body.likes, comments: body.comments,
        shares: body.shares, saves: body.saves, engagementRate: body.engagementRate,
        clicks: body.clicks, leads: body.leads, demoBookings: body.demoBookings,
        signups: body.signups, conversions: body.conversions,
        capturedBy: session.userId,
      })
      return NextResponse.json({ success: true })
    }

    if (body.type === "flag") {
      await raiseFlag({
        creatorId: s.creator_id as string, challengeId: s.challenge_id as string,
        submissionId: id, type: body.flagType, severity: body.severity,
        description: body.description, createdBy: session.userId,
      })
      await recordAudit(ctx, {
        action: AUDIT_ACTIONS.CREATOR_FLAG_RAISED, entityType: "creator_submission",
        entityId: id, metadata: { type: body.flagType, severity: body.severity },
      })
      return NextResponse.json({ success: true })
    }

    if (body.type === "resolve_flag") {
      await supabase.from("creator_flags").update({
        status: body.resolution, resolved_by: session.userId,
        resolved_at: new Date().toISOString(),
      }).eq("id", body.flagId).eq("submission_id", id)
      await recordAudit(ctx, {
        action: AUDIT_ACTIONS.CREATOR_FLAG_RESOLVED, entityType: "creator_flag",
        entityId: body.flagId, metadata: { resolution: body.resolution, note: body.note ?? null },
      })
      return NextResponse.json({ success: true })
    }

    if (body.type === "quarantine") {
      await supabase.from("creator_submissions").update({
        quarantined: body.quarantined,
        quarantine_reason: body.quarantined ? (body.reason ?? "Under integrity review") : null,
        updated_at: new Date().toISOString(),
      }).eq("id", id)
      return NextResponse.json({ success: true })
    }

    // check_availability — safe HEAD request to the content URL; flag if gone.
    try {
      const res = await fetch(s.content_url as string, {
        method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "MartPoint-ContentCheck/1.0" },
      })
      if (res.status === 404 || res.status === 410 || res.status === 401 || res.status === 403) {
        await raiseFlag({
          creatorId: s.creator_id as string, challengeId: s.challenge_id as string,
          submissionId: id, type: "CONTENT_REMOVED", severity: "HIGH",
          description: `Content URL returned HTTP ${res.status} — post may be deleted or made private.`,
          evidence: { url: s.content_url, httpStatus: res.status },
        })
        return NextResponse.json({ success: true, available: false, httpStatus: res.status })
      }
      return NextResponse.json({ success: true, available: true, httpStatus: res.status })
    } catch {
      return NextResponse.json({ success: true, available: null, note: "Could not reach the URL — no flag raised." })
    }
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    return NextResponse.json({ error: "Action failed" }, { status: 500 })
  }
}
