import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import {
  getChallenge, listAwards, getCurrentBrief, listChallengeResources,
  snapshotRules, detectMaterialChanges, validateForActivation,
  notifyChallengeAudience,
  type ChallengeRow,
} from "@/lib/creator-challenges"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/* ─── GET: full challenge detail for the tabbed admin view ─── */
export async function GET(_req: Request, { params }: Params) {
  const { denied } = await authorizeAdmin("creator.challenge.manage")
  if (denied) return denied
  const { id } = await params
  const challenge = await getChallenge(id)
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [awards, brief, resources, ruleVersions, participants, submissions, flags, winners] =
    await Promise.all([
      listAwards(challenge.id),
      getCurrentBrief(challenge.id),
      listChallengeResources(challenge.id),
      supabase.from("creator_challenge_rule_versions").select("id, version, reason, is_material, created_by_name, effective_at, created_at")
        .eq("challenge_id", challenge.id).order("version", { ascending: false }),
      supabase.from("creator_challenge_participants")
        .select("*, creators(full_name, creator_id, state, email)")
        .eq("challenge_id", challenge.id).order("joined_at", { ascending: false }),
      supabase.from("creator_submissions")
        .select("*, creators(full_name, creator_id)")
        .eq("challenge_id", challenge.id).order("submitted_at", { ascending: false }),
      supabase.from("creator_flags").select("*")
        .eq("challenge_id", challenge.id).order("created_at", { ascending: false }),
      supabase.from("creator_challenge_winners")
        .select("*, creators(full_name, creator_id), creator_challenge_awards(title, award_type)")
        .eq("challenge_id", challenge.id),
    ])

  // Per-submission: latest metric snapshot + referral counts + flag count
  const subIds = ((submissions.data ?? []) as { id: string }[]).map((s) => s.id)
  const { data: metrics } = subIds.length
    ? await supabase.from("creator_submission_metrics").select("*").in("submission_id", subIds)
        .order("captured_at", { ascending: false })
    : { data: [] }
  const { data: referrals } = subIds.length
    ? await supabase.from("creator_referrals").select("submission_id, event_type").in("submission_id", subIds)
    : { data: [] }

  const latestMetric = new Map<string, Record<string, unknown>>()
  for (const m of metrics ?? []) {
    if (!latestMetric.has(m.submission_id as string)) latestMetric.set(m.submission_id as string, m)
  }
  const refsBySub = new Map<string, Record<string, number>>()
  for (const r of referrals ?? []) {
    const cur = refsBySub.get(r.submission_id as string) ?? { clicks: 0, leads: 0, demos: 0, signups: 0, customers: 0 }
    if (r.event_type === "CLICK") cur.clicks++
    else if (r.event_type === "LEAD") cur.leads++
    else if (r.event_type === "DEMO") cur.demos++
    else if (r.event_type === "SIGNUP") cur.signups++
    else if (r.event_type === "CUSTOMER") cur.customers++
    refsBySub.set(r.submission_id as string, cur)
  }
  const flagCountBySub = new Map<string, number>()
  for (const f of flags.data ?? []) {
    if (f.submission_id && ["OPEN", "UNDER_REVIEW"].includes(f.status as string)) {
      flagCountBySub.set(f.submission_id as string, (flagCountBySub.get(f.submission_id as string) ?? 0) + 1)
    }
  }

  const submissionRows = (submissions.data ?? []).map((s) => {
    const m = latestMetric.get(s.id as string)
    const refs = refsBySub.get(s.id as string) ?? { clicks: 0, leads: 0, demos: 0, signups: 0, customers: 0 }
    return {
      id: s.id,
      creatorId: s.creator_id,
      creatorName: (s.creators as { full_name?: string } | null)?.full_name ?? "Unknown",
      creatorCode: (s.creators as { creator_id?: string } | null)?.creator_id ?? "",
      platform: s.platform,
      contentUrl: s.content_url,
      trackingToken: s.tracking_token,
      status: s.status,
      quarantined: s.quarantined,
      caption: s.caption,
      publishedAt: s.published_at,
      submittedAt: s.submitted_at,
      reviewedAt: s.reviewed_at,
      reviewFeedback: s.review_feedback,
      metrics: m ? {
        source: m.source, verified: m.verified, capturedAt: m.captured_at,
        views: m.views, likes: m.likes, comments: m.comments, shares: m.shares,
        engagementRate: m.engagement_rate,
      } : null,
      referrals: refs,
      openFlags: flagCountBySub.get(s.id as string) ?? 0,
    }
  })

  // Aggregate analytics
  const totalViews = [...latestMetric.values()].reduce((a, m) => a + (Number(m.views) || 0), 0)
  const totalRefs = [...refsBySub.values()].reduce(
    (a, r) => ({ clicks: a.clicks + r.clicks, leads: a.leads + r.leads, demos: a.demos + r.demos, signups: a.signups + r.signups, customers: a.customers + r.customers }),
    { clicks: 0, leads: 0, demos: 0, signups: 0, customers: 0 },
  )
  const participantsByState = new Map<string, number>()
  for (const p of participants.data ?? []) {
    const st = (p.creators as { state?: string } | null)?.state ?? "Unknown"
    if (p.status === "JOINED") participantsByState.set(st, (participantsByState.get(st) ?? 0) + 1)
  }

  return NextResponse.json({
    challenge,
    awards,
    brief: brief?.sections ?? null,
    briefVersion: brief?.version ?? null,
    resources,
    ruleVersions: ruleVersions.data ?? [],
    participants: (participants.data ?? []).map((p) => ({
      id: p.id, creatorId: p.creator_id,
      creatorName: (p.creators as { full_name?: string } | null)?.full_name ?? "Unknown",
      creatorCode: (p.creators as { creator_id?: string } | null)?.creator_id ?? "",
      state: (p.creators as { state?: string } | null)?.state ?? null,
      status: p.status, joinedAt: p.joined_at,
      rulesVersionAccepted: p.rules_version_accepted,
      acknowledgedVersion: p.acknowledged_rules_version,
    })),
    submissions: submissionRows,
    flags: flags.data ?? [],
    winners: winners.data ?? [],
    analytics: {
      participants: (participants.data ?? []).filter((p) => p.status === "JOINED").length,
      participantsByState: [...participantsByState.entries()].map(([state, count]) => ({ state, count })),
      submissions: submissionRows.length,
      approvedSubmissions: submissionRows.filter((s) => s.status === "APPROVED").length,
      approvalRate: submissionRows.length
        ? Math.round((submissionRows.filter((s) => s.status === "APPROVED").length / submissionRows.length) * 100)
        : 0,
      totalViews,
      referrals: totalRefs,
    },
  })
}

