import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import { sendEmail } from "./email"
import { renderEmailTemplate } from "./email-templates"

export interface QuestionnaireField {
  name: string
  label: string
  type: "text" | "email" | "tel" | "number" | "select" | "textarea" | "date" | "boolean"
  options?: string[]
  required?: boolean
  default?: string | boolean | number
}

export const DEFAULT_QUESTIONNAIRE_FIELDS: QuestionnaireField[] = [
  { name: "businessName", label: "Business name", type: "text", required: true },
  { name: "businessType", label: "Business type", type: "select", options: ["Retail", "Supermarket", "Pharmacy", "Restaurant", "Beauty/Salon", "Services", "Other"], required: true },
  { name: "industry", label: "Industry", type: "text" },
  { name: "country", label: "Country", type: "text" },
  { name: "state", label: "State / Region", type: "text" },
  { name: "city", label: "City", type: "text" },
  { name: "address", label: "Address", type: "textarea" },
  { name: "branches", label: "Number of branches", type: "number", default: 1, required: true },
  { name: "staffSize", label: "Number of staff / users", type: "number", default: 1, required: true },
  { name: "approximateProductCount", label: "Approximate product/service count", type: "number" },
  { name: "productOrService", label: "Do you sell products, services or both?", type: "select", options: ["Product", "Service", "Both"] },
  { name: "existingPosSoftware", label: "Existing POS / software", type: "text" },
  { name: "onlineStoreRequired", label: "Do you need an online store?", type: "select", options: ["Yes", "No", "Maybe"] },
  { name: "hardwareAvailable", label: "Do you have hardware (POS, computer, tablet) available?", type: "select", options: ["Yes", "No", "Partially"] },
  { name: "receiptPrinterScannerRequired", label: "Do you need receipt printer / barcode scanner?", type: "select", options: ["Yes", "No", "Maybe"] },
  { name: "dataMigrationNeeded", label: "Do you need existing data migrated?", type: "select", options: ["Yes", "No", "Unsure"] },
  { name: "trainingPreference", label: "Training preference", type: "select", options: ["Remote", "Onsite", "Both"] },
  { name: "contactPerson", label: "Primary contact person", type: "text", required: true },
  { name: "phone", label: "Contact phone", type: "tel" },
  { name: "desiredGoLiveDate", label: "Desired go-live date", type: "date" },
  { name: "specialWorkflowRequirements", label: "Special workflow / requirements", type: "textarea" },
  { name: "notes", label: "Notes", type: "textarea" },
]

export function buildQuestionnairePublicUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng").replace(/\/$/, "")
  return `${base}/questionnaire/${token}`
}

export interface QuestionnaireLead {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  status: string
  questionnaireToken: string | null
  questionnaireStatus: string
  questionnaireFields: QuestionnaireField[]
  questionnaireResponses: Record<string, unknown>
  questionnaireSentAt: string | null
  questionnaireSubmittedAt: string | null
}

function mapQuestionnaireLead(row: Record<string, unknown>): QuestionnaireLead {
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    businessName: row.business_name as string,
    email: row.email as string,
    phone: row.phone as string,
    status: row.status as string,
    questionnaireToken: (row.questionnaire_token as string) ?? null,
    questionnaireStatus: (row.questionnaire_status as string) ?? "Not Sent",
    questionnaireFields: (row.questionnaire_fields as QuestionnaireField[]) ?? DEFAULT_QUESTIONNAIRE_FIELDS,
    questionnaireResponses: (row.questionnaire_responses as Record<string, unknown>) ?? {},
    questionnaireSentAt: (row.questionnaire_sent_at as string) ?? null,
    questionnaireSubmittedAt: (row.questionnaire_submitted_at as string) ?? null,
  }
}

export async function getLeadByQuestionnaireToken(token: string): Promise<QuestionnaireLead | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase.from("leads").select("*").eq("questionnaire_token", token).single()
  if (error || !data) return null
  return mapQuestionnaireLead(data)
}

export interface GenerateQuestionnaireInput {
  leadId: string
  fields?: QuestionnaireField[]
  send?: boolean
  email?: string
}

