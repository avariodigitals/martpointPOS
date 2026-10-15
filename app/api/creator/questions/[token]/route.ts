import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { checkRateLimit } from "@/lib/rate-limit"
import type { QuestionnaireField } from "@/lib/lead-questionnaire"
import {
  getRoundByToken,
  submitApplicationQuestionResponses,
  uploadRoundAttachment,
} from "@/lib/creator-application-questions"

const MAX_FILES_PER_FIELD = 5

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Service unavailable" }, { status: 503 })
  const { token } = await params
  const { data: round, error } = await supabase.from("creator_application_question_rounds")
    .select("title, fields, responses, status, application:application_id(full_name, reference_number)")
    .eq("token", token).maybeSingle()
  if (error || !round) return NextResponse.json({ error: "This question link is invalid or has expired." }, { status: 404 })
  const applicant = round.application as unknown as { full_name: string; reference_number: string | null } | null
  return NextResponse.json({
    title: round.title,
    fields: round.fields,
    responses: round.responses,
    status: round.status,
    applicant: { fullName: applicant?.full_name || "there", reference: applicant?.reference_number || null },
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await checkRateLimit(request, { key: "creator-application-question-answer", max: 10, windowSeconds: 600 })
  if (!limited.allowed) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })
  const { token } = await params
  const round = await getRoundByToken(token)
  if (!round) return NextResponse.json({ error: "This question link is invalid or has expired." }, { status: 404 })
  if (round.status !== "Sent") return NextResponse.json({ error: "These questions have already been submitted." }, { status: 400 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 })
  }
  let values: Record<string, unknown> = {}
  try {
    const raw = form.get("responses")
    values = raw ? JSON.parse(String(raw)) as Record<string, unknown> : {}
  } catch {
    return NextResponse.json({ error: "Invalid answers" }, { status: 400 })
  }

  const fields = (round.fields || []) as QuestionnaireField[]
  const uploadedFileFields: string[] = []
  for (const field of fields) {
    if (field.type !== "file") continue
    const files = form.getAll(`file_${field.name}`).filter((f): f is File => f instanceof File && f.size > 0)
    if (!files.length) continue
    if (files.length > MAX_FILES_PER_FIELD) {
      return NextResponse.json({ error: `Please attach at most ${MAX_FILES_PER_FIELD} files for: ${field.label}` }, { status: 400 })
    }
    const attachments: { path: string; name: string; size: number; mime: string }[] = []
    for (const file of files) {
      const uploaded = await uploadRoundAttachment({
        roundId: round.id, filename: file.name, mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()),
      })
      if (!uploaded.ok) return NextResponse.json({ error: `${file.name}: ${uploaded.error}` }, { status: 400 })
      attachments.push(uploaded.attachment)
    }
    values[field.name] = attachments
    uploadedFileFields.push(field.name)
  }

  const result = await submitApplicationQuestionResponses(token, values, uploadedFileFields)
  return result.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: result.error }, { status: 400 })
}
