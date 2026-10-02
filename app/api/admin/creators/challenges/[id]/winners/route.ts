import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { getChallenge, listAwards, finalizeAwardWinners } from "@/lib/creator-challenges"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const finalizeSchema = z.object({
  awardId: z.string().uuid(),
  winners: z.array(z.object({
    creatorId: z.string().uuid(),
    submissionId: z.string().uuid().nullish(),
    position: z.number().int().min(1).max(100),
    notes: z.string().max(1000).nullish(),
  })).min(1).max(100),
  confirm: z.literal(true),
})

/* Finalise winners for an award — creates creator_challenge_winners rows +
 * PENDING creator_rewards, audits, notifies. Reward.manage permission = the
 * authorised-finaliser gate (more privileged than challenge.manage). */
export async function POST(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.reward.manage")
  if (denied) return denied
  const { id } = await params
  const challenge = await getChallenge(id)
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!["JUDGING", "COMPLETED"].includes(challenge.status)) {
    return NextResponse.json({ error: "Winners can only be finalised while judging." }, { status: 409 })
  }

  try {
    const body = finalizeSchema.parse(await request.json())
    const awards = await listAwards(challenge.id)
    const award = awards.find((a) => a.id === body.awardId)
    if (!award) return NextResponse.json({ error: "Award not found for this challenge" }, { status: 404 })

    const positions = body.winners.map((w) => w.position)
    if (new Set(positions).size !== positions.length) {
      return NextResponse.json({ error: "Duplicate positions" }, { status: 400 })
    }
    const creatorIds = body.winners.map((w) => w.creatorId)
    if (new Set(creatorIds).size !== creatorIds.length) {
      return NextResponse.json({ error: "Same creator selected twice" }, { status: 400 })
    }

    const result = await finalizeAwardWinners(challenge, award, body.winners, {
      id: session.userId, name: session.name ?? session.username ?? "Admin",
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_REWARD_CREATED,
      entityType: "creator_challenge", entityId: challenge.id,
      metadata: {
        awardId: award.id, awardTitle: award.title,
        winners: body.winners.map((w) => ({ creatorId: w.creatorId, position: w.position })),
        rewardIds: result.rewardIds,
      },
    })
    return NextResponse.json({ success: true, rewardIds: result.rewardIds })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input — finalisation requires explicit confirmation." }, { status: 400 })
    return NextResponse.json({ error: "Finalisation failed" }, { status: 500 })
  }
}

export async function GET(_req: Request, { params }: Params) {
  const { denied } = await authorizeAdmin("creator.challenge.manage")
  if (denied) return denied
  const { id } = await params
  const { data } = await supabase
    .from("creator_challenge_winners")
    .select("*, creators(full_name, creator_id), creator_challenge_awards(title, award_type), creator_rewards(status, amount_kobo, non_cash_reward)")
    .eq("challenge_id", id)
  return NextResponse.json({ winners: data ?? [] })
}
