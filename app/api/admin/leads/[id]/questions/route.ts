import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { questionnaireFieldSchema, type QuestionnaireField } from "@/lib/lead-questionnaire"
import { createQuestionRound, listQuestionRounds, reviewQuestionRound } from "@/lib/lead-questions"
import { z } from "zod"

const postSchema = z.object({
  send: z.boolean().optional().default(true),
  email: z.string().email().optional(),
  fields: z.array(questionnaireFieldSchema).min(1, "Add at least one question"),
})

const patchSchema = z.object({
  roundId: z.string().min(1, "roundId is required"),
})

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  const { id } = await params

  const rounds = await listQuestionRounds(id)
  return NextResponse.json({ rounds })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  const { id } = await params

  try {
    const parsed = postSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const ctx = auditContextFromSession(auth.session, request)
    const result = await createQuestionRound(
      {
        leadId: id,
        send: parsed.data.send,
        email: parsed.data.email,
        fields: parsed.data.fields as QuestionnaireField[],
      },
      ctx
    )

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ token: result.token, url: result.url, message: result.error || "Additional questions link generated" })
  } catch {
    return NextResponse.json({ error: "Failed to send additional questions" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  const { id } = await params

  try {
    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const ctx = auditContextFromSession(auth.session, request)
    const result = await reviewQuestionRound(id, parsed.data.roundId, ctx)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to mark questions reviewed" }, { status: 500 })
  }
}
