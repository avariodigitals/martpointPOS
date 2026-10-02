import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { AWARD_TYPES, SUBMISSION_PLATFORMS } from "@/lib/creator-challenges"

export const dynamic = "force-dynamic"

const awardSchema = z.object({
  id: z.string().uuid().optional(),
  awardType: z.enum(AWARD_TYPES),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(2000).nullish(),
  winnersCount: z.number().int().min(1).max(100),
  cashAmountNaira: z.number().min(0).nullish(),
  nonCashReward: z.string().max(500).nullish(),
  judgingCriteria: z.string().max(5000).nullish(),
  scoringConfig: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
})

const briefSchema = z.object({
  overview: z.string().max(10000).optional(),
  audience: z.string().max(5000).optional(),
  keyMessage: z.string().max(5000).optional(),
  directions: z.array(z.string().max(1000)).max(30).optional(),
  requiredElements: z.array(z.string().max(1000)).max(30).optional(),
  exampleIdeas: z.array(z.string().max(1000)).max(30).optional(),
  submissionInstructions: z.string().max(5000).optional(),
  judgingExplainer: z.string().max(5000).optional(),
})

const challengeSchema = z.object({
  name: z.string().trim().min(3).max(200),
  slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).nullish(),
  objective: z.string().max(2000).nullish(),
  theme: z.string().max(200).nullish(),
  startDate: z.string().nullish(),
  submissionDeadline: z.string().nullish(),
  performanceCutoff: z.string().nullish(),
  announcementDate: z.string().nullish(),
  joinOpensAt: z.string().nullish(),
  joinClosesAt: z.string().nullish(),
  judgingDate: z.string().nullish(),
  eligibleLevels: z.array(z.string()).optional(),
  eligibleStates: z.array(z.string()).optional(),
  eligiblePlatforms: z.array(z.enum(SUBMISSION_PLATFORMS)).optional(),
  requiredHashtags: z.array(z.string().max(80)).max(30).optional(),
  requiredMentions: z.array(z.string().max(80)).max(30).optional(),
  requiredCta: z.string().max(300).nullish(),
  contentRequirements: z.string().max(10000).nullish(),
  prohibitedClaims: z.string().max(10000).nullish(),
  judgingCriteria: z.string().max(10000).nullish(),
  terms: z.string().max(20000).nullish(),
  featured: z.boolean().optional(),
  leaderboardVisible: z.boolean().optional(),
  leaderboardMetrics: z.array(z.string()).optional(),
  minSubmissions: z.number().int().min(0).optional(),
  maxSubmissions: z.number().int().min(1).max(50).nullish(),
  creatorReadyRequired: z.boolean().optional(),
  coverImagePath: z.string().max(500).nullish(),
  scoringConfig: z.record(z.string(), z.unknown()).optional(),
  awards: z.array(awardSchema).max(20).optional(),
  brief: briefSchema.optional(),
  resourceIds: z.array(z.object({
    resourceId: z.string().uuid(),
    required: z.boolean().optional(),
    displayOrder: z.number().int().optional(),
  })).max(50).optional(),
})

