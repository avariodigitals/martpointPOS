import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCreator } from "@/lib/creator-auth"
import { recordAudit, auditContextFromCreatorSession, AUDIT_ACTIONS } from "@/lib/audit"
import { getChallenge, joinChallenge, withdrawFromChallenge, acknowledgeRules } from "@/lib/creator-challenges"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/* Join requires explicit terms acceptance — the accepted rules_version is
 * stored on the participant row and survives later amendments. */
export async function POST(request: Request, { params }: Params) {
  const { session, creator, denied } = await authorizeCreator()
  if (denied) return denied
  const { id } = await params
  const challenge = await getChallenge(id)
  if (!challenge || ["DRAFT", "ARCHIVED"].includes(challenge.status)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const body = z.object({ acceptTerms: z.literal(true) }).parse(await request.json())
    void body
    const result = await joinChallenge(creator, challenge)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, reasons: result.reasons }, { status: 400 })
    }
    await recordAudit(auditContextFromCreatorSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_CHALLENGE_UPDATED,
      entityType: "creator_challenge", entityId: challenge.id,
      metadata: { creatorJoined: true, rulesVersionAccepted: challenge.rules_version },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "You must accept the challenge terms to join." }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { session, creator, denied } = await authorizeCreator()
  if (denied) return denied
  const { id } = await params
  const result = await withdrawFromChallenge(creator.id, id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  await recordAudit(auditContextFromCreatorSession(session, request), {
    action: AUDIT_ACTIONS.CREATOR_CHALLENGE_UPDATED,
    entityType: "creator_challenge", entityId: id,
    metadata: { creatorWithdrew: true },
  })
  return NextResponse.json({ success: true })
}

/** Acknowledge an amended rules version. */
export async function PATCH(_req: Request, { params }: Params) {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied
  const { id } = await params
  const challenge = await getChallenge(id)
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await acknowledgeRules(creator.id, challenge.id, challenge.rules_version)
  return NextResponse.json({ success: true, acknowledgedVersion: challenge.rules_version })
}
