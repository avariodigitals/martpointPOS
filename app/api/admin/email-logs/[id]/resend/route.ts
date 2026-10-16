import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { resendLoggedEmail } from "@/lib/email-log-resend"

/* ───────────────  Resend a failed email from the logs screen  ───────────────
 * Replays the message stored on the log row (metadata.resend) through the
 * normal sendEmail() path, so the retry is branded, routed and logged exactly
 * like any other send — it simply appears as a new entry in the log.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("settings")
  if (denied) return denied

  const { id } = await params
  const result = await resendLoggedEmail(id)

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status })
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.EMAIL_RESENT,
    entityType: AUDIT_ENTITIES.EMAIL_LOG,
    entityId: id,
  })

  return NextResponse.json({ success: true })
}
