/* ─────────── Additional lead questions (server-only) ───────────
 * Short follow-up rounds for a lead who already submitted the main
 * requirements questionnaire (lib/lead-questionnaire.ts).
 *
 * Why a separate table instead of more columns on `leads`:
 *   • the lead never redoes the long form — each round is its own link,
 *   • sales can send several rounds over time (e.g. after a demo), and
 *   • every round keeps its own questions + answers for documentation.
 *
 * Flow: admin composes questions on the lead → token + /questions/<token>
 *       link → lead answers → round is Submitted → admin marks it Reviewed.
 */

import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import { sendEmail, REPLY_TO } from "./email"
import { renderEmailTemplate } from "./email-templates"
import { escapeHtml } from "./email-html"
import type { QuestionnaireField } from "./lead-questionnaire"

export type QuestionRoundStatus = "Sent" | "Submitted" | "Reviewed"

export interface QuestionRound {
  id: string
  leadId: string
  token: string
  title: string
  status: QuestionRoundStatus
  fields: QuestionnaireField[]
  responses: Record<string, unknown>
  sentAt: string | null
  submittedAt: string | null
  reviewedAt: string | null
  createdAt: string | null
}

interface LeadContact {
  fullName: string
  businessName: string
  email: string
}

export function buildQuestionRoundPublicUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng").replace(/\/$/, "")
  return `${base}/questions/${token}`
}

export function mapQuestionRound(row: Record<string, unknown>): QuestionRound {
  return {
    id: row.id as string,
    leadId: row.lead_id as string,
    token: row.token as string,
    title: (row.title as string) || "Additional Questions",
    status: (row.status as QuestionRoundStatus) || "Sent",
    fields: (row.fields as QuestionnaireField[]) ?? [],
    responses: (row.responses as Record<string, unknown>) ?? {},
    sentAt: (row.sent_at as string) ?? null,
    submittedAt: (row.submitted_at as string) ?? null,
    reviewedAt: (row.reviewed_at as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
  }
}

export async function listQuestionRounds(leadId: string): Promise<QuestionRound[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("lead_question_rounds")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return data.map(mapQuestionRound)
}

export async function getQuestionRoundByToken(token: string): Promise<{ round: QuestionRound; lead: LeadContact } | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("lead_question_rounds")
    .select("*, leads(full_name, business_name, email)")
    .eq("token", token)
    .single()
  if (error || !data) return null

  const leadRow = (data as Record<string, unknown>).leads as Record<string, unknown> | null
  return {
    round: mapQuestionRound(data),
    lead: {
      fullName: (leadRow?.full_name as string) ?? "",
      businessName: (leadRow?.business_name as string) ?? "",
      email: (leadRow?.email as string) ?? "",
    },
  }
}

export interface CreateQuestionRoundInput {
  leadId: string
  fields: QuestionnaireField[]
  send?: boolean
  email?: string
}

export async function createQuestionRound(
  input: CreateQuestionRoundInput,
  actor: AuditContext
): Promise<{ ok: boolean; token?: string; url?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const fields = input.fields.filter((f) => f.name.trim() && f.label.trim())
  if (fields.length === 0) return { ok: false, error: "Add at least one question" }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("full_name, business_name, email")
    .eq("id", input.leadId)
    .single()
  if (leadError || !lead) return { ok: false, error: "Lead not found" }

  const token = crypto.randomUUID()
  const { data: round, error } = await supabase
    .from("lead_question_rounds")
    .insert({
      lead_id: input.leadId,
      token,
      fields,
      status: "Sent",
      sent_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error || !round) return { ok: false, error: "Failed to create questions round" }

  const url = buildQuestionRoundPublicUrl(token)
  const emailSent = input.send !== false

  if (emailSent) {
    const email = input.email || (lead.email as string)
    const { subject, html } = await buildQuestionRoundEmail(
      { fullName: lead.full_name as string, businessName: lead.business_name as string },
      url
    )
    const sent = await sendEmail({ to: email, subject, text: "", html, replyTo: REPLY_TO.noreply })
    if (!sent) return { ok: true, token, url, error: "Email delivery failed (link generated)" }
  }

  await recordAudit(actor, {
    action: AUDIT_ACTIONS.ADDITIONAL_QUESTIONS_SENT,
    entityType: AUDIT_ENTITIES.ADDITIONAL_QUESTIONS,
    entityId: input.leadId,
    metadata: { roundId: round.id as string, token, questionCount: fields.length, emailSent },
  })

  return { ok: true, token, url }
}

export async function submitQuestionRoundResponses(
  token: string,
  responses: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: round } = await supabase
    .from("lead_question_rounds")
    .select("id, lead_id, status")
    .eq("token", token)
    .single()
  if (!round) return { ok: false, error: "Invalid questions link" }

  const row = round as { id: string; lead_id: string; status: string }
  if (row.status === "Reviewed") {
    return { ok: false, error: "These questions have already been reviewed and cannot be updated" }
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from("lead_question_rounds")
    .update({ responses, status: "Submitted", submitted_at: now, updated_at: now })
    .eq("token", token)
  if (error) return { ok: false, error: "Failed to save answers" }

  await recordAudit(
    { actorType: "SYSTEM", actorId: null, actorName: null },
    {
      action: AUDIT_ACTIONS.ADDITIONAL_QUESTIONS_SUBMITTED,
      entityType: AUDIT_ENTITIES.ADDITIONAL_QUESTIONS,
      entityId: row.lead_id,
      metadata: { roundId: row.id, token, answeredQuestions: Object.keys(responses).length },
    }
  )
  return { ok: true }
}

export async function reviewQuestionRound(
  leadId: string,
  roundId: string,
  actor: AuditContext
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from("lead_question_rounds")
    .update({ status: "Reviewed", reviewed_at: now, updated_at: now })
    .eq("id", roundId)
    .eq("lead_id", leadId)
  if (error) return { ok: false, error: "Failed to mark questions reviewed" }

  await recordAudit(actor, {
    action: AUDIT_ACTIONS.ADDITIONAL_QUESTIONS_REVIEWED,
    entityType: AUDIT_ENTITIES.ADDITIONAL_QUESTIONS,
    entityId: leadId,
    metadata: { roundId },
  })
  return { ok: true }
}

async function buildQuestionRoundEmail(
  lead: { fullName: string; businessName: string },
  url: string
): Promise<{ subject: string; html: string }> {
  const { subject } = await renderEmailTemplate("lead_additional_questions", {
    fullName: lead.fullName,
    businessName: lead.businessName,
    questionsLink: url,
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f6f7; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); max-width:600px; width:100%;">
          <tr>
            <td style="padding:48px 40px 32px; text-align:center; background:linear-gradient(135deg, #0057FF 0%, #003BB3 100%);">
              <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">MartPoint</div>
              <div style="color:#E0EAFF; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-top:6px;">Additional Questions</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi ${escapeHtml(lead.fullName)},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Thanks for completing our requirements questionnaire for <strong>${escapeHtml(lead.businessName)}</strong>.
                To finalise your quote, we just need answers to a few additional questions.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                It will only take a couple of minutes — you don't need to fill the full questionnaire again.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="${url}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Answer Additional Questions</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280; word-break:break-all;">
                Or copy and paste this single link:<br />
                <a href="${url}" style="color:#0057FF; text-decoration:underline;">${url}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px; background-color:#f9fafb; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="font-size:12px; color:#6b7280; margin:0;">Best regards,<br/><strong>MartPoint Sales Team</strong></p>
              <p style="font-size:11px; color:#9ca3af; margin:8px 0 0;">This is an automated message — please do not reply. Use the link above to send us your answers.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}