export async function GET() {
  const { denied } = await authorizeAdmin("creator.challenge.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ challenges: [] })

  const { data: challenges } = await supabase
    .from("creator_challenges")
    .select("*")
    .order("created_at", { ascending: false })
  const rows = challenges ?? []
  if (rows.length === 0) return NextResponse.json({ challenges: [] })

  const ids = rows.map((c) => c.id as string)
  const [{ data: parts }, { data: subs }, { data: awards }] = await Promise.all([
    supabase.from("creator_challenge_participants").select("challenge_id").in("challenge_id", ids).eq("status", "JOINED"),
    supabase.from("creator_submissions").select("challenge_id, status").in("challenge_id", ids),
    supabase.from("creator_challenge_awards").select("challenge_id, cash_amount_kobo, winners_count").in("challenge_id", ids),
  ])

  const enriched = rows.map((c) => {
    const pCount = (parts ?? []).filter((p) => p.challenge_id === c.id).length
    const cSubs = (subs ?? []).filter((s) => s.challenge_id === c.id)
    const prizePool = (awards ?? [])
      .filter((a) => a.challenge_id === c.id)
      .reduce((sum, a) => sum + ((a.cash_amount_kobo as number | null) ?? 0) * ((a.winners_count as number) ?? 1), 0)
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      rulesVersion: c.rules_version,
      startDate: c.start_date,
      submissionDeadline: c.submission_deadline,
      performanceCutoff: c.performance_cutoff,
      announcementDate: c.announcement_date,
      participants: pCount,
      submissions: cSubs.length,
      approvedSubmissions: cSubs.filter((s) => s.status === "APPROVED").length,
      prizePoolKobo: prizePool || null,
      amended: (c.rules_version as number) > 1,
      createdAt: c.created_at,
    }
  })
  return NextResponse.json({ challenges: enriched })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("creator.challenge.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  try {
    const body = challengeSchema.parse(await request.json())

    const { data: challenge, error } = await supabase
      .from("creator_challenges")
      .insert({
        name: body.name,
        slug: body.slug,
        description: body.description ?? null,
        objective: body.objective ?? null,
        theme: body.theme ?? null,
        start_date: body.startDate || null,
        submission_deadline: body.submissionDeadline || null,
        performance_cutoff: body.performanceCutoff || null,
        announcement_date: body.announcementDate || null,
        join_opens_at: body.joinOpensAt || null,
        join_closes_at: body.joinClosesAt || null,
        judging_date: body.judgingDate || null,
        eligible_levels: body.eligibleLevels ?? [],
        eligible_states: body.eligibleStates ?? [],
        eligible_platforms: body.eligiblePlatforms ?? [],
        required_hashtags: body.requiredHashtags ?? [],
        required_mentions: body.requiredMentions ?? [],
        required_cta: body.requiredCta ?? null,
        content_requirements: body.contentRequirements ?? null,
        prohibited_claims: body.prohibitedClaims ?? null,
        judging_criteria: body.judgingCriteria ?? null,
        terms: body.terms ?? null,
        featured: body.featured ?? false,
        leaderboard_visible: body.leaderboardVisible ?? true,
        leaderboard_metrics: body.leaderboardMetrics ?? undefined,
        min_submissions: body.minSubmissions ?? 0,
        max_submissions: body.maxSubmissions ?? null,
        creator_ready_required: body.creatorReadyRequired ?? true,
        cover_image_path: body.coverImagePath ?? null,
        scoring_config: body.scoringConfig ?? {},
        status: "DRAFT",
        created_by: session.userId,
        updated_by: session.userId,
      })
      .select("id")
      .single()

    if (error || !challenge) {
      return NextResponse.json(
        { error: error?.code === "23505" ? "A challenge with this slug already exists" : "Failed to create challenge" },
        { status: 400 },
      )
    }
    const id = challenge.id as string

    if (body.awards?.length) {
      await supabase.from("creator_challenge_awards").insert(
        body.awards.map((a, i) => ({
          challenge_id: id,
          award_type: a.awardType,
          title: a.title,
          description: a.description ?? null,
          winners_count: a.winnersCount,
          cash_amount_kobo: a.cashAmountNaira != null ? Math.round(a.cashAmountNaira * 100) : null,
          non_cash_reward: a.nonCashReward ?? null,
          judging_criteria: a.judgingCriteria ?? null,
          scoring_config: a.scoringConfig ?? {},
          sort_order: a.sortOrder ?? i,
        })),
      )
    }

    if (body.brief && Object.keys(body.brief).length > 0) {
      await supabase.from("creator_challenge_briefs").insert({
        challenge_id: id, version: 1, sections: body.brief, created_by: session.userId,
      })
    }

    if (body.resourceIds?.length) {
      await supabase.from("creator_challenge_resources").insert(
        body.resourceIds.map((r, i) => ({
          challenge_id: id, resource_id: r.resourceId,
          required: r.required ?? false, display_order: r.displayOrder ?? i,
        })),
      )
    }

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_CHALLENGE_CREATED,
      entityType: "creator_challenge",
      entityId: id,
      metadata: { name: body.name, slug: body.slug },
    })
    return NextResponse.json({ success: true, id })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create challenge" }, { status: 500 })
  }
}
