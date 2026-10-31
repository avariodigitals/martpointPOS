import { communicationRequestId } from "@/lib/communication-idempotency"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin, hasPermission } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { getAiProviderStatus } from "@/lib/ai-chat"
import { getCommunicationSmsConfig, smsConfigurationSchema } from "@/lib/communication-sms"
import { getEmailSettings } from "@/lib/email"
import { prepareCommunication } from "@/lib/communications"
import { communicationChannel, communicationTemplateSchema, communicationWorkflowSchema, mergeCommunicationTemplate, normalizeCommunicationPhone } from "@/lib/communications-policy"

export const dynamic = "force-dynamic"
export const maxDuration = 60
type Context = { params: Promise<{ resource: string }> }
async function access(resource: string) {
  const auth = await authorizeAdmin(resource === "settings" ? "settings" : "marketing")
  if (auth.denied) return auth
  if (resource !== "settings" && !hasPermission(auth.session.role, "leads")) return { session: null, denied: NextResponse.json({ error: "Lead access is required" }, { status: 403 }) }
  return auth
}
function problem(error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Communications could not be loaded" }, { status: 400 }) }
const queueSchema = z.object({
  leadIds: z.array(z.uuid()).max(50).default([]), contactIds: z.array(z.uuid()).max(500).default([]), contactSource: z.enum(["lead", "saved_audience"]).default("lead"), audienceId: z.uuid().nullable().default(null), requestId: z.uuid(), channel: communicationChannel,
  mode: z.enum(["manual", "template", "ai"]), template_id: z.uuid().nullable().default(null),
  instructions: z.string().max(4000).default(""), subject: z.string().max(500).default(""), body: z.string().max(20000).default(""),
}).refine((value) => value.leadIds.length + value.contactIds.length > 0 && value.leadIds.length + value.contactIds.length <= 500, "Choose up to 500 recipients")
export async function GET(_request: Request, context: Context) {
  const { resource } = await context.params
  const auth = await access(resource)
  if (auth.denied) return auth.denied
  try {
    if (resource === "settings") {
      const sms = await getCommunicationSmsConfig()
      return NextResponse.json({ sms: { ...sms, apiKey: undefined, configured: Boolean(sms.apiKey && sms.sender && (sms.provider !== "africastalking" || sms.username)) } })
    }
    if (resource !== "workspace") return NextResponse.json({ error: "Unknown resource" }, { status: 404 })
    const results = await Promise.all([
      supabase.from("communication_templates").select("id,name,channel,subject,body").order("created_at"),
      supabase.from("communication_workflows").select("*").order("created_at", { ascending: false }),
      supabase.from("communication_messages").select("id,lead_id,channel,subject,body,status,mode,recipient,provider,provider_message_id,ai_provider,ai_model,error,scheduled_for,sent_at,created_at,workflow_id").order("created_at", { ascending: false }).limit(100),
      supabase.from("communication_runs").select("id,lead_id,workflow_id,status,step,next_run_at,reason").order("created_at", { ascending: false }).limit(100),
      supabase.from("leads").select("id,full_name,business_name,email,phone,status").order("submitted_at", { ascending: false }).limit(1000),
      supabase.from("marketing_audiences").select("id,name").order("created_at", { ascending: false }),
      supabase.from("status_subscribers").select("email").is("unsubscribed_at", null).order("created_at", { ascending: false }).limit(1000),
      supabase.from("communication_status_rules").select("workflow_id,incident_event,recipient_emails"),
      supabase.from("communication_call_tasks").select("id,lead_id,contact_name,phone,call_brief,status,created_at,completed_at").order("created_at", { ascending: false }).limit(100),
    ])
    if (results.some((result) => result.error)) return NextResponse.json({ error: "Communications needs database migrations 161 and 162, or a required dataset could not be loaded. No messages were sent." }, { status: 503 })
    const [sms, ai, email, smsContacts] = await Promise.all([
      getCommunicationSmsConfig(), getAiProviderStatus(), getEmailSettings(),
      supabase.from("marketing_contacts").select("id,audience_id,name,phone,sms_consent_at").not("phone", "is", null).not("sms_consent_at", "is", null).limit(2000),
    ])
    if (smsContacts.error) return NextResponse.json({ error: "Apply communications migration 162 to load consented SMS audiences" }, { status: 503 })
    return NextResponse.json({ templates: results[0].data, workflows: results[1].data, messages: results[2].data, runs: results[3].data, leads: results[4].data, audiences: results[5].data, statusSubscribers: results[6].data, statusRules: results[7].data, callTasks: results[8].data, smsContacts: smsContacts.data, providers: { email: email.provider, sms: sms.provider, smsConfigured: Boolean(sms.apiKey && sms.sender && (sms.provider !== "africastalking" || sms.username)), ai: ai.configured }, canConfigure: hasPermission(auth.session.role, "settings") })
  } catch (error) { return problem(error) }
}
export async function POST(request: Request, context: Context) {
  const { resource } = await context.params
  const auth = await access(resource)
  if (auth.denied) return auth.denied
  try {
    const body = await request.json()
    if (resource === "settings") {
      const parsed = smsConfigurationSchema.parse(body)
      const { data, error } = await supabase.from("settings").select("data").eq("id", 1).single()
      if (error || !data) throw new Error("Could not load provider settings")
      const existing = data.data || {}
      const previous = existing.communications?.sms || {}
      if (parsed.provider !== previous.provider && !parsed.apiKey && parsed.provider === "bulksmsnigeria" && !process.env.BULKSMSNIGERIA_API_TOKEN) throw new Error("Enter the BulkSMSNigeria API token when changing providers")
      const sms = { ...parsed, apiKey: parsed.apiKey || (parsed.provider === previous.provider ? previous.apiKey : "") || "" }
      const saved = await supabase.from("settings").update({ data: { ...existing, communications: { ...existing.communications, sms } } }).eq("id", 1)
      if (saved.error) throw new Error("Could not save SMS settings")
      const { revalidateTag } = await import("next/cache")
      revalidateTag("settings", { expire: 0 })
      return NextResponse.json({ success: true })
    }
    if (resource === "templates") {
      const parsed = communicationTemplateSchema.parse(body)
      const { data, error } = await supabase.from("communication_templates").insert({ ...parsed, created_by: auth.session.userId }).select("id").single()
      if (error) throw new Error("Could not save template")
      return NextResponse.json({ id: data.id })
    }
    if (resource === "workflows") {
      const parsed = communicationWorkflowSchema.parse(body)
      const statusRecipientEmails = parsed.trigger.startsWith("status_incident_") ? z.array(z.email()).min(1).max(1000).parse(body.status_recipient_emails || []) : []
      if (parsed.trigger.startsWith("status_incident_")) {
        const valid = await supabase.from("status_subscribers").select("email").in("email", statusRecipientEmails).is("unsubscribed_at", null)
        if (valid.error || valid.data?.length !== new Set(statusRecipientEmails.map((email) => email.toLowerCase())).size) throw new Error("Choose active status-alert subscribers only")
      }
      if (parsed.template_id) {
        const template = await supabase.from("communication_templates").select("id").eq("id", parsed.template_id).eq("channel", parsed.channel).maybeSingle()
        if (template.error || !template.data) throw new Error("Template must match the workflow channel")
      }
      const { data, error } = await supabase.from("communication_workflows").insert({ ...parsed, created_by: auth.session.userId }).select("id").single()
      if (error) throw new Error("Could not save workflow")
      if (parsed.trigger.startsWith("status_incident_")) {
        const rule = await supabase.from("communication_status_rules").insert({ workflow_id: data.id, incident_event: parsed.trigger, recipient_emails: [...new Set(statusRecipientEmails.map((email) => email.toLowerCase()))] })
        if (rule.error) throw new Error("Workflow saved but the status subscriber rule could not be saved")
      }
      return NextResponse.json({ id: data.id })
    }
    if (resource === "preview") {
      const parsed = z.object({ leadId: z.uuid(), channel: communicationChannel, mode: z.enum(["template", "ai"]), templateId: z.uuid().nullable().optional(), instructions: z.string().max(4000).optional() }).parse(body)
      return NextResponse.json(await prepareCommunication(parsed))
    }
    if (resource === "messages") {
      const parsed = queueSchema.parse(body)
      if (parsed.contactSource === "saved_audience" && (parsed.channel !== "sms" || parsed.leadIds.length || parsed.mode === "ai" || !parsed.audienceId)) throw new Error("Saved SMS audiences require a saved audience and template or written message")
      if (parsed.mode === "manual" && (!parsed.body.trim() || (parsed.channel === "email" && !parsed.subject.trim()) || (parsed.channel === "sms" && parsed.body.length > 480) || (parsed.channel === "whatsapp" && parsed.body.length > 2000))) throw new Error("Enter a subject and message within the channel length")
      if (parsed.mode === "ai" && !parsed.instructions.trim()) throw new Error("Describe the message you want AI to prepare")
      if (parsed.mode === "template") {
        const template = await supabase.from("communication_templates").select("id").eq("id", parsed.template_id || "").eq("channel", parsed.channel).maybeSingle()
        if (template.error || !template.data) throw new Error("Choose a template for this channel")
      }
      const requestId = parsed.requestId
      const leads = parsed.leadIds.length ? await supabase.from("leads").select("id,full_name,business_name,product_interest,status,email,phone").in("id", [...new Set(parsed.leadIds)]) : { data: [], error: null }
      if (leads.error || leads.data?.length !== new Set(parsed.leadIds).size) throw new Error("One or more selected leads could not be loaded")
      const leadRows = (leads.data || []).map((lead) => ({ request_id: communicationRequestId(requestId, lead.id), lead_id: lead.id, contact_source: "lead", contact_name: lead.full_name, channel: parsed.channel, mode: parsed.mode, template_id: parsed.template_id, instructions: parsed.instructions, subject: parsed.mode === "manual" ? mergeCommunicationTemplate(parsed.subject, lead) : "", body: parsed.mode === "manual" ? mergeCommunicationTemplate(parsed.body, lead) : "", prepared_at: parsed.mode === "manual" ? new Date().toISOString() : null, created_by: auth.session.userId }))
      let contactRows: Record<string, unknown>[] = []
      if (parsed.contactIds.length) {
        const contacts = await supabase.from("marketing_contacts").select("id,name,phone,sms_consent_at").eq("audience_id", parsed.audienceId).in("id", [...new Set(parsed.contactIds)]).not("phone", "is", null).not("sms_consent_at", "is", null)
        if (contacts.error || contacts.data?.length !== new Set(parsed.contactIds).size) throw new Error("Only phone contacts with recorded SMS consent can receive an SMS")
        const selectedTemplate = parsed.mode === "template" ? await supabase.from("communication_templates").select("subject,body").eq("id", parsed.template_id || "").eq("channel", "sms").maybeSingle() : { data: null, error: null }
        if (selectedTemplate.error || (parsed.mode === "template" && !selectedTemplate.data)) throw new Error("Choose an available SMS template")
        contactRows = contacts.data.map((contact) => {
          const person = { full_name: contact.name || "there", business_name: "", product_interest: "MartPoint" }
          return { request_id: communicationRequestId(requestId, contact.id), lead_id: null, contact_id: contact.id, contact_source: "saved_audience", contact_name: contact.name || "", recipient: contact.phone, channel: parsed.channel, mode: parsed.mode, template_id: parsed.template_id, instructions: parsed.instructions, subject: "", body: parsed.mode === "template" ? mergeCommunicationTemplate(selectedTemplate.data!.body, person) : mergeCommunicationTemplate(parsed.body, person), prepared_at: new Date().toISOString(), created_by: auth.session.userId }
        })
      }
      const rows = [...leadRows, ...contactRows]
      const { data, error } = await supabase.from("communication_messages").upsert(rows, { onConflict: "request_id", ignoreDuplicates: true }).select("id")
      if (error) throw new Error("Could not queue messages")
      return NextResponse.json({ queued: data?.length || 0 })
    }
    if (resource === "enroll") {
      const parsed = z.object({ workflowId: z.uuid(), leadIds: z.array(z.uuid()).min(1).max(50) }).parse(body)
      const workflow = await supabase.from("communication_workflows").select("id,enabled,delay_minutes").eq("id", parsed.workflowId).maybeSingle()
      if (workflow.error || !workflow.data?.enabled) throw new Error("Enable the workflow before enrolling leads")
      const { data, error } = await supabase.from("communication_runs").upsert([...new Set(parsed.leadIds)].map((lead_id) => ({ workflow_id: parsed.workflowId, lead_id, next_run_at: new Date(Date.now() + workflow.data!.delay_minutes * 60000).toISOString() })), { onConflict: "workflow_id,lead_id", ignoreDuplicates: true }).select("id")
      if (error) throw new Error("Could not enroll the selected leads")
      return NextResponse.json({ enrolled: data?.length || 0 })
    }
    if (resource === "suppressions") {
      const parsed = z.object({ channel: communicationChannel, address: z.string().trim().min(1).max(254) }).parse(body)
      const address = parsed.channel === "sms" ? normalizeCommunicationPhone(parsed.address) : parsed.address.toLowerCase()
      if (!address || (parsed.channel === "email" && !z.email().safeParse(address).success)) throw new Error("Enter a valid contact address")
      const result = await supabase.from("communication_suppressions").upsert({ ...parsed, address })
      if (result.error) throw new Error("Could not record the opt-out")
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 })
  } catch (error) { return problem(error) }
}
export async function PATCH(request: Request, context: Context) {
  const { resource } = await context.params
  const auth = await access(resource)
  if (auth.denied) return auth.denied
  try {
    const body = await request.json()
    const id = z.uuid().parse(body.id)
    if (resource === "templates") {
      const parsed = communicationTemplateSchema.parse(body)
      const referenced = await supabase.from("communication_workflows").select("channel").eq("template_id", id)
      if (referenced.error || referenced.data?.some((item) => item.channel !== parsed.channel)) throw new Error("A template used by a workflow must keep its channel")
      const result = await supabase.from("communication_templates").update(parsed).eq("id", id).select("id").maybeSingle()
      if (result.error || !result.data) throw new Error("Could not update template")
      return NextResponse.json({ success: true })
    }
    if (resource === "workflows") {
      const changes = typeof body.name === "string" ? communicationWorkflowSchema.parse(body) : { enabled: z.boolean().parse(body.enabled) }
      const statusRecipientEmails = "trigger" in changes && changes.trigger.startsWith("status_incident_") ? z.array(z.email()).min(1).max(1000).parse(body.status_recipient_emails || []) : []
      if ("trigger" in changes && changes.trigger.startsWith("status_incident_")) {
        const valid = await supabase.from("status_subscribers").select("email").in("email", statusRecipientEmails).is("unsubscribed_at", null)
        if (valid.error || valid.data?.length !== new Set(statusRecipientEmails.map((email) => email.toLowerCase())).size) throw new Error("Choose active status-alert subscribers only")
      }
      if ("template_id" in changes && changes.template_id) {
        const template = await supabase.from("communication_templates").select("id").eq("id", changes.template_id).eq("channel", changes.channel).maybeSingle()
        if (template.error || !template.data) throw new Error("Template must match the workflow channel")
      }
      const saved = await supabase.from("communication_workflows").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle()
      if (saved.error || !saved.data) throw new Error("Workflow could not be updated")
      if ("trigger" in changes) {
        if (changes.trigger.startsWith("status_incident_")) {
          const rule = await supabase.from("communication_status_rules").upsert({ workflow_id: id, incident_event: changes.trigger, recipient_emails: [...new Set(statusRecipientEmails.map((email) => email.toLowerCase()))] }, { onConflict: "workflow_id" })
          if (rule.error) throw new Error("Workflow updated but its status recipients could not be saved")
        } else {
          const rule = await supabase.from("communication_status_rules").delete().eq("workflow_id", id)
          if (rule.error) throw new Error("Workflow updated but its old status recipients could not be removed")
        }
      }
      if (!changes.enabled) {
        const released = await supabase.from("communication_messages").update({ status: "queued", claim_token: null, claim_expires_at: null }).eq("workflow_id", id).eq("status", "preparing")
        if (released.error) throw new Error("Workflow disabled but a preparation could not be released; review History")
      }
      return NextResponse.json({ success: true })
    }
    if (resource === "messages") {
      const action = z.enum(["approve", "cancel"]).parse(body.action)
      const result = await supabase.from("communication_messages").update(action === "approve"
        ? { status: "queued", approved_at: new Date().toISOString(), approved_by: auth.session.userId, error: null }
        : { status: "cancelled", error: "Cancelled by staff" })
        .eq("id", id).in("status", action === "approve" ? ["awaiting_approval"] : ["queued", "awaiting_approval"]).select("id").maybeSingle()
      if (result.error || !result.data) throw new Error("This message is already being processed or is no longer awaiting this action")
      return NextResponse.json({ success: true })
    }
    if (resource === "runs") {
      const result = await supabase.from("communication_runs").update({ status: "cancelled", reason: "Stopped by staff" }).eq("id", id).eq("status", "active").select("id").maybeSingle()
      if (result.error || !result.data) throw new Error("Enrollment could not be stopped")
      await supabase.from("communication_messages").update({ status: "cancelled", claim_token: null, claim_expires_at: null, error: "Enrollment stopped by staff" }).eq("run_id", id).in("status", ["queued", "awaiting_approval", "preparing"])
      return NextResponse.json({ success: true })
    }
    if (resource === "call-tasks") {
      const result = await supabase.from("communication_call_tasks").update({ status: "completed", completed_at: new Date().toISOString(), completed_by: auth.session.userId }).eq("id", id).eq("status", "open").select("id").maybeSingle()
      if (result.error || !result.data) throw new Error("Callback task is already completed or unavailable")
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 })
  } catch (error) { return problem(error) }
}
