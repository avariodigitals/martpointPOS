/* ───────────────────────────  Creator Challenge Engine (Phase 3)  ───────────
 * One lifecycle: create → publish → eligible creators join → brief/resources
 * → submit content → review → performance captured → attribution → judging →
 * winners → rewards → close.
 *
 * Principles enforced here:
 *  - Joining ≠ winning; participation never guarantees payment.
 *  - Views alone never decide awards — scoring is per-award-type.
 *  - Rules are frozen at activation; material changes create a new immutable
 *    rule version, require a reason, and notify participants.
 *  - Metrics are append-only snapshots with source + verification status.
 *  - Fraud checks flag for review — they never auto-decide awards.
 *  - Only authorised admins finalise winners.
 */

import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { pushCreatorNotification, sendCreatorNotification } from "./creator-notifications"
import type { CreatorRecord } from "./creators"

export const CHALLENGE_STATUSES = [
  "DRAFT", "SCHEDULED", "ACTIVE", "SUBMISSION_CLOSED", "JUDGING", "COMPLETED", "ARCHIVED",
] as const
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number]

export const AWARD_TYPES = [
  "OVERALL", "CONVERSION", "REACH", "CREATIVE", "RISING", "REGIONAL", "CUSTOM",
] as const
export type AwardType = (typeof AWARD_TYPES)[number]

export const SUBMISSION_PLATFORMS = [
  "TIKTOK", "INSTAGRAM", "YOUTUBE", "FACEBOOK", "X", "LINKEDIN", "BLOG", "OTHER",
] as const
export type SubmissionPlatform = (typeof SUBMISSION_PLATFORMS)[number]

export const SUBMISSION_STATUSES = [
  "SUBMITTED", "UNDER_REVIEW", "APPROVED", "NEEDS_CORRECTION", "REJECTED", "DISQUALIFIED",
] as const

export const FLAG_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const

/** Fields that must not silently change once a challenge is ACTIVE. */
export const MATERIAL_FIELDS = [
  "eligible_levels", "eligible_states", "eligible_platforms",
  "required_hashtags", "required_mentions", "required_cta",
  "content_requirements", "prohibited_claims", "judging_criteria",
  "terms", "submission_deadline", "performance_cutoff",
  "min_submissions", "max_submissions", "creator_ready_required",
  "scoring_config",
] as const

/** Severity levels that quarantine a submission from winner finalisation. */
export const QUARANTINE_SEVERITIES = ["HIGH", "CRITICAL"] as const

export interface ChallengeRow {
  id: string
  name: string
  slug: string
  description: string | null
  objective: string | null
  theme: string | null
  start_date: string | null
  submission_deadline: string | null
  performance_cutoff: string | null
  announcement_date: string | null
  join_opens_at: string | null
  join_closes_at: string | null
  judging_date: string | null
  eligible_levels: string[]
  eligible_states: string[]
  eligible_platforms: string[]
  required_hashtags: string[]
  required_mentions: string[]
  required_cta: string | null
  content_requirements: string | null
  prohibited_claims: string | null
  judging_criteria: string | null
  terms: string | null
  featured: boolean
  leaderboard_visible: boolean
  leaderboard_metrics: string[]
  min_submissions: number
  max_submissions: number | null
  creator_ready_required: boolean
  scoring_config: Record<string, unknown>
  cover_image_path: string | null
  rules_version: number
  rules_frozen_at: string | null
  status: ChallengeStatus
  created_by: string | null
  created_at: string
}

export interface AwardRow {
  id: string
  challenge_id: string
  award_type: AwardType
  title: string
  description: string | null
  winners_count: number
  cash_amount_kobo: number | null
  non_cash_reward: string | null
  judging_criteria: string | null
  scoring_config: Record<string, unknown>
  sort_order: number
}

export interface ParticipantRow {
  id: string
  challenge_id: string
  creator_id: string
  status: "JOINED" | "WITHDRAWN" | "DISQUALIFIED"
  points: number
  joined_at: string
  rules_version_accepted: number
  terms_accepted_at: string
  acknowledged_rules_version: number | null
}

export interface SubmissionRow {
  id: string
  challenge_id: string
  creator_id: string
  participant_id: string | null
  tracking_token: string
  platform: SubmissionPlatform
  content_url: string
  caption: string | null
  published_at: string | null
  screenshot_path: string | null
  analytics_evidence_path: string | null
  notes: string | null
  status: string
  review_feedback: string | null
  decision_reason: string | null
  points: number
  quarantined: boolean
  quarantine_reason: string | null
  submitted_at: string
}

export interface MetricSnapshot {
  id: string
  submission_id: string
  source: "API" | "ADMIN" | "CREATOR"
  verified: boolean
  snapshot_label: string | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  engagement_rate: number | null
  clicks: number | null
  leads: number | null
  demo_bookings: number | null
  signups: number | null
  conversions: number | null
  captured_at: string
}

/* ───────────────────────────  Fetch helpers  ─────────────────────────── */

export async function getChallenge(idOrSlug: string): Promise<ChallengeRow | null> {
  if (!isSupabaseConfigured()) return null
  const col = /^[0-9a-f-]{36}$/i.test(idOrSlug) ? "id" : "slug"
  const { data } = await supabase
    .from("creator_challenges").select("*").eq(col, idOrSlug).maybeSingle()
  return (data as ChallengeRow | null) ?? null
}

export async function listAwards(challengeId: string): Promise<AwardRow[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("creator_challenge_awards")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("sort_order", { ascending: true })
  return (data as AwardRow[] | null) ?? []
}

export async function getCurrentBrief(challengeId: string): Promise<{ version: number; sections: Record<string, unknown> } | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("creator_challenge_briefs")
    .select("version, sections")
    .eq("challenge_id", challengeId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? { version: data.version as number, sections: (data.sections as Record<string, unknown>) ?? {} } : null
}

export async function listChallengeResources(challengeId: string) {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("creator_challenge_resources")
    .select("id, display_order, required, resource:creator_resources(id, name, description, category, file_path, external_url, version, active)")
    .eq("challenge_id", challengeId)
    .order("display_order", { ascending: true })
  return (data ?? []).filter((r) => (r as { resource?: { active?: boolean } }).resource?.active !== false)
}

