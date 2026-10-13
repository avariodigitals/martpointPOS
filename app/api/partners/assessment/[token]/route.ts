import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  getAssignmentByToken,
  getPaperForAssignment,
  listAttempts,
  OUTCOME_LABELS,
} from "@/lib/partner-assessments"

/**
 * Public, token-only. Reveals the paper for an in-progress attempt and the
 * applicant's own score afterwards — never the correct answers, unless the
 * template explicitly allows it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await checkRateLimit(request, { key: "partner-assessment-read", max: 60, windowSeconds: 300 })
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 })
  }
  const { token } = await params
  const assignment = await getAssignmentByToken(token)
  if (!assignment) {
    return NextResponse.json({ error: "This assessment link is invalid or has expired." }, { status: 404 })
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
    showResultImmediately: template.showResultImmediately,
    canStart: assignment.status === "PENDING" && assignment.attemptsUsed < template.maxAttempts,
  }

  if (assignment.status === "WAIVED") {
    return NextResponse.json({ ...base, waived: true, message: "This assessment has been waived by the Partner Team." })
  }
  if (assignment.status === "CANCELLED") {
    return NextResponse.json({ ...base, cancelled: true, message: "This assessment has been cancelled." })
  }

  const paper = await getPaperForAssignment(assignment)
  if (paper.ok && paper.questions) {
    return NextResponse.json({
      ...base,
      inProgress: true,
      questions: paper.questions,
      attemptNo: paper.attempt?.attemptNo,
      deadlineAt: paper.deadlineAt,
      serverNow: paper.serverNow,
      secondsLeft: paper.secondsLeft,
      answers: paper.attempt?.answers ?? {},
    })
  }

  // Nothing in progress: report the outcome the applicant is allowed to see.
  const attempts = await listAttempts(assignment.id)
  const last = attempts[0]
  const revealResult = template.showResultImmediately && last?.submittedAt && !last.needsReview
  return NextResponse.json({
    ...base,
    inProgress: false,
    completed: assignment.status === "GRADED" || assignment.status === "SUBMITTED",
    awaitingReview: attempts.some((a) => a.needsReview && a.submittedAt),
    bestPercent: assignment.bestPercent,
    finalOutcome: assignment.finalOutcome ? OUTCOME_LABELS[assignment.finalOutcome] : null,
    result: revealResult
      ? {
          percent: last?.percent ?? null,
          outcome: last?.outcome ? OUTCOME_LABELS[last.outcome] : null,
          attemptNo: last?.attemptNo ?? null,
        }
      : null,
  })
}
