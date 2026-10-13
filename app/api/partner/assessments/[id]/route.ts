import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizePartner, getPartnerSession } from "@/lib/partner-auth"
import {
  getAssignmentById,
  getPaperForAssignment,
  listAttempts,
  submitAttempt,
  OUTCOME_LABELS,
} from "@/lib/partner-assessments"

async function guard() {
  const session = await getPartnerSession()
  return authorizePartner({ session, permission: "partner:resources:view" })
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guard()
  if (auth.response) return auth.response
  const { id } = await params
  const assignment = await getAssignmentById(id)
  if (!assignment || assignment.partnerId !== auth.partner!.id || assignment.audience !== "PARTNER") {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
  }

  const template = assignment.template
  const base = {
    title: template.name,
    tierName: assignment.tier.name,
    description: template.description,
    instructions: template.instructions,
    timeLimitMinutes: template.timeLimitMinutes,
    passingScore: template.passingScore,
    conditionalScore: template.conditionalScore,
    maxAttempts: template.maxAttempts,
    attemptsUsed: assignment.attemptsUsed,
    attemptsLeft: Math.max(0, template.maxAttempts - assignment.attemptsUsed),
    status: assignment.status,
    canStart: assignment.status === "PENDING" && assignment.attemptsUsed < template.maxAttempts,
  }

  const paper = await getPaperForAssignment(assignment)
  if (paper.ok && paper.questions) {
    return NextResponse.json({
      ...base,
      inProgress: true,
      questions: paper.questions,
      answers: paper.attempt?.answers ?? {},
      deadlineAt: paper.deadlineAt,
      serverNow: paper.serverNow,
      secondsLeft: paper.secondsLeft,
      attemptNo: paper.attempt?.attemptNo,
    })
  }

  const attempts = await listAttempts(assignment.id)
  const last = attempts[0]
  return NextResponse.json({
    ...base,
    inProgress: false,
    message: paper.error,
    completed: assignment.status === "GRADED" || assignment.status === "SUBMITTED",
    bestPercent: assignment.bestPercent,
    finalOutcome: assignment.finalOutcome ? OUTCOME_LABELS[assignment.finalOutcome] : null,
    awaitingReview: attempts.some((a) => a.needsReview && a.submittedAt),
    result: assignment.template.showResultImmediately && last?.submittedAt && !last.needsReview
      ? { percent: last.percent, outcome: last.outcome ? OUTCOME_LABELS[last.outcome] : null }
      : null,
  })
}

const schema = z.object({
  answers: z.record(z.string(), z.union([z.array(z.string().max(200)), z.string().max(20000)])),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guard()
  if (auth.response) return auth.response
  const { id } = await params

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Could not read your answers. Please try again." }, { status: 400 })
  }

  const assignment = await getAssignmentById(id)
  if (!assignment || assignment.partnerId !== auth.partner!.id || assignment.audience !== "PARTNER") {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
  }

  const result = await submitAttempt(assignment, parsed.data.answers)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const fresh = await getAssignmentById(id)
  const reveal = assignment.template.showResultImmediately && !result.needsReview
  return NextResponse.json({
    success: true,
    percent: reveal ? result.percent : null,
    outcome: reveal && result.outcome ? OUTCOME_LABELS[result.outcome] : null,
    awaitingReview: result.needsReview === true,
    attemptsUsed: fresh?.attemptsUsed ?? assignment.attemptsUsed,
    attemptsLeft: Math.max(0, assignment.template.maxAttempts - (fresh?.attemptsUsed ?? assignment.attemptsUsed)),
    canRetry: (fresh?.attemptsUsed ?? 0) < assignment.template.maxAttempts
      && result.outcome === "FAIL"
      && !result.needsReview,
  })
}
