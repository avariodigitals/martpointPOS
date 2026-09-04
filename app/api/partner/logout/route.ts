import { NextResponse } from "next/server"
import { destroyPartnerSession, getPartnerSession } from "@/lib/partner-auth"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromPartnerSession } from "@/lib/audit"

export async function POST(request: Request) {
  const session = await getPartnerSession()
  await destroyPartnerSession()

  if (session) {
    const ctx = auditContextFromPartnerSession(session, request)
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.PARTNER_USER_LOGOUT,
      entityType: AUDIT_ENTITIES.PARTNER_USER,
      entityId: session.partnerUserId,
      metadata: { partnerId: session.partnerId },
    })
  }

  return NextResponse.json({ success: true })
}
