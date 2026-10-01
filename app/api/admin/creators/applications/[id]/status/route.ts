import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import {
  changeCreatorApplicationStatus,
  approveCreatorApplication,
} from "@/lib/creator-applications"
import { getCreatorApplicationById } from "@/lib/creators"
import { sendCreatorNotification } from "@/lib/creator-notifications"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

const schema = z.object({
  status: z.enum(["MANUAL_REVIEW", "INTERVIEW_REQUESTED", "APPROVED", "WAITLISTED", "REJECTED", "SUSPENDED"]),
  reason: z.string().max(1000).optional().nullable(),
})

const SITE_URL = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://martpoint.com.ng").replace(/\/$/, "")

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("creator.application.review")
  if (denied) return denied
  const { id } = await params

  try {
    const body = schema.parse(await request.json())
    const actor = { id: session.userId, name: session.name || session.username }
    const ctx = auditContextFromSession(session, request)

    // Rejection requires a reason (visible to admin only by default).
    if ((body.status === "REJECTED" || body.status === "SUSPENDED") && !body.reason?.trim()) {
      return NextResponse.json({ error: "A reason is required for this decision." }, { status: 400 })
    }

    if (body.status === "APPROVED") {
      const result = await approveCreatorApplication(id, actor, ctx)
      if (!result.ok) {
        return NextResponse.json({ error: result.error || "Approval failed" }, { status: 400 })
      }
      return NextResponse.json({ success: true, creatorCode: result.creatorCode })
    }

    const ok = await changeCreatorApplicationStatus(id, body.status, actor, body.reason)
    if (!ok) return NextResponse.json({ error: "Failed to update status" }, { status: 500 })

    const action =
      body.status === "WAITLISTED" ? AUDIT_ACTIONS.CREATOR_WAITLISTED
      : body.status === "REJECTED" ? AUDIT_ACTIONS.CREATOR_REJECTED
      : body.status === "SUSPENDED" ? AUDIT_ACTIONS.CREATOR_SUSPENDED
      : AUDIT_ACTIONS.CREATOR_APPLICATION_STATUS_CHANGED

    await recordAudit(ctx, {
      action,
      entityType: AUDIT_ENTITIES.CREATOR_APPLICATION,
      entityId: id,
      metadata: { status: body.status, reason: body.reason ?? null },
    })

    // Notify the applicant on terminal states (generic copy — no internals).
    if (body.status === "WAITLISTED" || body.status === "REJECTED") {
      const app = await getCreatorApplicationById(id)
      if (app) {
        void sendCreatorNotification({
          template: body.status === "WAITLISTED" ? "creator_waitlisted" : "creator_rejected",
          to: app.email,
          applicationId: id,
          vars: {
            fullName: app.fullName,
            reference: app.referenceNumber,
            statusUrl: `${SITE_URL()}/creators/application-status`,
          },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
  }
}