export async function getParticipant(challengeId: string, creatorId: string): Promise<ParticipantRow | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("creator_challenge_participants")
    .select("*")
    .eq("challenge_id", challengeId)
    .eq("creator_id", creatorId)
    .maybeSingle()
  return (data as ParticipantRow | null) ?? null
}

/* ───────────────────────────  Eligibility  ─────────────────────────── */

export interface EligibilityResult {
  eligible: boolean
  reasons: string[]
}

/** Server-side eligibility check — never trust the client for this. */
export async function checkEligibility(
  creator: CreatorRecord,
  challenge: ChallengeRow,
  participant?: ParticipantRow | null,
): Promise<EligibilityResult> {
  const reasons: string[] = []
  if (participant === undefined) participant = await getParticipant(challenge.id, creator.id)

  if (creator.status !== "ACTIVE") {
    reasons.push("Your creator account is not active.")
  }

  if (participant?.status === "DISQUALIFIED") {
    reasons.push("You are not eligible for this challenge.")
  }

  if (challenge.creator_ready_required) {
    const { data: ob } = await supabase
      .from("creator_onboarding")
      .select("ready_at")
      .eq("creator_id", creator.id)
      .maybeSingle()
    if (!ob?.ready_at) {
      reasons.push("Complete Creator Onboarding to join this challenge.")
    }
  }

  if (challenge.eligible_levels.length > 0) {
    let levelName: string | null = null
    if (creator.levelId) {
      const { data: lvl } = await supabase
        .from("creator_levels").select("name").eq("id", creator.levelId).maybeSingle()
      levelName = (lvl?.name as string | null) ?? null
    }
    if (!levelName || !challenge.eligible_levels.includes(levelName)) {
      reasons.push("This challenge is open to specific creator levels.")
    }
  }

  if (challenge.eligible_states.length > 0 && !challenge.eligible_states.includes(creator.state ?? "")) {
    reasons.push("This challenge is currently available to creators in selected states.")
  }

  if (challenge.eligible_platforms.length > 0) {
    const { data: profiles } = await supabase
      .from("creator_social_profiles")
      .select("platform")
      .eq("creator_id", creator.id)
    const creatorPlatforms = new Set((profiles ?? []).map((p) => p.platform as string))
    if (!challenge.eligible_platforms.some((p) => creatorPlatforms.has(p))) {
      reasons.push(`This challenge requires a profile on: ${challenge.eligible_platforms.join(", ")}.`)
    }
  }

  const now = Date.now()
  if (challenge.status !== "ACTIVE" && challenge.status !== "SCHEDULED") {
    reasons.push("This challenge is not open for joining.")
  }
  if (challenge.join_opens_at && now < new Date(challenge.join_opens_at).getTime()) {
    reasons.push("Joining is not open yet.")
  }
  if (challenge.join_closes_at && now > new Date(challenge.join_closes_at).getTime()) {
    reasons.push("The joining window for this challenge has closed.")
  }

  return { eligible: reasons.length === 0, reasons }
}

/* ───────────────────────────  Joining  ─────────────────────────── */

export async function joinChallenge(
  creator: CreatorRecord,
  challenge: ChallengeRow,
): Promise<{ ok: boolean; error?: string; reasons?: string[] }> {
  const existing = await getParticipant(challenge.id, creator.id)
  if (existing?.status === "JOINED") return { ok: true } // idempotent
  if (existing?.status === "DISQUALIFIED") {
    return { ok: false, error: "You are not eligible for this challenge." }
  }

  const eligibility = await checkEligibility(creator, challenge, existing)
  if (!eligibility.eligible) {
    return { ok: false, error: "Not eligible", reasons: eligibility.reasons }
  }

  const row = {
    challenge_id: challenge.id,
    creator_id: creator.id,
    status: "JOINED",
    rules_version_accepted: challenge.rules_version,
    terms_accepted_at: new Date().toISOString(),
    joined_at: new Date().toISOString(),
    withdrawn_at: null,
  }
  const { error } = existing
    ? await supabase.from("creator_challenge_participants").update(row).eq("id", existing.id)
    : await supabase.from("creator_challenge_participants").insert(row)
  if (error) return { ok: false, error: "Could not join the challenge" }

  void pushCreatorNotification({
    creatorId: creator.id,
    type: "CHALLENGE",
    title: `You joined "${challenge.name}"`,
    body: "Check the challenge brief and resources, then submit your content before the deadline.",
    link: `/creator/challenges/${challenge.id}`,
  })
  return { ok: true }
}

/** Acknowledge an amended rules version (post-activation material change). */
export async function acknowledgeRules(creatorId: string, challengeId: string, version: number) {
  await supabase
    .from("creator_challenge_participants")
    .update({ acknowledged_rules_version: version, acknowledged_at: new Date().toISOString() })
    .eq("challenge_id", challengeId)
    .eq("creator_id", creatorId)
    .eq("status", "JOINED")
}

export async function withdrawFromChallenge(creatorId: string, challengeId: string) {
  const p = await getParticipant(challengeId, creatorId)
  if (!p || p.status !== "JOINED") return { ok: false, error: "Not joined" }
  await supabase
    .from("creator_challenge_participants")
    .update({ status: "WITHDRAWN", withdrawn_at: new Date().toISOString() })
    .eq("id", p.id)
  return { ok: true }
}

/* ───────────────────────────  Discovery (creator-facing)  ────────────────── */

export interface CreatorChallengeCard {
  challenge: ChallengeRow
  participant: ParticipantRow | null
  awardsCount: number
  topPrizeLabel: string | null
  eligible: boolean
  reasons: string[]
}