/* ─── PATCH: update challenge — freeze enforcement on material fields ─── */
const updateSchema = z.object({
  patch: z.record(z.string(), z.unknown()),
  reason: z.string().max(1000).optional(),
  confirmMaterialAmendment: z.boolean().optional(),
  notifyParticipants: z.boolean().optional(),
})

/** Map camelCase API keys → snake_case columns for allowed fields. */
const FIELD_MAP: Record<string, string> = {
  name: "name", description: "description", objective: "objective", theme: "theme",
  startDate: "start_date", submissionDeadline: "submission_deadline",
  performanceCutoff: "performance_cutoff", announcementDate: "announcement_date",
  joinOpensAt: "join_opens_at", joinClosesAt: "join_closes_at", judgingDate: "judging_date",
  eligibleLevels: "eligible_levels", eligibleStates: "eligible_states",
  eligiblePlatforms: "eligible_platforms", requiredHashtags: "required_hashtags",
  requiredMentions: "required_mentions", requiredCta: "required_cta",
  contentRequirements: "content_requirements", prohibitedClaims: "prohibited_claims",
  judgingCriteria: "judging_criteria", terms: "terms", featured: "featured",
  leaderboardVisible: "leaderboard_visible", leaderboardMetrics: "leaderboard_metrics",
  minSubmissions: "min_submissions", maxSubmissions: "max_submissions",
  creatorReadyRequired: "creator_ready_required", coverImagePath: "cover_image_path",
  scoringConfig: "scoring_config",
}

