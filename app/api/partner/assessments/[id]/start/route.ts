import { NextResponse } from "next/server"
import { authorizePartner, getPartnerSession } from "@/lib/partner-auth"
import { getAssignmentById, startAttempt } from "@/lib/partner-assessments"

/** Portal attempts are bound to the signed-in partner — not to a shareable token. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (auth.response) return auth.response

  const { id } = await params
  const assignment = await getAssignmentById(id)
  if (!assignment || assignment.partnerId !== auth.partner!.id || assignment.audience !== "PARTNER") {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
  }

  const result = await startAttempt(assignment)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({
    questions: result.questions,
    attemptNo: result.attempt?.attemptNo,
    deadlineAt: result.deadlineAt,
    serverNow: result.serverNow,
    secondsLeft: result.secondsLeft,
  })
}
