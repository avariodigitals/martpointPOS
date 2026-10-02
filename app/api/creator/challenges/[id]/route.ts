import { NextResponse } from "next/server"
import { authorizeCreator } from "@/lib/creator-auth"
import { supabase } from "@/lib/supabase"
import {
  getChallenge, listAwards, getCurrentBrief, listChallengeResources,
  getParticipant, checkEligibility, latestMetricsForSubmission,
  referralCountsForSubmission,
} from "@/lib/creator-challenges"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/* Challenge detail for a creator: brief, awards, rules, resources,
 * eligibility, own participation + submissions + performance + leaderboard. */
export async function GET(_req: Request, { params }: Params) {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied
  const { id } = await params
  const challenge = await getChallenge(id)
  if (!challenge || ["DRAFT", "ARCHIVED"].includes(challenge.status)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const [awards, brief, resources, participant] = await Promise.all([
    listAwards(challenge.id),
    getCurrentBrief(challenge.id),
    listChallengeResources(challenge.id),
    getParticipant(challenge.id, creator.id),
  ])
  const eligibility = await checkEligibility(creator, challenge, participant)

  const { data: mySubs } = await supabase
    .from("creator_submissions")
    .select("id, platform, content_url, tracking_token, status, caption, published_at, submitted_at, review_feedback")
    .eq("challenge_id", challenge.id)
    .eq("creator_id", creator.id)
    .order("submitted_at", { ascending: false })

  const mySubmissions = await Promise.all(((mySubs ?? []) as Record<string, unknown>[]).map(async (s) => {
    const metrics = await latestMetricsForSubmission(s.id as string, challenge.performance_cutoff)
    const refs = await referralCountsForSubmission(s.id as string)
    return {
      id: s.id,
      platform: s.platform,
      contentUrl: s.content_url,
      trackingToken: s.tracking_token,
      status: s.status,
      caption: s.caption,
      publishedAt: s.published_at,
      submittedAt: s.submitted_at,
      reviewFeedback: s.review_feedback,
      metrics: metrics ? {
        verified: metrics.verified,
        views: metrics.views, likes: metrics.likes, comments: metrics.comments,
        shares: metrics.shares, engagementRate: metrics.engagement_rate,
      } : null,
      referrals: refs,
    }
  }))

  // Leaderboard — only safe metrics per config; only if admin enabled it.
  let leaderboard: { creatorCode: string; displayName: string; metrics: Record<string, number> }[] = []
  if (challenge.leaderboard_visible && ["ACTIVE", "SUBMISSION_CLOSED", "JUDGING", "COMPLETED"].includes(challenge.status)) {
    const allowed = new Set(challenge.leaderboard_metrics as string[])
    const { data: approvedSubs } = await supabase
      .from("creator_submissions")
      .select("id, creator_id, creators(creator_id, full_name)")
      .eq("challenge_id", challenge.id)
      .eq("status", "APPROVED")
    const byCreator = new Map<string, { creatorCode: string; displayName: string; metrics: Record<string, number> }>()
    for (const s of approvedSubs ?? []) {
      const cid = s.creator_id as string
      const cur = byCreator.get(cid) ?? {
        creatorCode: (s.creators as { creator_id?: string } | null)?.creator_id ?? "—",
        displayName: ((s.creators as { full_name?: string } | null)?.full_name ?? "Creator").split(" ")[0],
        metrics: {},
      }
      const m = await latestMetricsForSubmission(s.id as string, challenge.performance_cutoff)
      const refs = await referralCountsForSubmission(s.id as string)
      if (allowed.has("verified_reach") && m?.verified) cur.metrics.reach = (cur.metrics.reach ?? 0) + (Number(m.views) || 0)
      if (allowed.has("clicks")) cur.metrics.clicks = (cur.metrics.clicks ?? 0) + Math.max(Number(m?.clicks) || 0, refs.clicks)
      if (allowed.has("leads")) cur.metrics.leads = (cur.metrics.leads ?? 0) + Math.max(Number(m?.leads) || 0, refs.leads)
      if (allowed.has("conversions")) cur.metrics.conversions = (cur.metrics.conversions ?? 0) + Math.max(Number(m?.conversions) || 0, refs.customers)
      cur.metrics.submissions = (cur.metrics.submissions ?? 0) + 1
      byCreator.set(cid, cur)
    }
    leaderboard = [...byCreator.values()]
      .sort((a, b) => (b.metrics.reach ?? 0) + (b.metrics.conversions ?? 0) * 10 - ((a.metrics.reach ?? 0) + (a.metrics.conversions ?? 0) * 10))
      .slice(0, 20)
  }

  const needsAcknowledgement =
    participant?.status === "JOINED" &&
    challenge.rules_version > (participant.rules_version_accepted ?? 1) &&
    (participant.acknowledged_rules_version ?? 0) < challenge.rules_version

  return NextResponse.json({
    challenge: {
      id: challenge.id, name: challenge.name, slug: challenge.slug,
      description: challenge.description, objective: challenge.objective,
      theme: challenge.theme, status: challenge.status,
      startDate: challenge.start_date, submissionDeadline: challenge.submission_deadline,
      performanceCutoff: challenge.performance_cutoff, announcementDate: challenge.announcement_date,
      joinOpensAt: challenge.join_opens_at, joinClosesAt: challenge.join_closes_at,
      eligiblePlatforms: challenge.eligible_platforms,
      requiredHashtags: challenge.required_hashtags, requiredMentions: challenge.required_mentions,
      requiredCta: challenge.required_cta,
      contentRequirements: challenge.content_requirements,
      prohibitedClaims: challenge.prohibited_claims,
      judgingCriteria: challenge.judging_criteria,
      terms: challenge.terms,
      minSubmissions: challenge.min_submissions, maxSubmissions: challenge.max_submissions,
      rulesVersion: challenge.rules_version,
      amended: challenge.rules_version > 1,
      leaderboardVisible: challenge.leaderboard_visible,
    },
    awards: awards.map((a) => ({
      id: a.id, type: a.award_type, title: a.title, description: a.description,
      winnersCount: a.winners_count,
      cashNaira: a.cash_amount_kobo != null ? a.cash_amount_kobo / 100 : null,
      nonCashReward: a.non_cash_reward, judgingCriteria: a.judging_criteria,
    })),
    brief: brief?.sections ?? null,
    resources: resources.map((r) => {
      const rel = (r as { resource?: Record<string, unknown> | Record<string, unknown>[] }).resource
      const resource = Array.isArray(rel) ? rel[0] ?? null : rel ?? null
      return { linkId: r.id, required: r.required, resource }
    }),
    participant: participant ? {
      status: participant.status, joinedAt: participant.joined_at,
      rulesVersionAccepted: participant.rules_version_accepted,
      acknowledgedVersion: participant.acknowledged_rules_version,
    } : null,
    needsAcknowledgement,
    eligibility,
    mySubmissions,
    leaderboard,
    trackingBaseUrl: `https://www.martpoint.com.ng/?ref=${creator.referralCode}`,
  })
}
