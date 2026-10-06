import crypto from "node:crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, REPLY_TO } from "./email"
import { questionnaireFieldSchema, type QuestionnaireField } from "./lead-questionnaire"
import { escapeHtml } from "./email-html"

export type PartnerApplicationQuestionRound = {
  id: string
  application_id: string
  token: string
  title: string
  fields: QuestionnaireField[]
  responses: Record<string, unknown>
  status: "Sent" | "Submitted" | "Reviewed"
  sent_at: string | null
  submitted_at: string | null
  reviewed_at: string | null
  created_at: string
}

export async function listApplicationQuestionRounds(applicationId: string) {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase.from("partner_application_question_rounds").select("*")
    .eq("application_id", applicationId).order("created_at", { ascending: false })
  return error ? [] : (data || []) as PartnerApplicationQuestionRound[]
}

export async function sendApplicationQuestionRound(input: {
  applicationId: string; title: string; fields: QuestionnaireField[]; actorId: string; actorName: string; origin: string
}) {
  const fields = input.fields.filter((field) => field.name.trim() && field.label.trim())
  if (!fields.length) return { ok: false as const, error: "Add at least one question" }
  const checked = fields.map((field) => questionnaireFieldSchema.safeParse(field))
  if (checked.some((item) => !item.success)) return { ok: false as const, error: "One or more question fields are invalid" }
  const { data: app, error: appError } = await supabase.from("partner_applications")
    .select("id, reference_number, full_name, business_name, email, status")
    .eq("id", input.applicationId).single()
  if (appError || !app) return { ok: false as const, error: "Application not found" }
  if (!app.email) return { ok: false as const, error: "Applicant has no email address" }
  const token = crypto.randomUUID()
  const now = new Date().toISOString()
  const { data: round, error } = await supabase.from("partner_application_question_rounds").insert({
    application_id: input.applicationId, token, title: input.title.trim() || "Additional Questions", fields,
    status: "Sent", sent_at: now, created_by: input.actorId,
  }).select().single()
  if (error || !round) return { ok: false as const, error: "Could not save question round" }

  const url = `${input.origin.replace(/\/$/, "")}/partners/questions/${token}`
  const safeTitle = input.title.trim() || "Additional Questions"
  const sent = await sendEmail({
    to: app.email as string,
    subject: `MartPoint partner application: ${safeTitle}`,
    text: `Hello ${app.full_name || "there"},\n\nWe need a few additional details for partner application ${app.reference_number}. Please answer the questions here:\n${url}\n\nMartPoint Partner Team`,
    html: `<p>Hello ${escapeHtml(String(app.full_name || "there"))},</p><p>We need a few additional details for partner application <strong>${escapeHtml(String(app.reference_number))}</strong>.</p><p><a href="${url}">Answer the additional questions</a></p><p>MartPoint Partner Team</p>`,
    replyTo: REPLY_TO.partners,
  })
  const nextStatus = "MORE_INFORMATION_REQUIRED"
  await supabase.from("partner_applications").update({
    status: nextStatus,
    information_request_message: "Please answer the additional questions sent by our Partner Team.",
    updated_at: now,
    reviewed_at: now,
    reviewed_by: input.actorId,
  }).eq("id", input.applicationId)
  const { error: historyError } = await supabase.from("partner_status_history").insert({
    application_id: input.applicationId, previous_status: app.status, new_status: nextStatus,
    reason: `${safeTitle} · ${fields.length} question(s) sent to ${app.email}${sent ? "" : " (email delivery failed)"}`,
    changed_by: input.actorId, changed_by_name: input.actorName, event_type: "QUESTIONS_SENT",
  })
  if (historyError) console.error("[partner-application] questions timeline insert failed", historyError.message)
  return { ok: true as const, round: round as PartnerApplicationQuestionRound, emailSent: sent, url }
}

export async function submitApplicationQuestionResponses(token: string, responses: Record<string, unknown>) {
  const { data: round } = await supabase.from("partner_application_question_rounds")
    .select("id, application_id, fields, status").eq("token", token).single()
  if (!round) return { ok: false as const, error: "Invalid or expired question link" }
  if (round.status !== "Sent") return { ok: false as const, error: "These questions have already been submitted" }
  const fields = round.fields as QuestionnaireField[]
  for (const field of fields) {
    if (!field.required) continue
    const answer = responses[field.name]
    if (answer === undefined || answer === null || answer === "" || (Array.isArray(answer) && answer.length === 0)) {
      return { ok: false as const, error: `Please answer: ${field.label}` }
    }
  }
  const now = new Date().toISOString()
  const { error } = await supabase.from("partner_application_question_rounds")
    .update({ responses, status: "Submitted", submitted_at: now, updated_at: now }).eq("id", round.id)
  if (error) return { ok: false as const, error: "Could not save your answers" }
  const { data: app } = await supabase.from("partner_applications").select("status").eq("id", round.application_id).single()
  const previousStatus = app?.status || "MORE_INFORMATION_REQUIRED"
  const newStatus = previousStatus === "MORE_INFORMATION_REQUIRED" ? "UNDER_REVIEW" : previousStatus
  if (newStatus !== previousStatus) await supabase.from("partner_applications").update({ status: newStatus, updated_at: now }).eq("id", round.application_id)
  await supabase.from("partner_status_history").insert({
    application_id: round.application_id, previous_status: previousStatus, new_status: newStatus,
    reason: "Applicant submitted answers to additional questions.", changed_by: null, changed_by_name: "Applicant", event_type: "QUESTIONS_SUBMITTED",
  })
  return { ok: true as const }
}