export async function PATCH(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.challenge.manage")
  if (denied) return denied
  const { id } = await params
  const challenge = await getChallenge(id)
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const { patch, reason, confirmMaterialAmendment, notifyParticipants } = updateSchema.parse(await request.json())
    const snakePatch: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(patch)) {
      const col = FIELD_MAP[k]
      if (col) snakePatch[col] = v
    }
    if (Object.keys(snakePatch).length === 0) return NextResponse.json({ error: "No editable fields" }, { status: 400 })

    const frozen = !!challenge.rules_frozen_at
    const materialChanged = detectMaterialChanges(challenge, snakePatch)

    if (frozen && materialChanged.length > 0) {
      if (!reason?.trim()) {
        return NextResponse.json({
          error: "This challenge is live — material changes require a reason, create a new rules version, and notify participants.",
          materialFields: materialChanged,
          requiresAmendment: true,
        }, { status: 409 })
      }
      if (!confirmMaterialAmendment) {
        return NextResponse.json({
          error: "Confirm the material amendment explicitly.",
          materialFields: materialChanged,
          requiresAmendment: true,
        }, { status: 409 })
      }
    }

    const nextVersion = frozen && materialChanged.length > 0 ? challenge.rules_version + 1 : challenge.rules_version
    snakePatch.updated_by = session.userId
    snakePatch.updated_at = new Date().toISOString()
    if (frozen && materialChanged.length > 0) snakePatch.rules_version = nextVersion

    const { error } = await supabase.from("creator_challenges").update(snakePatch).eq("id", challenge.id)
    if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 })

    if (frozen && materialChanged.length > 0) {
      await snapshotRules(challenge.id, { id: session.userId, name: session.name ?? session.username }, {
        reason, material: true,
      })
      if (notifyParticipants !== false) {
        void notifyChallengeAudience({ ...challenge, rules_version: nextVersion } as ChallengeRow, "JOINED", {
          title: `Rules updated: ${challenge.name}`,
          body: `The challenge rules were amended (version ${nextVersion}). Reason: ${reason}. Please review the updated challenge.`,
        })
      }
    }

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_CHALLENGE_UPDATED,
      entityType: "creator_challenge",
      entityId: challenge.id,
      metadata: {
        fields: Object.keys(snakePatch).filter((k) => !k.startsWith("updated")),
        materialChanged, reason: reason ?? null, rulesVersion: nextVersion,
      },
    })
    return NextResponse.json({ success: true, rulesVersion: nextVersion, materialChanged })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}

/* ─── POST: lifecycle actions ─── */
const actionSchema = z.object({
  action: z.enum([
    "activate", "schedule", "close_submissions", "start_judging",
    "complete", "archive", "save_brief", "replace_awards", "link_resources",
  ]),
  brief: z.record(z.string(), z.unknown()).optional(),
  awards: z.array(z.object({
    awardType: z.string(), title: z.string(), description: z.string().nullish(),
    winnersCount: z.number().int().min(1), cashAmountNaira: z.number().nullish(),
    nonCashReward: z.string().nullish(), judgingCriteria: z.string().nullish(),
    scoringConfig: z.record(z.string(), z.unknown()).optional(), sortOrder: z.number().int().optional(),
  })).optional(),
  resourceIds: z.array(z.object({
    resourceId: z.string().uuid(), required: z.boolean().optional(), displayOrder: z.number().int().optional(),
  })).optional(),
})

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["activate", "schedule"],
  SCHEDULED: ["activate"],
  ACTIVE: ["close_submissions"],
  SUBMISSION_CLOSED: ["start_judging"],
  JUDGING: ["complete"],
  COMPLETED: ["archive"],
  ARCHIVED: [],
}

const STATUS_FOR_ACTION: Record<string, string> = {
  activate: "ACTIVE", schedule: "SCHEDULED", close_submissions: "SUBMISSION_CLOSED",
  start_judging: "JUDGING", complete: "COMPLETED", archive: "ARCHIVED",
}

