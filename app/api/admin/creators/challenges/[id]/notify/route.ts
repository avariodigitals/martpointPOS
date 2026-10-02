import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { getChallenge, notifyChallengeAudience } from "@/lib/creator-challenges"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const schema = z.object({
  audience: z.enum(["ELIGIBLE", "JOINED", "NO_SUBMISSION", "APPROVED", "SELECTED", "WINNERS"]),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(2000),
  sendEmail: z.boolean().optional(),
  selectedCreatorIds: z.array(z.string().uuid()).max(500).optional(),
})

export async function POST(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.notifications.send")
  if (denied) return denied
  const { id } = await params
  const challenge = await getChallenge(id)
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const body = schema.parse(await request.json())
    const result = await notifyChallengeAudience(challenge, body.audience, {
      title: body.title,
      body: body.body,
      sendEmail: body.sendEmail ?? false,
      selectedCreatorIds: body.selectedCreatorIds,
    })
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_BROADCAST_SENT,
      entityType: "creator_challenge", entityId: challenge.id,
      metadata: { audience: body.audience, title: body.title, sent: result.sent, emailed: result.emailed },
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    return NextResponse.json({ error: "Send failed" }, { status: 500 })
  }
}