export async function listChallengesForCreator(creator: CreatorRecord): Promise<CreatorChallengeCard[]> {
  if (!isSupabaseConfigured()) return []
  const { data: challenges } = await supabase
    .from("creator_challenges")
    .select("*")
    .in("status", ["SCHEDULED", "ACTIVE", "SUBMISSION_CLOSED", "JUDGING", "COMPLETED"])
    .neq("status", "ARCHIVED")
    .order("created_at", { ascending: false })
  const rows = (challenges as ChallengeRow[] | null) ?? []
  if (rows.length === 0) return []

  const ids = rows.map((c) => c.id)
  const [{ data: parts }, { data: awards }] = await Promise.all([
    supabase.from("creator_challenge_participants").select("*").eq("creator_id", creator.id).in("challenge_id", ids),
    supabase.from("creator_challenge_awards").select("*").in("challenge_id", ids),
  ])
  const partByChallenge = new Map(((parts as ParticipantRow[] | null) ?? []).map((p) => [p.challenge_id, p]))
  const awardsByChallenge = new Map<string, AwardRow[]>()
  for (const a of (awards as AwardRow[] | null) ?? []) {
    awardsByChallenge.set(a.challenge_id, [...(awardsByChallenge.get(a.challenge_id) ?? []), a])
  }

  const cards: CreatorChallengeCard[] = []
  for (const c of rows) {
    const participant = partByChallenge.get(c.id) ?? null
    const challengeAwards = awardsByChallenge.get(c.id) ?? []
    const maxCash = Math.max(0, ...challengeAwards.map((a) => (a.cash_amount_kobo ?? 0) * a.winners_count))
    const elig = participant?.status === "JOINED"
      ? { eligible: true, reasons: [] }
      : await checkEligibility(creator, c, participant)
    cards.push({
      challenge: c,
      participant,
      awardsCount: challengeAwards.length,
      topPrizeLabel: maxCash > 0 ? `₦${(maxCash / 100).toLocaleString()}` : null,
      eligible: elig.eligible,
      reasons: elig.reasons,
    })
  }
  return cards
}

/* ───────────────────────────  Submissions  ─────────────────────────── */

export function normalizeContentUrl(url: string): string {
  const trimmed = url.trim()
  const noQuery = trimmed.split(/[?#]/)[0]
  return noQuery.replace(/\/+$/, "").toLowerCase()
}

export function isValidContentUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}

export async function createSubmission(
  creator: CreatorRecord,
  challenge: ChallengeRow,
  input: {
    platform: SubmissionPlatform
    contentUrl: string
    caption?: string | null
    publishedAt?: string | null
    screenshotPath?: string | null
    analyticsEvidencePath?: string | null
    notes?: string | null
  },
): Promise<{ ok: boolean; submission?: SubmissionRow; error?: string }> {
  const participant = await getParticipant(challenge.id, creator.id)
  if (!participant || participant.status !== "JOINED") {
    return { ok: false, error: "Join the challenge before submitting content." }
  }
  if (challenge.status !== "ACTIVE") {
    return { ok: false, error: "This challenge is not accepting submissions right now." }
  }
  if (challenge.submission_deadline && Date.now() > new Date(challenge.submission_deadline).getTime()) {
    return { ok: false, error: "The submission deadline for this challenge has passed." }
  }
  if (!isValidContentUrl(input.contentUrl)) {
    return { ok: false, error: "Please provide a valid public URL for your content." }
  }
  if (challenge.eligible_platforms.length > 0 && !challenge.eligible_platforms.includes(input.platform)) {
    return { ok: false, error: "That platform is not eligible for this challenge." }
  }
  if (challenge.max_submissions != null) {
    const { count } = await supabase
      .from("creator_submissions")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", challenge.id)
      .eq("creator_id", creator.id)
      .neq("status", "DISQUALIFIED")
    if ((count ?? 0) >= challenge.max_submissions) {
      return { ok: false, error: `This challenge allows a maximum of ${challenge.max_submissions} submission${challenge.max_submissions === 1 ? "" : "s"} per creator.` }
    }
  }
  if (input.publishedAt && challenge.start_date &&
      new Date(input.publishedAt).getTime() < new Date(challenge.start_date).getTime() - 24 * 3600 * 1000) {
    return { ok: false, error: "This content appears to have been published before the challenge started." }
  }

  const { data, error } = await supabase
    .from("creator_submissions")
    .insert({
      challenge_id: challenge.id,
      creator_id: creator.id,
      participant_id: participant.id,
      platform: input.platform,
      content_url: input.contentUrl.trim(),
      caption: input.caption ?? null,
      published_at: input.publishedAt ?? null,
      screenshot_path: input.screenshotPath ?? null,
      analytics_evidence_path: input.analyticsEvidencePath ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") {
      await raiseFlag({
        creatorId: creator.id,
        challengeId: challenge.id,
        type: "DUPLICATE_URL",
        severity: "MEDIUM",
        description: `Duplicate content URL submitted for challenge "${challenge.name}".`,
        evidence: { url: input.contentUrl },
      })
      return { ok: false, error: "This content URL has already been submitted. Each published post can only be entered once." }
    }
    console.error("[challenges] submission insert failed:", error.message)
    return { ok: false, error: "Could not save your submission" }
  }

  const submission = data as SubmissionRow
  await runSubmissionChecks(submission, challenge, creator)

  void pushCreatorNotification({
    creatorId: creator.id,
    type: "CHALLENGE",
    title: "Submission received",
    body: `Your ${input.platform} content for "${challenge.name}" is in the review queue.`,
    link: `/creator/challenges/${challenge.id}`,
  })
  return { ok: true, submission }
}

/* ───────────────────────────  Fraud / integrity checks  ────────────────── */

export async function raiseFlag(input: {
  creatorId?: string | null
  challengeId?: string | null
  submissionId?: string | null
  type: string
  severity: (typeof FLAG_SEVERITIES)[number]
  description: string
  evidence?: Record<string, unknown>
  createdBy?: string | null
}): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase.from("creator_flags").insert({
      creator_id: input.creatorId ?? null,
      challenge_id: input.challengeId ?? null,
      submission_id: input.submissionId ?? null,
      type: input.type,
      severity: input.severity,
      description: input.description,
      evidence: input.evidence ?? {},
      status: "OPEN",
      created_by: input.createdBy ?? null,
    })
  } catch (err) {
    console.error("[challenges] flag insert failed:", err)
  }
}

