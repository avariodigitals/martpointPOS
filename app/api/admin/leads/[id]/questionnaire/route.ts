import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { generateQuestionnaire, DEFAULT_QUESTIONNAIRE_FIELDS, type QuestionnaireField } from "@/lib/lead-questionnaire"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { z } from "zod"

const postSchema = z.object({
  send: z.boolean().optional().default(true),
  email: z.string().email().optional(),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(["text", "email", "tel", "number", "select", "textarea", "date", "boolean"]),
    options: z.array(z.string()).optional(),
    required: z.boolean().optional(),
    default: z.union([z.string(), z.boolean(), z.number()]).optional(),
  })).optional(),
})

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  }

  const { data, error } = await supabase.from("leads").select("questionnaire_token, questionnaire_status, questionnaire_fields, questionnaire_responses, questionnaire_sent_at, questionnaire_submitted_at").eq("id", id).single()
  if (error || !data) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  return NextResponse.json({
    token: data.questionnaire_token,
    status: data.questionnaire_status,
    fields: data.questionnaire_fields || DEFAULT_QUESTIONNAIRE_FIELDS,
    responses: data.questionnaire_responses || {},
    sentAt: data.questionnaire_sent_at,
    submittedAt: data.questionnaire_submitted_at,
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  const { id } = await params

  try {
    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const ctx = auditContextFromSession(auth.session, request)
    const result = await generateQuestionnaire({
      leadId: id,
      send: parsed.data.send,
      email: parsed.data.email,
      fields: parsed.data.fields as QuestionnaireField[],
    }, ctx)

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ token: result.token, url: result.url, message: result.error || "Questionnaire link generated" })
  } catch {
    return NextResponse.json({ error: "Failed to generate questionnaire" }, { status: 500 })
  }
}
