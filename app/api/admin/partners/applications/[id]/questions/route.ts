import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { questionnaireFieldSchema, type QuestionnaireField } from "@/lib/lead-questionnaire"
import { listApplicationQuestionRounds, sendApplicationQuestionRound } from "@/lib/partner-application-questions"
import { supabase } from "@/lib/supabase"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("partners", "view")
  if (auth.denied) return auth.denied
  const { id } = await params
  return NextResponse.json({ rounds: await listApplicationQuestionRounds(id) })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const { id } = await params
  const schema = z.object({ title: z.string().trim().max(200).optional().default("Additional Questions"), fields: z.array(questionnaireFieldSchema).min(1).max(30) })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid questions" }, { status: 400 })
  const requestUrl = new URL(request.url)
  const result = await sendApplicationQuestionRound({
    applicationId: id, title: parsed.data.title, fields: parsed.data.fields as QuestionnaireField[],
    actorId: auth.session.userId, actorName: auth.session.name || auth.session.username, origin: requestUrl.origin,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  await recordAudit(auditContextFromSession(auth.session, request), {
    action: AUDIT_ACTIONS.PARTNER_APPLICATION_INFORMATION_REQUESTED,
    entityType: AUDIT_ENTITIES.PARTNER_APPLICATION,
    entityId: id,
    metadata: { roundId: result.round.id, questionCount: result.round.fields.length, emailSent: result.emailSent },
  })
  return NextResponse.json({ success: true, emailSent: result.emailSent, round: result.round, url: result.url })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const { id } = await params
  const parsed = z.object({ roundId: z.string().uuid() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid question round" }, { status: 400 })
  const now = new Date().toISOString()
  const { data: round, error } = await supabase.from("partner_application_question_rounds").update({ status: "Reviewed", reviewed_at: now, updated_at: now })
    .eq("id", parsed.data.roundId).eq("application_id", id).eq("status", "Submitted").select("id").maybeSingle()
  if (error || !round) return NextResponse.json({ error: "Could not mark responses reviewed" }, { status: 400 })
  const { data: app } = await supabase.from("partner_applications").select("status").eq("id", id).single()
  await supabase.from("partner_status_history").insert({
    application_id: id, previous_status: app?.status || null, new_status: app?.status || "SUBMITTED",
    reason: "Applicant's additional answers marked as reviewed.", changed_by: auth.session.userId,
    changed_by_name: auth.session.name || auth.session.username, event_type: "QUESTIONS_REVIEWED",
  })
  return NextResponse.json({ success: true })
}