/** Deterministic checks run on every new submission. Never auto-rejects. */
async function runSubmissionChecks(
  submission: SubmissionRow,
  challenge: ChallengeRow,
  creator: CreatorRecord,
): Promise<void> {
  const flags: Parameters<typeof raiseFlag>[0][] = []

  // The submission's creator must own a social profile on the declared platform.
  const { data: profiles } = await supabase
    .from("creator_social_profiles")
    .select("platform, profile_url")
    .eq("creator_id", creator.id)
  const creatorPlatforms = new Set((profiles ?? []).map((p) => p.platform as string))
  if (submission.platform !== "BLOG" && submission.platform !== "OTHER" && !creatorPlatforms.has(submission.platform)) {
    flags.push({
      submissionId: submission.id,
      creatorId: creator.id,
      challengeId: challenge.id,
      type: "EVIDENCE_MISMATCH",
      severity: "MEDIUM",
      description: `Submitted on ${submission.platform} but creator has no registered ${submission.platform} profile.`,
      evidence: { url: submission.content_url },
    })
  }

  // Referral spike check will run on metric snapshots; flag obvious fast repeats
  // of the same challenge+creator (possible duplicate-submission attempts).
  const { count } = await supabase
    .from("creator_submissions")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challenge.id)
    .eq("creator_id", creator.id)
    .eq("status", "SUBMITTED")
  if ((count ?? 0) > 1) {
    flags.push({
      submissionId: submission.id,
      creatorId: creator.id,
      challengeId: challenge.id,
      type: "DUPLICATE_SUBMISSION",
      severity: "LOW",
      description: `Creator has ${count} pending submissions for this challenge.`,
    })
  }

  for (const f of flags) await raiseFlag(f)
}

/** True when a submission carries unresolved HIGH/CRITICAL flags — quarantined
 * from winner finalisation pending review. */
export async function hasBlockingFlags(submissionId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { count } = await supabase
    .from("creator_flags")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", submissionId)
    .in("severity", [...QUARANTINE_SEVERITIES])
    .in("status", ["OPEN", "UNDER_REVIEW"])
  return (count ?? 0) > 0
}

/* ───────────────────────────  Metrics  ─────────────────────────── */

/** Challenge-level policy knobs read from creator_challenges.scoring_config:
 *  - metricWindowDays: judge each submission on the snapshot nearest
 *    published_at + N days (comparable window regardless of publish date)
 *  - maxCashAwardsPerCreator: award-stacking cap (Pilot 001 = 1) */
export interface ChallengePolicy {
  metricWindowDays: number | null
  maxCashAwardsPerCreator: number | null
}
export function challengePolicy(challenge: ChallengeRow): ChallengePolicy {
  const cfg = challenge.scoring_config ?? {}
  const wd = Number(cfg.metricWindowDays)
  const cap = Number(cfg.maxCashAwardsPerCreator)
  return {
    metricWindowDays: Number.isFinite(wd) && wd > 0 ? wd : null,
    maxCashAwardsPerCreator: Number.isFinite(cap) && cap > 0 ? cap : null,
  }
}

/** Latest metric snapshot per submission, preferring snapshots captured at or
 *  before the cutoff; verified flag + source are preserved. Never mutates. */
export async function latestMetricsForSubmission(
  submissionId: string,
  cutoff?: string | null,
): Promise<MetricSnapshot | null> {
  if (!isSupabaseConfigured()) return null
  const base = supabase
    .from("creator_submission_metrics")
    .select("*")
    .eq("submission_id", submissionId)
    .order("captured_at", { ascending: false })
    .limit(1)
  const { data: before } = cutoff
    ? await supabase
        .from("creator_submission_metrics")
        .select("*")
        .eq("submission_id", submissionId)
        .lte("captured_at", cutoff)
        .order("captured_at", { ascending: false })
        .limit(1)
    : { data: null }
  const row = before?.[0] ?? (await base).data?.[0]
  return (row as MetricSnapshot | undefined) ?? null
}

/** Snapshot nearest to `published_at + windowDays`, never after the challenge
 *  cutoff. Gives every submission a comparable measurement window regardless
 *  of when in the period it was published. Falls back to the latest snapshot
 *  at/before the cutoff, then to the earliest available. */
export async function windowMetricsForSubmission(
  submissionId: string,
  publishedAt: string | null,
  windowDays: number,
  cutoff?: string | null,
): Promise<MetricSnapshot | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("creator_submission_metrics")
    .select("*")
    .eq("submission_id", submissionId)
    .lte("captured_at", cutoff ?? "9999-12-31")
    .order("captured_at", { ascending: true })
  const rows = (data ?? []) as MetricSnapshot[]
  if (rows.length === 0) return null
  if (!publishedAt) return rows[rows.length - 1]
  const target = new Date(publishedAt).getTime() + windowDays * 86400_000
  const atOrBefore = rows.filter((m) => new Date(m.captured_at).getTime() <= target)
  return atOrBefore.length ? atOrBefore[atOrBefore.length - 1] : rows[0]
}

/** Lead statuses treated as MartPoint-verified qualified enquiries. Anything
 *  below Qualified is a raw submission — tracked, but it does not decide
 *  conversion awards. */
const QUALIFIED_LEAD_STATUSES = ["Qualified", "Proposal", "Won"]

/** LEAD/DEMO referrals whose linked lead reached a qualified status. */
export async function qualifiedOutcomeCounts(submissionId: string) {
  const { data } = await supabase
    .from("creator_referrals")
    .select("event_type, lead_id")
    .eq("submission_id", submissionId)
    .in("event_type", ["LEAD", "DEMO"])
    .not("lead_id", "is", null)
  const leadIds = [...new Set((data ?? []).map((r) => r.lead_id as string))]
  if (leadIds.length === 0) return { leads: 0, demos: 0 }
  const { data: leadRows } = await supabase
    .from("leads").select("id, status").in("id", leadIds)
  const qualified = new Set(
    (leadRows ?? []).filter((l) => QUALIFIED_LEAD_STATUSES.includes(l.status as string)).map((l) => l.id),
  )
  let leads = 0, demos = 0
  for (const r of data ?? []) {
    if (!qualified.has(r.lead_id as string)) continue
    if (r.event_type === "LEAD") leads++
    else demos++
  }
  return { leads, demos }
}

