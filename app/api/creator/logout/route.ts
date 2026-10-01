import { NextResponse } from "next/server"
import { getCreatorSession, destroyCreatorSession } from "@/lib/creator-auth"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromCreatorSession } from "@/lib/audit"

export async function POST(request: Request) {
  const session = await getCreatorSession()
  await destroyCreatorSession()
  if (session) {
    await recordAudit(auditContextFromCreatorSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_LOGOUT,
      entityType: AUDIT_ENTITIES.CREATOR,
      entityId: session.creatorId,
    })
  }
  return NextResponse.json({ success: true })
}
