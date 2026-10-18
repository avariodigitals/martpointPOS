import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { runCareerApplicationAiReview } from "@/lib/careers-ai"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/* POST: run (or re-run) the AI assessment for one application. */
export async function POST(request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.applications.review")
  if (denied) return denied
  const { id } = await ctx.params

  const result = await runCareerApplicationAiReview(id, session!.userId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "AI assessment failed" }, { status: 500 })
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_AI_REVIEW_COMPLETED,
    entityType: AUDIT_ENTITIES.CAREER_AI_REVIEW,
    entityId: id,
    metadata: { reviewId: result.reviewId },
  })

  return NextResponse.json({ success: true, reviewId: result.reviewId })
}
