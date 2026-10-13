import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import {
  getAssignmentById,
  listAttempts,
  loadTemplateQuestions,
  waiveAssignment,
  cancelAssignment,
  resendAssignmentEmail,
} from "@/lib/partner-assessments"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("partners", "view")
  if (auth.denied) return auth.denied
  const { id } = await params
  const assignment = await getAssignmentById(id)
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
  const [attempts, questions] = await Promise.all([
    listAttempts(id),
    loadTemplateQuestions(assignment.templateId),
  ])
  const wantPaper = new URL(request.url).searchParams.get("paper") === "1"
  return NextResponse.json({
    assignment,
    attempts,
    // Admin-only: carries correctKeys/acceptedKeywords so answers can be marked.
    questions,
    paper: wantPaper ? questions : undefined,
  })
}

const patchSchema = z.object({
  action: z.enum(["waive", "cancel", "resend"]),
  reason: z.string().trim().max(2000).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const { id } = await params
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid action" }, { status: 400 })
  }
  const actor = { id: auth.session.userId, name: auth.session.name || auth.session.username }
  const assignment = await getAssignmentById(id)
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 })

  if (parsed.data.action === "waive") {
    if (!parsed.data.reason) return NextResponse.json({ error: "A waiver needs a reason" }, { status: 400 })
    const result = await waiveAssignment(id, parsed.data.reason, actor)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    await recordAudit(auditContextFromSession(auth.session, request), {
      action: AUDIT_ACTIONS.PARTNER_ASSESSMENT_WAIVED,
      entityType: AUDIT_ENTITIES.PARTNER_ASSESSMENT_ASSIGNMENT,
      entityId: id,
      metadata: { reason: parsed.data.reason, templateName: assignment.template.name },
    })
    return NextResponse.json({ success: true, assignment: await getAssignmentById(id) })
  }

  if (parsed.data.action === "cancel") {
    const result = await cancelAssignment(id, actor.name)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    await recordAudit(auditContextFromSession(auth.session, request), {
      action: AUDIT_ACTIONS.PARTNER_ASSESSMENT_CANCELLED,
      entityType: AUDIT_ENTITIES.PARTNER_ASSESSMENT_ASSIGNMENT,
      entityId: id,
      metadata: { templateName: assignment.template.name },
    })
    return NextResponse.json({ success: true, assignment: await getAssignmentById(id) })
  }

  const emailSent = await resendAssignmentEmail(assignment, new URL(request.url).origin)
  if (!emailSent) return NextResponse.json({ error: "Could not send the email. Copy the link instead." }, { status: 502 })
  await recordAudit(auditContextFromSession(auth.session, request), {
    action: AUDIT_ACTIONS.PARTNER_ASSESSMENT_RESENT,
    entityType: AUDIT_ENTITIES.PARTNER_ASSESSMENT_ASSIGNMENT,
    entityId: id,
    metadata: { to: assignment.assigneeEmail },
  })
  return NextResponse.json({ success: true, emailSent: true })
}