export async function recordMetricSnapshot(
  submissionId: string,
  input: {
    source: "API" | "ADMIN" | "CREATOR"
    verified: boolean
    label?: string | null
    views?: number | null
    likes?: number | null
    comments?: number | null
    shares?: number | null
    saves?: number | null
    engagementRate?: number | null
    clicks?: number | null
    leads?: number | null
    demoBookings?: number | null
    signups?: number | null
    conversions?: number | null
    capturedBy?: string | null
  },
) {
  return supabase.from("creator_submission_metrics").insert({
    submission_id: submissionId,
    source: input.source,
    verified: input.verified,
    snapshot_label: input.label ?? null,
    views: input.views ?? null,
    likes: input.likes ?? null,
    comments: input.comments ?? null,
    shares: input.shares ?? null,
    saves: input.saves ?? null,
    engagement_rate: input.engagementRate ?? null,
    clicks: input.clicks ?? null,
    leads: input.leads ?? null,
    demo_bookings: input.demoBookings ?? null,
    signups: input.signups ?? null,
    conversions: input.conversions ?? null,
    captured_by: input.capturedBy ?? null,
  })
}

/** Attribute-based counts pulled from creator_referrals — always "verified". */
export async function referralCountsForSubmission(submissionId: string) {
  const { data } = await supabase
    .from("creator_referrals")
    .select("event_type")
    .eq("submission_id", submissionId)
  const counts = { clicks: 0, leads: 0, demos: 0, signups: 0, customers: 0 }
  for (const r of data ?? []) {
    if (r.event_type === "CLICK") counts.clicks++
    else if (r.event_type === "LEAD") counts.leads++
    else if (r.event_type === "DEMO") counts.demos++
    else if (r.event_type === "SIGNUP") counts.signups++
    else if (r.event_type === "CUSTOMER") counts.customers++
  }
  return counts
}

/* ───────────────────────────  Rules versioning & freezing  ────────────────── */

