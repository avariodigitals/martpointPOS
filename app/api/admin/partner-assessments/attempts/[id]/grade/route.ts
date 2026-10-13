import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { recordStatusHistory } from "@/lib/partners"
import { supabase } from "@/lib/supabase"
import {
  getAttemptById,
  getAssignmentById,
  loadTemplateQuestions,
  buildPaper,
  gradeAttempt,
  applyManualMarks,
  finalizeAttemptAfterReview,
  type GradingResult,
} from "@/lib/partner-assessments"

const schema = z.object({
  marks: z.record(z.string(), z.object({
    awarded: z.coerce.number().min(0).max(100),
    note: z.string().trim().max(2000).optional(),
  })),
  notes: z.string().trim().max(4000).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const { id } = await params

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid marks" }, { status: 400 })
  }

  const attempt = await getAttemptById(id)
  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
  if (!attempt.submittedAt) return NextResponse.json({ error: "This attempt has not been submitted yet" }, { status: 400 })

  const assignment = await getAssignmentById(attempt.assignmentId)
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 })

  const all = await loadTemplateQuestions(assignment.templateId)
  const paper = buildPaper(all, assignment.template, `${assignment.id}:${attempt.attemptNo}`)
  const config = {
    passingScore: assignment.template.passingScore,
    conditionalScore: assignment.template.conditionalScore,
  }

  // Re-derive the auto-graded base from the stored answers, then layer the
  // admin's marks on top. Never trust a client-supplied score.
  const base: GradingResult = gradeAttempt(paper, attempt.answers, config)
  const result = applyManualMarks(paper, base, parsed.data.marks, config)

  const actor = { id: auth.session.userId, name: auth.session.name || auth.session.username }
  const saved = await finalizeAttemptAfterReview(attempt, assignment, result, actor, parsed.data.notes)
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 })

  await recordAudit(auditContextFromSession(auth.session, request), {
    action: AUDIT_ACTIONS.PARTNER_ASSESSMENT_MANUALLY_GRADED,
    entityType: AUDIT_ENTITIES.PARTNER_ASSESSMENT_ATTEMPT,
    entityId: id,
    metadata: {
      assignmentId: assignment.id,
      attemptNo: attempt.attemptNo,
      percent: result.percent,
      outcome: result.outcome,
      stillPending: result.needsReview,
    },
  })
  if (assignment.applicationId) {
    const { data: app } = await supabase.from("partner_applications").select("status").eq("id", assignment.applicationId).maybeSingle()
    await recordStatusHistory(
      assignment.applicationId, null, (app?.status as string) ?? null, (app?.status as string) ?? "SUBMITTED",
      result.needsReview
        ? `Assessment answers reviewed. Still awaiting marks on the remaining written answers.`
        : `Assessment reviewed: ${assignment.template.name} scored ${result.percent}% — ${result.outcome}.`,
      auth.session.userId,
      { changedByName: actor.name, eventType: "ASSESSMENT_GRADED" }
    )
  }

  return NextResponse.json({
    success: true,
    attempt: await getAttemptById(id),
    assignment: await getAssignmentById(assignment.id),
  })
}