export async function generateQuestionnaire(
  input: GenerateQuestionnaireInput,
  actor: AuditContext
): Promise<{ ok: boolean; token?: string; url?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const token = crypto.randomUUID()
  const fields = input.fields && input.fields.length > 0 ? input.fields : DEFAULT_QUESTIONNAIRE_FIELDS
  const now = new Date().toISOString()

  const { data: lead, error } = await supabase
    .from("leads")
    .update({
      questionnaire_token: token,
      questionnaire_status: "Sent",
      questionnaire_fields: fields,
      questionnaire_sent_at: now,
    })
    .eq("id", input.leadId)
    .select()
    .single()

  if (error || !lead) return { ok: false, error: "Lead not found" }

  const url = buildQuestionnairePublicUrl(token)

  if (input.send !== false) {
    const mapped = mapQuestionnaireLead(lead)
    const email = input.email || mapped.email
    const { subject, html } = await buildQuestionnaireEmail(mapped, url)
    const sent = await sendEmail({
      to: email,
      subject,
      text: "",
      html,
    })
    if (!sent) return { ok: true, token, url, error: "Email delivery failed (link generated)" }
  }

  await recordAudit(actor, {
    action: AUDIT_ACTIONS.QUESTIONNAIRE_SENT,
    entityType: AUDIT_ENTITIES.QUESTIONNAIRE,
    entityId: input.leadId,
    metadata: { questionnaireToken: token, questionnaireSent: input.send !== false },
  })

  return { ok: true, token, url }
}

async function buildQuestionnaireEmail(lead: QuestionnaireLead, url: string): Promise<{ subject: string; html: string }> {
  const { subject } = await renderEmailTemplate("lead_questionnaire", {
    fullName: lead.fullName,
    businessName: lead.businessName,
    questionnaireLink: url,
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
              <div style="color:#E0EAFF; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-top:6px;">Partner Programme</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi ${escapeHtml(lead.fullName)},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                To prepare an accurate quote for <strong>${escapeHtml(lead.businessName)}</strong>, please complete this short requirements questionnaire.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                It only takes a few minutes and the details you provide will help us tailor the right MartPoint package for your business.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="${url}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Complete Questionnaire</a>
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

export async function submitQuestionnaireResponses(
  token: string,
  responses: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: statusCheck } = await supabase.from("leads").select("questionnaire_status").eq("questionnaire_token", token).single()
  if (!statusCheck) return { ok: false, error: "Invalid questionnaire link" }
  if ((statusCheck as { questionnaire_status: string }).questionnaire_status === "Reviewed") {
    return { ok: false, error: "This questionnaire has already been reviewed and cannot be updated" }
  }

  const { data: leadRow } = await supabase.from("leads").select("id").eq("questionnaire_token", token).single()
  const { error } = await supabase
    .from("leads")
    .update({
      questionnaire_responses: responses,
      questionnaire_status: "Submitted",
      questionnaire_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("questionnaire_token", token)

  if (error) return { ok: false, error: "Failed to save responses" }

  await recordAudit(
    { actorType: "SYSTEM", actorId: null, actorName: null },
    {
      action: AUDIT_ACTIONS.QUESTIONNAIRE_SUBMITTED,
      entityType: AUDIT_ENTITIES.QUESTIONNAIRE,
      entityId: (leadRow as { id: string } | null)?.id ?? null,
      metadata: { questionnaireToken: token, responsesSummary: Object.keys(responses) },
    }
  )
  return { ok: true }
}

export async function reviewQuestionnaire(leadId: string, actor: AuditContext): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { error } = await supabase
    .from("leads")
    .update({ questionnaire_status: "Reviewed", updated_at: new Date().toISOString() })
    .eq("id", leadId)
  if (error) return { ok: false, error: "Failed to mark questionnaire reviewed" }

  await recordAudit(actor, {
    action: AUDIT_ACTIONS.LEAD_UPDATED,
    entityType: AUDIT_ENTITIES.LEAD,
    entityId: leadId,
    metadata: { questionnaireStatus: "Reviewed" },
  })
  return { ok: true }
}
