import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { getChallenge, listAwards, computeAwardCandidates } from "@/lib/creator-challenges"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/* GET: all scores + computed candidates for the judging tab. */
export async function GET(_req: Request, { params }: Params) {
  const { denied } = await authorizeAdmin("creator.challenge.manage")
  if (denied) return denied
  const { id } = await params
  const challenge = await getChallenge(id)
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const awards = await listAwards(challenge.id)
  const { data: scores } = await supabase
    .from("creator_award_scores")
    .select("*, creators(full_name, creator_id)")
    .eq("challenge_id", challenge.id)
    .order("created_at", { ascending: false })

  const candidatesByAward: Record<string, unknown> = {}
  for (const award of awards) {
    candidatesByAward[award.id] = await computeAwardCandidates(challenge, award)
  }

  return NextResponse.json({ scores: scores ?? [], candidatesByAward, awards })
}

const scoreSchema = z.object({
  awardId: z.string().uuid(),
  submissionId: z.string().uuid().nullish(),
  creatorId: z.string().uuid(),
  criterion: z.string().trim().min(1).max(120),
  score: z.number().min(0).max(1000),
  notes: z.string().max(2000).nullish(),
  finalize: z.boolean().optional(),
})

export async function POST(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.challenge.manage")
  if (denied) return denied
  const { id } = await params
  const challenge = await getChallenge(id)
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!["SUBMISSION_CLOSED", "JUDGING", "COMPLETED"].includes(challenge.status)) {
    return NextResponse.json({ error: "Judging is only available once submissions are closed." }, { status: 409 })
  }

  try {
    const body = scoreSchema.parse(await request.json())

    // Manual upsert — the unique index is expression-based (COALESCE for
    // nullable submission_id), which on_conflict cannot target.
    let existing = supabase
      .from("creator_award_scores")
      .select("id")
      .eq("award_id", body.awardId)
      .eq("criterion", body.criterion)
      .eq("judge_admin_id", session.userId)
    existing = body.submissionId ? existing.eq("submission_id", body.submissionId) : existing.is("submission_id", null)
    const { data: found } = await existing.maybeSingle()

    const row = {
      challenge_id: challenge.id,
      award_id: body.awardId,
      submission_id: body.submissionId ?? null,
      creator_id: body.creatorId,
      judge_admin_id: session.userId,
      judge_name: session.name ?? session.username,
      criterion: body.criterion,
      score: body.score,
      notes: body.notes ?? null,
      finalized: body.finalize ?? false,
      updated_at: new Date().toISOString(),
    }
    const { error } = found
      ? await supabase.from("creator_award_scores").update(row).eq("id", found.id)
      : await supabase.from("creator_award_scores").insert(row)
    if (error) {
      console.error("[judging] score save failed:", error.message)
      return NextResponse.json({ error: "Failed to save score" }, { status: 500 })
    }
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_CHALLENGE_UPDATED,
      entityType: "creator_challenge", entityId: challenge.id,
      metadata: { judgingScore: { awardId: body.awardId, creatorId: body.creatorId, criterion: body.criterion, score: body.score, finalized: body.finalize ?? false } },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    return NextResponse.json({ error: "Failed to save score" }, { status: 500 })
  }
}
