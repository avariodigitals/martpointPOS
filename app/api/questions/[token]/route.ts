import { NextResponse } from "next/server"
import { getQuestionRoundByToken, submitQuestionRoundResponses } from "@/lib/lead-questions"

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const found = await getQuestionRoundByToken(token)
  if (!found) return NextResponse.json({ error: "Invalid or expired questions link" }, { status: 404 })

  return NextResponse.json({
    lead: {
      fullName: found.lead.fullName,
      businessName: found.lead.businessName,
    },
    title: found.round.title,
    fields: found.round.fields,
    responses: found.round.responses,
    status: found.round.status,
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    const body = await request.json()
    const responses = body.responses as Record<string, unknown>
    if (!responses || typeof responses !== "object") {
      return NextResponse.json({ error: "responses object is required" }, { status: 400 })
    }
    const result = await submitQuestionRoundResponses(token, responses)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to submit answers" }, { status: 500 })
  }
}
