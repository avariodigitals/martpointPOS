import { NextResponse } from "next/server"
import { z } from "zod"
import { checkRateLimit } from "@/lib/rate-limit"
import { getAssignmentByToken, submitAttempt, OUTCOME_LABELS } from "@/lib/partner-assessments"

const schema = z.object({
  answers: z.record(z.string(), z.union([z.array(z.string().max(200)), z.string().max(20000)])),
})

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await checkRateLimit(request, { key: "partner-assessment-submit", max: 12, windowSeconds: 600 })
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 })
  }
  const { token } = await params
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Could not read your answers. Please try again." }, { status: 400 })
  }

  const assignment = await getAssignmentByToken(token)
  if (!assignment) return NextResponse.json({ error: "This assessment link is invalid or has expired." }, { status: 404 })

  const result = await submitAttempt(assignment, parsed.data.answers)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const fresh = await getAssignmentByToken(token)
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
    showCorrectAnswers: assignment.template.showCorrectAnswers && reveal,
  })
}
