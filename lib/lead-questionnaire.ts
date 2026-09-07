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
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"
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
    const sent = await sendEmail({
      to: email,
      subject: "MartPoint Requirements Questionnaire",
      text: "",
      html: await buildQuestionnaireEmailHtml(mapped, url),
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

async function buildQuestionnaireEmailHtml(lead: QuestionnaireLead, url: string): Promise<string> {
  const tpl = await renderEmailTemplate("lead_questionnaire", {
    fullName: lead.fullName,
    businessName: lead.businessName,
    questionnaireLink: url,
  })

  const body = escapeHtml(tpl.text || `Hi ${lead.fullName},\n\nTo prepare an accurate quote for ${lead.businessName}, please complete this short requirements questionnaire:\n\n${url}\n\nBest regards,\nMartPoint Sales Team`)
    .replace(/\n/g, "<br/>")

  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
  <p>${body}</p>
  <p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:6px;text-decoration:none;">Complete Questionnaire</a></p>
  <p style="font-size:13px;color:#666;">${url}</p>
</body></html>`
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
