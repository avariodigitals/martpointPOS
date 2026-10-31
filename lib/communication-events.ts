import { communicationRequestId } from "./communication-idempotency"
import { mergeCommunicationTemplate, normalizeCommunicationPhone, type CommunicationTrigger, type CommunicationWorkflow, type CommunicationTemplate } from "./communications-policy"
import { supabase } from "./supabase"

export async function enqueueCommunicationTrigger(trigger: Exclude<CommunicationTrigger, "manual" | "new_lead" | "no_reply" | "status_incident_created" | "status_incident_updated" | "status_incident_resolved">, leadId: string) {
  const { data: workflows, error } = await supabase.from("communication_workflows").select("id,delay_minutes").eq("trigger", trigger).eq("enabled", true)
  if (error) throw new Error("Could not load communication workflows")
  const now = Date.now()
  for (const workflow of workflows || []) {
    const { error: insertError } = await supabase.from("communication_runs").upsert({
      workflow_id: workflow.id, lead_id: leadId,
      next_run_at: new Date(now + Number(workflow.delay_minutes) * 60000).toISOString(),
      status: "active", step: 1,
    }, { onConflict: "workflow_id,lead_id", ignoreDuplicates: true })
    if (insertError) throw new Error("Could not enqueue communication workflow")
  }
  return workflows?.length || 0
}

export async function resolveLeadIdByPhone(value: string) {
  const normalized = normalizeCommunicationPhone(value)
  if (!normalized) return null
  const variants = [...new Set([normalized, normalized.replace(/^\+/, ""), normalized.startsWith("+234") ? `0${normalized.slice(4)}` : normalized])]
  const { data, error } = await supabase.from("leads").select("id").in("phone", variants).limit(3)
  if (error) throw new Error("Could not match the inbound phone to a lead")
  const ids = [...new Set((data || []).map((row) => row.id))]
  return ids.length === 1 ? ids[0] : null
}

export type StatusCommunicationEvent = "status_incident_created" | "status_incident_updated" | "status_incident_resolved"
export async function hasStatusCommunicationRule(trigger: StatusCommunicationEvent) {
  const { data: rules, error } = await supabase.from("communication_status_rules").select("workflow_id").eq("incident_event", trigger)
  if (error || !rules?.length) return false
  const { data } = await supabase.from("communication_workflows").select("id").in("id", rules.map((rule) => rule.workflow_id)).eq("enabled", true)
  return Boolean(data?.length)
}

export async function enqueueStatusCommunication(trigger: StatusCommunicationEvent, event: { id: string; title: string; status: string; updateId: string; update: string }) {
  const { data: rules, error } = await supabase.from("communication_status_rules").select("workflow_id,recipient_emails").eq("incident_event", trigger)
  if (error) throw new Error("Could not load status communication rules")
  if (!rules?.length) return 0
  const recipients = (rule: { recipient_emails: unknown }) => Array.isArray(rule.recipient_emails)
    ? rule.recipient_emails.filter((email): email is string => typeof email === "string").map((email) => email.trim().toLowerCase()).filter(Boolean)
    : []
  const emails = [...new Set(rules.flatMap((rule) => recipients(rule)))]
  if (!emails.length) return 0
  const [subscribers, workflows] = await Promise.all([
    supabase.from("status_subscribers").select("email,token").in("email", emails).is("unsubscribed_at", null),
    supabase.from("communication_workflows").select("id,name,channel,mode,template_id,created_by,enabled,trigger,require_approval").in("id", rules.map((rule) => rule.workflow_id)).eq("enabled", true),
  ])
  if (subscribers.error || workflows.error) throw new Error("Could not verify status subscribers and workflows")
  const allowed = new Map((subscribers.data || []).map((row) => [row.email.toLowerCase(), row.token]))
  const workflowById = new Map((workflows.data || []).map((row) => [row.id, row as unknown as CommunicationWorkflow]))
  let queued = 0
  for (const rule of rules) {
    const workflow = workflowById.get(rule.workflow_id)
    if (!workflow || workflow.channel !== "email" || workflow.trigger !== trigger || !workflow.template_id) continue
    const { data: rawTemplate, error: templateError } = await supabase.from("communication_templates").select("id,name,channel,subject,body").eq("id", workflow.template_id).eq("channel", "email").maybeSingle()
    if (templateError || !rawTemplate) continue
    const template = rawTemplate as CommunicationTemplate
    for (const email of [...new Set(recipients(rule))]) {
      const token = allowed.get(email)
      if (!token) continue
      const lead = { full_name: "", business_name: "MartPoint status updates", product_interest: "MartPoint" }
      const body = mergeCommunicationTemplate(template.body, lead, { incidentTitle: event.title, incidentStatus: event.status, incidentUpdate: event.update })
      const subject = mergeCommunicationTemplate(template.subject, lead, { incidentTitle: event.title, incidentStatus: event.status, incidentUpdate: event.update })
      const requestId = communicationRequestId(`${trigger}:${event.id}:${event.updateId}`, email)
      const { error: insertError, data } = await supabase.from("communication_messages").upsert({
        request_id: requestId, lead_id: null, contact_name: "Status subscriber", contact_source: "status_subscriber",
        workflow_id: workflow.id, channel: "email", mode: "template", template_id: workflow.template_id,
        recipient: email, subject, body, prepared_at: new Date().toISOString(),
        created_by: workflow.created_by, status: workflow.require_approval ? "awaiting_approval" : "queued",
        error: workflow.require_approval ? "Status notice is ready for staff approval." : null,
      }, { onConflict: "request_id", ignoreDuplicates: true }).select("id").maybeSingle()
      if (insertError) throw new Error("Could not queue a system-status email")
      if (data) queued++
      // token is intentionally read here so a concurrent unsubscribe cannot
      // be hidden behind a stale recipient list; delivery resolves it again.
      void token
    }
  }
  return queued
}
