import { NextResponse } from "next/server"
import { getLeadByQuestionnaireToken, submitQuestionnaireResponses } from "@/lib/lead-questionnaire"

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const lead = await getLeadByQuestionnaireToken(token)
  if (!lead) return NextResponse.json({ error: "Invalid or expired questionnaire link" }, { status: 404 })

  return NextResponse.json({
    lead: {
      fullName: lead.fullName,
      businessName: lead.businessName,
      email: lead.email,
      phone: lead.phone,
    },
    fields: lead.questionnaireFields,
    responses: lead.questionnaireResponses,
    status: lead.questionnaireStatus,
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
    const result = await submitQuestionnaireResponses(token, responses)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to submit questionnaire" }, { status: 500 })
  }
}
