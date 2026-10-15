import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { runPartnerAiReview } from "@/lib/partner-ai"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  const { id } = await params

  const result = await runPartnerAiReview(id, session!.userId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "AI review failed" }, { status: 500 })
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.PARTNER_AI_REVIEW_COMPLETED,
    entityType: AUDIT_ENTITIES.PARTNER_APPLICATION,
    entityId: id,
    metadata: { reviewId: result.reviewId },
  })

  return NextResponse.json({ success: true, reviewId: result.reviewId })
}
