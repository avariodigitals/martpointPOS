import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { getAssignmentByToken, startAttempt } from "@/lib/partner-assessments"

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await checkRateLimit(request, { key: "partner-assessment-start", max: 10, windowSeconds: 600 })
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })
  }
  const { token } = await params
  const assignment = await getAssignmentByToken(token)
  if (!assignment) return NextResponse.json({ error: "This assessment link is invalid or has expired." }, { status: 404 })

  const result = await startAttempt(assignment)
  if (!result.ok) {
    return NextResponse.json({ error: result.error, attemptsUsed: assignment.attemptsUsed }, { status: 400 })
  }
  return NextResponse.json({
    questions: result.questions,
    attemptNo: result.attempt?.attemptNo,
    deadlineAt: result.deadlineAt,
    serverNow: result.serverNow,
    secondsLeft: result.secondsLeft,
    timeLimitMinutes: assignment.template.timeLimitMinutes,
  })
}