/** Snapshot challenge + awards + brief into an immutable rule version. */
export async function snapshotRules(
  challengeId: string,
  admin: { id: string | null; name: string | null },
  opts: { reason?: string | null; material?: boolean } = {},
): Promise<{ ok: boolean; version?: number; error?: string }> {
  const challenge = await getChallenge(challengeId)
  if (!challenge) return { ok: false, error: "Challenge not found" }
  const [awards, brief] = await Promise.all([listAwards(challengeId), getCurrentBrief(challengeId)])
  const version = challenge.rules_version

  const { error } = await supabase.from("creator_challenge_rule_versions").insert({
    challenge_id: challengeId,
    version,
    snapshot: { challenge, awards, brief: brief?.sections ?? null },
    reason: opts.reason ?? null,
    is_material: opts.material ?? false,
    created_by: admin.id,
    created_by_name: admin.name,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, version }
}

/** Detect whether a proposed update touches material fields post-freeze. */
export function detectMaterialChanges(
  challenge: ChallengeRow,
  patch: Record<string, unknown>,
): string[] {
  const changed: string[] = []
  for (const field of MATERIAL_FIELDS) {
    if (!(field in patch)) continue
    const current = challenge[field as keyof ChallengeRow]
    const next = patch[field]
    if (JSON.stringify(current ?? null) !== JSON.stringify(next ?? null)) changed.push(field)
  }
  return changed
}

/** Pre-activation completeness gate. */
export function validateForActivation(
  challenge: ChallengeRow,
  awards: AwardRow[],
  brief: Record<string, unknown> | null,
): string[] {
  const missing: string[] = []
  if (!challenge.name?.trim()) missing.push("Challenge name")
  if (!challenge.description?.trim() && !brief?.overview) missing.push("Description or brief overview")
  if (!challenge.start_date || !challenge.submission_deadline) missing.push("Start date and submission deadline")
  if (challenge.start_date && challenge.submission_deadline &&
      new Date(challenge.submission_deadline) <= new Date(challenge.start_date)) {
    missing.push("Submission deadline must be after the start date")
  }
  if (challenge.performance_cutoff && challenge.submission_deadline &&
      new Date(challenge.performance_cutoff) < new Date(challenge.submission_deadline)) {
    missing.push("Performance cutoff should be on or after the submission deadline")
  }
  if (challenge.announcement_date && challenge.performance_cutoff &&
      new Date(challenge.announcement_date) < new Date(challenge.performance_cutoff)) {
    missing.push("Announcement date should be on or after the performance cutoff")
  }
  if (challenge.eligible_platforms.length === 0) missing.push("At least one eligible platform")
  if (!challenge.terms?.trim()) missing.push("Terms and conditions")
  if (!challenge.judging_criteria?.trim()) missing.push("Judging criteria")
  if (!challenge.content_requirements?.trim() && challenge.required_hashtags.length === 0) {
    missing.push("Content requirements")
  }
  const prizeBased = awards.length > 0
  if (prizeBased && !awards.some((a) => a.cash_amount_kobo || a.non_cash_reward)) {
    missing.push("At least one award with a reward")
  }
  if (awards.length === 0) missing.push("At least one award")
  return missing
}

/* ───────────────────────────  Award candidates & scoring  ──────────────────
 * Per-award-type evaluation. Metric source preference: verified snapshots at
 * or before performance_cutoff, then referral counts (always system-verified).
 * RISING applies small-creator normalisation — performance relative to the
 * creator's declared following/baseline, protected by minimum thresholds so
 * tiny denominators don't dominate. All weights configurable per award via
 * scoring_config — nothing here is a hard-coded campaign rule.
 */

export interface AwardCandidate {
  creatorId: string
  creatorName: string
  creatorCode: string
  submissionId: string | null
  submissionUrl: string | null
  platform: string | null
  verifiedViews: number
  engagement: number
  clicks: number
  leads: number
  demos: number
  signups: number
  conversions: number
  qualifiedLeads: number
  qualifiedDemos: number
  followers: number | null
  /** APPLICATION_UNVERIFIED when the baseline comes from the creator's
   *  application form (self-reported) rather than MartPoint performance data. */
  baselineSource: "APPLICATION_UNVERIFIED" | null
  computedScore: number
  scoreBreakdown: Record<string, number>
  metricsVerified: boolean
  judgeScore: number | null   // average human score (0-100) where applicable
  quarantined: boolean
  flagCount: number
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export async function computeAwardCandidates(
  challenge: ChallengeRow,
  award: AwardRow,
): Promise<AwardCandidate[]> {
  // Eligible submissions: APPROVED, not disqualified participant
  const { data: subs } = await supabase
    .from("creator_submissions")
    .select("*, creators(full_name, creator_id, referral_code)")
    .eq("challenge_id", challenge.id)
    .eq("status", "APPROVED")
  const approved = (subs ?? []) as (SubmissionRow & { creators: { full_name: string; creator_id: string; referral_code: string } | null })[]

  const { data: disqualifiedParts } = await supabase
    .from("creator_challenge_participants")
    .select("creator_id")
    .eq("challenge_id", challenge.id)
    .eq("status", "DISQUALIFIED")
  const disqualified = new Set((disqualifiedParts ?? []).map((p) => p.creator_id as string))

  const { data: flagRows } = await supabase
    .from("creator_flags")
    .select("submission_id, severity")
    .eq("challenge_id", challenge.id)
    .in("status", ["OPEN", "UNDER_REVIEW"])
  const flagsBySub = new Map<string, { count: number; blocking: boolean }>()
  for (const f of flagRows ?? []) {
    const cur = flagsBySub.get(f.submission_id as string) ?? { count: 0, blocking: false }
    cur.count++
    if ((QUARANTINE_SEVERITIES as readonly string[]).includes(f.severity as string)) cur.blocking = true
    flagsBySub.set(f.submission_id as string, cur)
  }

  const { data: scores } = await supabase
    .from("creator_award_scores")
    .select("submission_id, creator_id, score")
    .eq("award_id", award.id)
  const judgeBySub = new Map<string, number[]>()
  const judgeByCreator = new Map<string, number[]>()
  for (const s of scores ?? []) {
    const key = (s.submission_id as string | null) ?? null
    if (key) judgeBySub.set(key, [...(judgeBySub.get(key) ?? []), num(s.score)])
    judgeByCreator.set(s.creator_id as string, [...(judgeByCreator.get(s.creator_id as string) ?? []), num(s.score)])
  }

  const { data: social } = await supabase
    .from("creator_social_profiles")
    .select("creator_id, followers, typical_views")
  const followersByCreator = new Map<string, number>()
  for (const p of social ?? []) {
    const f = num(p.followers)
    const cur = followersByCreator.get(p.creator_id as string) ?? 0
    if (f > cur) followersByCreator.set(p.creator_id as string, f)
  }

  const cutoff = challenge.performance_cutoff
  const cfg = award.scoring_config ?? {}
  const policy = challengePolicy(challenge)
  const candidates: AwardCandidate[] = []

  for (const sub of approved) {
    if (disqualified.has(sub.creator_id)) continue
    const metrics = policy.metricWindowDays
      ? await windowMetricsForSubmission(sub.id, sub.published_at, policy.metricWindowDays, cutoff)
      : await latestMetricsForSubmission(sub.id, cutoff)
    const refs = await referralCountsForSubmission(sub.id)
    const qualified = await qualifiedOutcomeCounts(sub.id)
    const fl = flagsBySub.get(sub.id) ?? { count: 0, blocking: false }

    const views = num(metrics?.views)
    const engagement = num(metrics?.likes) + num(metrics?.comments) + num(metrics?.shares) + num(metrics?.saves)
    const clicks = Math.max(num(metrics?.clicks), refs.clicks)
    const leads = Math.max(num(metrics?.leads), refs.leads)
    const demos = Math.max(num(metrics?.demo_bookings), refs.demos)
    const signups = Math.max(num(metrics?.signups), refs.signups)
    const conversions = Math.max(num(metrics?.conversions), refs.customers)
    const followers = followersByCreator.get(sub.creator_id) ?? null
    const judgeScores = judgeBySub.get(sub.id) ?? judgeByCreator.get(sub.creator_id) ?? []
    const judgeScore = judgeScores.length
      ? judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length
      : null

    const computed = computeScore(award.award_type, cfg, {
      views, engagement, clicks, leads, demos, signups, conversions,
      qualifiedLeads: qualified.leads, qualifiedDemos: qualified.demos,
      followers, judgeScore, verified: metrics?.verified ?? refs.clicks + refs.leads > 0,
    })

    candidates.push({
      creatorId: sub.creator_id,
      creatorName: sub.creators?.full_name ?? "Unknown",
      creatorCode: sub.creators?.creator_id ?? "",
      submissionId: sub.id,
      submissionUrl: sub.content_url,
      platform: sub.platform,
      verifiedViews: views,
      engagement, clicks, leads, demos, signups, conversions,
      qualifiedLeads: qualified.leads,
      qualifiedDemos: qualified.demos,
      followers,
      baselineSource: followers != null ? "APPLICATION_UNVERIFIED" : null,
      computedScore: computed.total,
      scoreBreakdown: computed.breakdown,
      metricsVerified: metrics?.verified ?? false,
      judgeScore,
      quarantined: sub.quarantined || fl.blocking,
      flagCount: fl.count,
    })
  }

  // Deduplicate to the creator's best submission per award ranking
  const best = new Map<string, AwardCandidate>()
  for (const c of candidates) {
    const cur = best.get(c.creatorId)
    if (!cur || c.computedScore > cur.computedScore) best.set(c.creatorId, c)
  }
  return [...best.values()].sort((a, b) => b.computedScore - a.computedScore)
}

interface ScoreInputs {
  views: number
  engagement: number
  clicks: number
  leads: number
  demos: number
  signups: number
  conversions: number
  qualifiedLeads: number
  qualifiedDemos: number
  followers: number | null
  judgeScore: number | null
  verified: boolean
}

function computeScore(
  type: AwardType,
  cfg: Record<string, unknown>,
  m: ScoreInputs,
): { total: number; breakdown: Record<string, number> } {
  const w = (key: string, dflt: number) => num(cfg[key], dflt)
  const breakdown: Record<string, number> = {}

  switch (type) {
    case "REACH": {
      breakdown.views = m.views * w("viewsWeight", 1)
      breakdown.engagement = m.engagement * w("engagementWeight", 0.5)
      break
    }
    case "CONVERSION": {
      // Only MartPoint-verified qualified enquiries decide this award; raw
      // form submissions are a weak tiebreaker signal at most.
      breakdown.qualifiedLeads = m.qualifiedLeads * w("qualifiedLeadsWeight", 2)
      breakdown.qualifiedDemos = m.qualifiedDemos * w("qualifiedDemosWeight", 5)
      breakdown.signups = m.signups * w("signupsWeight", 3)
      breakdown.conversions = m.conversions * w("conversionsWeight", 8)
      breakdown.rawLeads = (m.leads + m.demos) * w("rawWeight", 0.1)
      break
    }
    case "CREATIVE": {
      breakdown.judging = (m.judgeScore ?? 0) * w("judgingWeight", 1)
      breakdown.engagement = m.engagement * w("engagementWeight", 0.2)
      break
    }
    case "RISING": {
      const minViews = num(cfg.minViews, 0)
      const minEngagement = num(cfg.minEngagement, 0)
      if (m.views < minViews || m.engagement < minEngagement) {
        breakdown.belowThreshold = 0
        break
      }
      const engagementRate = m.views > 0 ? m.engagement / m.views : 0
      const relToFollowing = m.followers && m.followers > 0
        ? Math.min(m.views / m.followers, num(cfg.followerRatioCap, 10))
        : 0
      breakdown.engagementRate = engagementRate * w("engagementRateWeight", 100)
      breakdown.reachVsFollowing = relToFollowing * w("reachVsFollowingWeight", 10)
      breakdown.conversions = (m.leads + m.signups + m.conversions) * w("conversionsWeight", 2)
      breakdown.judging = (m.judgeScore ?? 0) * w("judgingWeight", 0.5)
      break
    }
    case "OVERALL":
    default: {
      breakdown.views = Math.log10(m.views + 1) * w("viewsWeight", 10)
      breakdown.engagement = m.engagement * w("engagementWeight", 0.5)
      breakdown.outcomes = (m.leads + m.demos * 2 + m.signups * 3 + m.conversions * 5) * w("outcomesWeight", 1)
      breakdown.judging = (m.judgeScore ?? 0) * w("judgingWeight", 1)
      break
    }
  }

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  return { total: Math.round(total * 100) / 100, breakdown }
}

/* ───────────────────────────  Winner finalisation  ────────────────────────── */

export async function finalizeAwardWinners(
  challenge: ChallengeRow,
  award: AwardRow,
  winners: { creatorId: string; submissionId?: string | null; position: number; notes?: string | null }[],
  admin: { id: string; name: string },
): Promise<{ ok: boolean; error?: string; rewardIds?: string[] }> {
  if (winners.length === 0) return { ok: false, error: "No winners selected" }
  if (winners.length > award.winners_count) {
    return { ok: false, error: `This award allows at most ${award.winners_count} winner${award.winners_count === 1 ? "" : "s"}.` }
  }

  const { count: existingCount } = await supabase
    .from("creator_challenge_winners")
    .select("id", { count: "exact", head: true })
    .eq("award_id", award.id)
  if ((existingCount ?? 0) + winners.length > award.winners_count) {
    return { ok: false, error: `Adding these winners would exceed the configured ${award.winners_count} winner slot${award.winners_count === 1 ? "" : "s"}.` }
  }

  // Quarantine check — HIGH/CRITICAL open flags block finalisation.
  for (const w of winners) {
    if (w.submissionId && (await hasBlockingFlags(w.submissionId))) {
      return { ok: false, error: "A selected winner's submission has unresolved high-severity flags. Review flags before finalising." }
    }
  }

  // Award-stacking cap (e.g. Pilot 001: one cash award per creator). Awards
  // are expected to be finalised in precedence order (sort_order); when a
  // creator already holds a cash award, the admin must pick the next-ranked
  // candidate for subsequent cash awards. Non-cash awards are unaffected.
  const policy = challengePolicy(challenge)
  if (policy.maxCashAwardsPerCreator != null && (award.cash_amount_kobo ?? 0) > 0) {
    const { data: cashWinners } = await supabase
      .from("creator_challenge_winners")
      .select("creator_id, creator_challenge_awards!inner(title, cash_amount_kobo)")
      .eq("challenge_id", challenge.id)
      .gt("creator_challenge_awards.cash_amount_kobo", 0)
    const held = new Map<string, string>()
    for (const w of cashWinners ?? []) {
      held.set(w.creator_id as string, (w.creator_challenge_awards as { title?: string } | null)?.title ?? "a cash award")
    }
    const heldCount = new Map<string, number>()
    for (const w of cashWinners ?? []) {
      heldCount.set(w.creator_id as string, (heldCount.get(w.creator_id as string) ?? 0) + 1)
    }
    for (const w of winners) {
      const existing = heldCount.get(w.creatorId) ?? 0
      if (existing >= policy.maxCashAwardsPerCreator) {
        return {
          ok: false,
          error: `This creator already holds cash award "${held.get(w.creatorId)}" — the challenge caps cash awards at ${policy.maxCashAwardsPerCreator} per creator. Apply award precedence and select the next-ranked candidate.`,
        }
      }
    }
  }

  const rewardIds: string[] = []
  for (const w of winners) {
    const { data: reward, error: rErr } = await supabase
      .from("creator_rewards")
      .insert({
        creator_id: w.creatorId,
        source: "CHALLENGE_AWARD",
        challenge_id: challenge.id,
        award_id: award.id,
        submission_id: w.submissionId ?? null,
        title: award.title,
        description: award.description,
        amount_kobo: award.cash_amount_kobo ?? 0,
        non_cash_reward: award.non_cash_reward,
        status: "PENDING",
        created_by: admin.id,
      })
      .select("id")
      .single()
    if (rErr) return { ok: false, error: "Failed to create reward record" }
    rewardIds.push(reward.id as string)

    const { error: wErr } = await supabase.from("creator_challenge_winners").insert({
      challenge_id: challenge.id,
      award_id: award.id,
      creator_id: w.creatorId,
      submission_id: w.submissionId ?? null,
      position: w.position,
      reward_id: reward.id,
      notes: w.notes ?? null,
      finalized_by: admin.id,
      finalized_by_name: admin.name,
    })
    if (wErr) return { ok: false, error: wErr.message.includes("duplicate") ? "Winner/position already assigned for this award." : "Failed to record winner" }

    void pushCreatorNotification({
      creatorId: w.creatorId,
      type: "CHALLENGE",
      title: `You won: ${award.title}!`,
      body: `Congratulations — you won "${award.title}" in "${challenge.name}". Your reward is being processed.`,
      link: `/creator/earnings`,
    })
  }
  return { ok: true, rewardIds }
}

/* ───────────────────────────  Communications  ────────────────────────────── */

export type ChallengeAudience =
  | "ELIGIBLE" | "JOINED" | "NO_SUBMISSION" | "APPROVED" | "SELECTED" | "WINNERS"

export async function resolveChallengeAudience(
  challenge: ChallengeRow,
  audience: ChallengeAudience,
  selectedCreatorIds?: string[],
): Promise<{ id: string; email: string; fullName: string }[]> {
  if (!isSupabaseConfigured()) return []

  switch (audience) {
    case "SELECTED":
      if (!selectedCreatorIds?.length) return []
      break
    case "JOINED":
    case "NO_SUBMISSION":
    case "APPROVED":
    case "WINNERS":
      break
    case "ELIGIBLE":
      break
  }

  if (audience === "JOINED" || audience === "NO_SUBMISSION" || audience === "APPROVED" || audience === "WINNERS") {
    let creatorIds: string[] = []
    if (audience === "JOINED") {
      const { data } = await supabase
        .from("creator_challenge_participants").select("creator_id")
        .eq("challenge_id", challenge.id).eq("status", "JOINED")
      creatorIds = (data ?? []).map((r) => r.creator_id as string)
    } else if (audience === "NO_SUBMISSION") {
      const [{ data: parts }, { data: subs }] = await Promise.all([
        supabase.from("creator_challenge_participants").select("creator_id")
          .eq("challenge_id", challenge.id).eq("status", "JOINED"),
        supabase.from("creator_submissions").select("creator_id").eq("challenge_id", challenge.id),
      ])
      const submitted = new Set((subs ?? []).map((s) => s.creator_id as string))
      creatorIds = (parts ?? []).map((p) => p.creator_id as string).filter((id) => !submitted.has(id))
    } else if (audience === "APPROVED") {
      const { data } = await supabase.from("creator_submissions").select("creator_id")
        .eq("challenge_id", challenge.id).eq("status", "APPROVED")
      creatorIds = [...new Set((data ?? []).map((s) => s.creator_id as string))]
    } else {
      const { data } = await supabase.from("creator_challenge_winners").select("creator_id")
        .eq("challenge_id", challenge.id)
      creatorIds = [...new Set((data ?? []).map((w) => w.creator_id as string))]
    }
    if (creatorIds.length === 0) return []
    const { data: creators } = await supabase.from("creators")
      .select("id, email, full_name").in("id", creatorIds).eq("status", "ACTIVE")
    return (creators ?? []).map((c) => ({ id: c.id as string, email: c.email as string, fullName: c.full_name as string }))
  }

  if (audience === "ELIGIBLE") {
    const { data: creators } = await supabase
      .from("creators")
      .select("id, email, full_name, state, level_id, status")
      .eq("status", "ACTIVE")
    const out: { id: string; email: string; fullName: string }[] = []
    for (const c of creators ?? []) {
      const { data: ob } = await supabase
        .from("creator_onboarding").select("ready_at").eq("creator_id", c.id).maybeSingle()
      if (challenge.creator_ready_required && !ob?.ready_at) continue
      if (challenge.eligible_states.length > 0 && !challenge.eligible_states.includes(c.state as string ?? "")) continue
      out.push({ id: c.id as string, email: c.email as string, fullName: c.full_name as string })
    }
    return out
  }

  // SELECTED
  const { data: creators } = await supabase.from("creators")
    .select("id, email, full_name").in("id", selectedCreatorIds ?? []).eq("status", "ACTIVE")
  return (creators ?? []).map((c) => ({ id: c.id as string, email: c.email as string, fullName: c.full_name as string }))
}

export async function notifyChallengeAudience(
  challenge: ChallengeRow,
  audience: ChallengeAudience,
  input: { title: string; body: string; sendEmail?: boolean; selectedCreatorIds?: string[] },
): Promise<{ sent: number; emailed: number; error?: string }> {
  const recipients = await resolveChallengeAudience(challenge, audience, input.selectedCreatorIds)
  if (recipients.length === 0) return { sent: 0, emailed: 0, error: "No matching creators for this audience." }

  let emailed = 0
  for (const r of recipients) {
    await pushCreatorNotification({
      creatorId: r.id,
      type: "CHALLENGE",
      title: input.title,
      body: input.body,
      link: `/creator/challenges/${challenge.id}`,
    })
    if (input.sendEmail) {
      const ok = await sendCreatorNotification({
        template: "creator_announcement",
        to: r.email,
        creatorId: r.id,
        vars: { name: r.fullName, title: input.title, message: input.body, challenge: challenge.name },
      })
      if (ok) emailed++
    }
  }
  return { sent: recipients.length, emailed }
}

/* ───────────────────────────  Submission tracking tokens  ─────────────────── */

/** Resolve a public tracking token to a submission (for ?ref=&s= links). */
export async function resolveSubmissionToken(
  token: string,
): Promise<{ submissionId: string; challengeId: string; creatorId: string } | null> {
  if (!isSupabaseConfigured() || !/^sub_[a-z0-9]{8,24}$/i.test(token)) return null
  const { data } = await supabase
    .from("creator_submissions")
    .select("id, challenge_id, creator_id")
    .eq("tracking_token", token.toLowerCase())
    .eq("status", "APPROVED")
    .maybeSingle()
  return data
    ? { submissionId: data.id as string, challengeId: data.challenge_id as string, creatorId: data.creator_id as string }
    : null
}

export function generateTrackingToken(): string {
  return `sub_${crypto.randomBytes(8).toString("hex")}`
}
