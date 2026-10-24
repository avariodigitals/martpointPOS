import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { questionnaireFieldSchema, type QuestionnaireField } from "@/lib/lead-questionnaire"
import {
  CREATOR_SAMPLE_QUESTION_PACKS,
  listApplicationQuestionRounds,
  sendApplicationQuestionRound,
  sendApplicationQuestionReminder,
  withSignedAttachmentUrls,
} from "@/lib/creator-application-questions"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("creator.view")
  if (auth.denied) return auth.denied
  const { id } = await params
  const rounds = await listApplicationQuestionRounds(id)
  return NextResponse.json({
    rounds: await Promise.all(rounds.map(withSignedAttachmentUrls)),
    samplePacks: CREATOR_SAMPLE_QUESTION_PACKS,
    publicSiteUrl: (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, ""),
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("creator.application.review")
  if (auth.denied) return auth.denied
  const { id } = await params
  const reminderSchema = z.object({ action: z.literal("REMIND"), roundId: z.string().uuid() })
  const schema = z.object({
    title: z.string().trim().max(200).optional().default("Additional Questions"),
    fields: z.array(questionnaireFieldSchema).min(1).max(30),
  })
  const body = await request.json().catch(() => null)
  const reminder = reminderSchema.safeParse(body)
  if (reminder.success) {
    const result = await sendApplicationQuestionReminder({
      roundId: reminder.data.roundId,
      origin: new URL(request.url).origin,
    })
    if (!result.ok) return NextResponse.json({ error: result.error || "Could not send reminder" }, { status: 400 })
    if (result.skipped) return NextResponse.json({ error: "This question round is no longer awaiting a response." }, { status: 400 })
    await recordAudit(auditContextFromSession(auth.session, request), {
      action: AUDIT_ACTIONS.CREATOR_APPLICATION_QUESTIONS_SENT,
      entityType: AUDIT_ENTITIES.CREATOR_APPLICATION,
      entityId: id,
      metadata: { roundId: reminder.data.roundId, reminder: true, emailSent: result.sent },
    })
    return NextResponse.json({ success: true, emailSent: result.sent })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid questions" }, { status: 400 })
  const result = await sendApplicationQuestionRound({
    applicationId: id, title: parsed.data.title, fields: parsed.data.fields as QuestionnaireField[],
    actorId: auth.session.userId, actorName: auth.session.name || auth.session.username, origin: new URL(request.url).origin,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  await recordAudit(auditContextFromSession(auth.session, request), {
    action: AUDIT_ACTIONS.CREATOR_APPLICATION_QUESTIONS_SENT,
    entityType: AUDIT_ENTITIES.CREATOR_APPLICATION,
    entityId: id,
    metadata: { roundId: result.round.id, questionCount: result.round.fields.length, emailSent: result.emailSent },
  })
  return NextResponse.json({ success: true, emailSent: result.emailSent, round: result.round, url: result.url })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("creator.application.review")
  if (auth.denied) return auth.denied
  const { id } = await params
  const parsed = z.object({ roundId: z.string().uuid() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid question round" }, { status: 400 })
  const now = new Date().toISOString()
  const { data: round, error } = await supabase.from("creator_application_question_rounds")
    .update({ status: "Reviewed", reviewed_at: now, updated_at: now })
    .eq("id", parsed.data.roundId).eq("application_id", id).eq("status", "Submitted").select("id").maybeSingle()
  if (error || !round) return NextResponse.json({ error: "Could not mark responses reviewed" }, { status: 400 })
  return NextResponse.json({ success: true })
}
