import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import {
  listAssignments,
  listAttempts,
  assignAssessment,
  evaluateApplicationAssessmentGate,
} from "@/lib/partner-assessments"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("partners", "view")
  if (auth.denied) return auth.denied
  const { id } = await params
  const assignments = await listAssignments({ applicationId: id })
  const attemptsPerAssignment = await Promise.all(assignments.map((a) => listAttempts(a.id)))
  const gate = await evaluateApplicationAssessmentGate(id)
  return NextResponse.json({
    assignments,
    attempts: attemptsPerAssignment.flat(),
    gate,
  })
}

const schema = z.object({
  templateId: z.string().uuid(),
  dueAt: z.string().datetime().nullable().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const { id } = await params
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid assignment" }, { status: 400 })
  }

  const result = await assignAssessment({
    templateId: parsed.data.templateId,
    applicationId: id,
    audience: "APPLICANT",
    dueAt: parsed.data.dueAt ?? null,
    actorId: auth.session.userId,
    actorName: auth.session.name || auth.session.username,
    origin: new URL(request.url).origin,
  })
  if (!result.ok || !result.assignment) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const a = result.assignment
  await recordAudit(auditContextFromSession(auth.session, request), {
    action: AUDIT_ACTIONS.PARTNER_ASSESSMENT_ASSIGNED,
    entityType: AUDIT_ENTITIES.PARTNER_ASSESSMENT_ASSIGNMENT,
    entityId: a.id,
    metadata: {
      applicationId: id,
      templateId: a.templateId,
      templateName: a.template.name,
      tierName: a.tier.name,
      audience: "APPLICANT",
      emailSent: result.emailSent,
    },
  })
  return NextResponse.json({
    success: true,
    assignment: a,
    url: result.url,
    emailSent: result.emailSent,
    gate: await evaluateApplicationAssessmentGate(id),
  })
}