export async function POST(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.challenge.manage")
  if (denied) return denied
  const { id } = await params
  const challenge = await getChallenge(id)
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const body = actionSchema.parse(await request.json())
    const adminCtx = auditContextFromSession(session, request)

    if (body.action === "save_brief") {
      const current = await getCurrentBrief(challenge.id)
      const nextVersion = (current?.version ?? 0) + 1
      const { error } = await supabase.from("creator_challenge_briefs").insert({
        challenge_id: challenge.id, version: nextVersion, sections: body.brief ?? {},
        created_by: session.userId,
      })
      if (error) return NextResponse.json({ error: "Failed to save brief" }, { status: 500 })
      await recordAudit(adminCtx, {
        action: AUDIT_ACTIONS.CREATOR_CHALLENGE_UPDATED, entityType: "creator_challenge",
        entityId: challenge.id, metadata: { briefVersion: nextVersion },
      })
      return NextResponse.json({ success: true, briefVersion: nextVersion })
    }

    if (body.action === "replace_awards") {
      const { count: winnerCount } = await supabase.from("creator_challenge_winners")
        .select("id", { count: "exact", head: true })
        .in("award_id", (await listAwards(challenge.id)).map((a) => a.id))
      if ((winnerCount ?? 0) > 0 || challenge.rules_frozen_at) {
        return NextResponse.json({ error: "Awards cannot be replaced after activation or finalisation — amend with a new rules version instead." }, { status: 409 })
      }
      await supabase.from("creator_challenge_awards").delete().eq("challenge_id", challenge.id)
      if (body.awards?.length) {
        await supabase.from("creator_challenge_awards").insert(body.awards.map((a, i) => ({
          challenge_id: challenge.id, award_type: a.awardType, title: a.title,
          description: a.description ?? null, winners_count: a.winnersCount,
          cash_amount_kobo: a.cashAmountNaira != null ? Math.round(a.cashAmountNaira * 100) : null,
          non_cash_reward: a.nonCashReward ?? null, judging_criteria: a.judgingCriteria ?? null,
          scoring_config: a.scoringConfig ?? {}, sort_order: a.sortOrder ?? i,
        })))
      }
      await recordAudit(adminCtx, {
        action: AUDIT_ACTIONS.CREATOR_CHALLENGE_UPDATED, entityType: "creator_challenge",
        entityId: challenge.id, metadata: { awardsReplaced: body.awards?.length ?? 0 },
      })
      return NextResponse.json({ success: true })
    }

    if (body.action === "link_resources") {
      await supabase.from("creator_challenge_resources").delete().eq("challenge_id", challenge.id)
      if (body.resourceIds?.length) {
        await supabase.from("creator_challenge_resources").insert(body.resourceIds.map((r, i) => ({
          challenge_id: challenge.id, resource_id: r.resourceId,
          required: r.required ?? false, display_order: r.displayOrder ?? i,
        })))
      }
      return NextResponse.json({ success: true })
    }

    // Status transitions
    const allowed = ALLOWED_TRANSITIONS[challenge.status] ?? []
    if (!allowed.includes(body.action)) {
      return NextResponse.json({ error: `Cannot ${body.action} while challenge is ${challenge.status}` }, { status: 409 })
    }

    if (body.action === "activate" || body.action === "schedule") {
      const [awards, brief] = await Promise.all([listAwards(challenge.id), getCurrentBrief(challenge.id)])
      const missing = validateForActivation(challenge, awards, brief?.sections ?? null)
      if (missing.length > 0) {
        return NextResponse.json({ error: "Challenge is incomplete", missing }, { status: 400 })
      }
    }

    if (body.action === "activate") {
      // Freeze rules at activation — not at schedule, so SCHEDULED challenges
      // remain editable before going live.
      await supabase.from("creator_challenges").update({
        rules_frozen_at: new Date().toISOString(),
      }).eq("id", challenge.id)
      await snapshotRules(challenge.id, { id: session.userId, name: session.name ?? session.username })

      void notifyChallengeAudience(challenge, "ELIGIBLE", {
        title: `New challenge: ${challenge.name}`,
        body: `${challenge.description ?? "A new creator challenge is live."} Join now to participate.`,
        sendEmail: true,
      })
    }

    const next = STATUS_FOR_ACTION[body.action]
    await supabase.from("creator_challenges")
      .update({ status: next, updated_by: session.userId, updated_at: new Date().toISOString() })
      .eq("id", challenge.id)

    await recordAudit(adminCtx, {
      action: AUDIT_ACTIONS.CREATOR_CHALLENGE_STATUS_CHANGED,
      entityType: "creator_challenge", entityId: challenge.id,
      metadata: { from: challenge.status, to: next },
    })

    const NOTIFICATIONS: Record<string, { title: string; body: string; audience: "JOINED" } | undefined> = {
      close_submissions: { audience: "JOINED", title: `Submissions closed: ${challenge.name}`, body: "The submission window has closed. Performance will be measured until the cutoff." },
      start_judging: { audience: "JOINED", title: `Judging has begun: ${challenge.name}`, body: "Submissions are now being reviewed against the judging criteria." },
      complete: { audience: "JOINED", title: `Challenge completed: ${challenge.name}`, body: "This challenge has closed. Winners will be announced per the challenge terms." },
    }
    const n = NOTIFICATIONS[body.action]
    if (n) void notifyChallengeAudience(challenge, n.audience, { title: n.title, body: n.body })

    return NextResponse.json({ success: true, status: next })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    return NextResponse.json({ error: "Action failed" }, { status: 500 })
  }
}
