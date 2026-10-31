import { z } from "zod"

export const communicationChannel = z.enum(["email", "sms", "whatsapp", "call"])
export const communicationTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120), channel: communicationChannel,
  subject: z.string().trim().max(500).default(""), body: z.string().trim().min(1).max(20000),
}).superRefine((value, ctx) => {
  if (value.channel === "email" && !value.subject) ctx.addIssue({ code: "custom", path: ["subject"], message: "Email subject is required" })
  if (value.channel === "sms" && value.body.length > 480) ctx.addIssue({ code: "custom", path: ["body"], message: "SMS templates support up to 480 characters" })
  if (value.channel === "whatsapp" && value.body.length > 2000) ctx.addIssue({ code: "custom", path: ["body"], message: "WhatsApp messages support up to 2,000 characters" })
})
export const communicationWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(120), channel: communicationChannel,
  mode: z.enum(["template", "ai"]), template_id: z.uuid().nullable().default(null),
  instructions: z.string().trim().max(4000).default(""),
  trigger: z.enum(["new_lead", "no_reply", "manual", "lead_replied", "invoice_unpaid", "meeting_booked", "meeting_booked_from_email", "questionnaire_sent", "quote_sent", "estimate_requested", "status_incident_created", "status_incident_updated", "status_incident_resolved"]),
  delay_minutes: z.number().int().min(1).max(525600).default(1440),
  interval_minutes: z.number().int().min(60).max(525600).default(2880),
  max_steps: z.number().int().min(1).max(10).default(3),
  stop_on_reply: z.boolean().default(true), require_approval: z.boolean().default(false),
  enabled: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.mode === "template" && !value.template_id) ctx.addIssue({ code: "custom", path: ["template_id"], message: "Choose a message template" })
  if (value.mode === "ai" && !value.instructions) ctx.addIssue({ code: "custom", path: ["instructions"], message: "Tell AI the purpose of this workflow" })
  if (value.trigger.startsWith("status_incident_") && (value.channel !== "email" || value.mode !== "template")) ctx.addIssue({ code: "custom", path: ["channel"], message: "System status notices use reviewed email templates" })
})
export type CommunicationTrigger = z.infer<typeof communicationWorkflowSchema>["trigger"]
export type CommunicationWorkflow = z.infer<typeof communicationWorkflowSchema> & { id: string; created_by: string; created_at: string }
export type CommunicationTemplate = z.infer<typeof communicationTemplateSchema> & { id: string }

export function normalizeCommunicationPhone(value: string): string {
  let digits = value.replace(/[\s().-]/g, "")
  if (/^0\d{10}$/.test(digits)) digits = `+234${digits.slice(1)}`
  else if (/^234\d{10}$/.test(digits)) digits = `+${digits}`
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : ""
}

export function smsLength(body: string) {
  const basic = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
  const extended = "^{}\\[~]|€\f"
  const unicode = [...body].some((char) => !basic.includes(char) && !extended.includes(char))
  const length = unicode ? body.length : [...body].reduce((count, char) => count + (extended.includes(char) ? 2 : 1), 0)
  const single = unicode ? 70 : 160
  return { characters: body.length, encoding: unicode ? "Unicode" : "GSM-7", segments: length <= single ? 1 : Math.ceil(length / (unicode ? 67 : 153)) }
}

export function mergeCommunicationTemplate(value: string, lead: { full_name: string; business_name: string; product_interest?: string }, event: { incidentTitle?: string; incidentStatus?: string; incidentUpdate?: string } = {}) {
  return value.replace(/\{\{(name|business|product|incidentTitle|incidentStatus|incidentUpdate)\}\}/g, (_match, key: string) => ({
    name: lead.full_name, business: lead.business_name, product: lead.product_interest || "MartPoint",
    incidentTitle: event.incidentTitle || "Service status update", incidentStatus: event.incidentStatus || "Updated",
    incidentUpdate: event.incidentUpdate || "Please check the MartPoint status page for details.",
  })[key as "name" | "business" | "product" | "incidentTitle" | "incidentStatus" | "incidentUpdate"])
}

export function communicationStopReason(input: { status: string; reminders_paused?: boolean; converted?: boolean; suppressed?: boolean; lastInbound?: string | null; lastOutbound?: string | null; enrolledAt?: string; stopOnReply?: boolean }) {
  if (["Won", "Lost"].includes(input.status) || input.converted) return "Lead is closed or already a customer"
  if (input.reminders_paused) return "Lead follow-ups are paused"
  if (input.suppressed) return "Recipient opted out of this channel"
  // A lead's original enquiry is not a reply to a follow-up that has not
  // been sent yet. Stop only when the most recent inbound is newer than an
  // outbound message in the conversation.
  if (input.stopOnReply && input.lastInbound && input.lastOutbound && Date.parse(input.lastInbound) > Date.parse(input.lastOutbound)) return "Lead has replied since the last message"
  return null
}
