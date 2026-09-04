import { supabase, isSupabaseConfigured } from "./supabase"
import { isSensitiveSupportCategory } from "./support-permissions"
import { canPartnerAccessBusiness } from "./partner-auth"
import { logFinanceAudit } from "./finance-commercial"
import { resolveAdminTasks } from "./tasks"

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────────────────────────────────── */

export type SupportTicketStatus =
  | "NEW" | "ASSIGNED" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "WAITING_PARTNER"
  | "ESCALATED" | "RESOLVED" | "CLOSED" | "CANCELLED"

export type SupportPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT"

export type SupportTicket = {
  id: string
  ticket_number: string
  business_id: string
  partner_id?: string | null
  complained_about_partner_id?: string | null
  created_by_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM"
  created_by_id?: string | null
  source: string
  category: string
  priority: SupportPriority
  status: SupportTicketStatus
  subject: string
  description?: string | null
  assigned_admin_user_id?: string | null
  assigned_partner_id?: string | null
  assigned_partner_user_id?: string | null
  first_response_due_at?: string | null
  resolution_due_at?: string | null
  first_responded_at?: string | null
  resolved_at?: string | null
  closed_at?: string | null
  created_at: string
  updated_at: string
}

export type SupportMessage = {
  id: string
  ticket_id: string
  author_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM"
  author_id?: string | null
  message: string
  visibility: "PUBLIC" | "INTERNAL"
  attachment_path?: string | null
  created_at: string
}

export type SupportEvent = {
  id: string
  ticket_id: string
  event_type: string
  actor_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM"
  actor_id?: string | null
  previous_value?: string | null
  new_value?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

export type SlaPolicy = {
  id: string
  name: string
  priority: SupportPriority
  first_response_minutes: number
  resolution_minutes: number
  business_hours_only: boolean
  active: boolean
}

export type BusinessHours = {
  id: string
  timezone: string
  working_days: number[]
  opening_time: string
  closing_time: string
  active: boolean
}

/* ─────────────────────────────────────────────────────────────────────────────
   AUDIT EVENTS
   ───────────────────────────────────────────────────────────────────────────── */

export type SupportAuditAction =
  | "SUPPORT_TICKET_CREATED"
  | "SUPPORT_TICKET_ASSIGNED"
  | "SUPPORT_TICKET_PARTNER_ASSIGNED"
  | "SUPPORT_TICKET_ESCALATED"
  | "SUPPORT_TICKET_PRIORITY_CHANGED"
  | "SUPPORT_TICKET_RESOLVED"
  | "SUPPORT_TICKET_REOPENED"
  | "SUPPORT_TICKET_CLOSED"
  | "SUPPORT_INTERNAL_NOTE_ADDED"

export async function logSupportAudit(
  actorType: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM",
  actorId: string | null | undefined,
  action: SupportAuditAction,
  entityId: string,
  metadata?: Record<string, unknown>
) {
  if (!isSupabaseConfigured()) return
  await supabase.from("finance_audit_events").insert({
    actor_type: actorType,
    actor_id: actorId,
    action,
    entity_type: "SUPPORT_TICKET",
    entity_id: entityId,
    metadata,
    created_at: new Date().toISOString(),
  })
}

/* ─────────────────════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
   ─────────────────────────────────════════════════──────────────────────────── */

function now() {
  return new Date().toISOString()
}

export async function nextSupportTicketNumber(): Promise<string> {
  if (!isSupabaseConfigured()) return "MPS-00000-00000"
  const year = new Date().getFullYear()
  const { data, error } = await supabase.rpc("next_support_ticket_number", { p_year: year })
  if (error || !data) throw new Error(`Ticket number generation failed: ${error?.message || "unknown"}`)
  return data as string
}

export async function getSlaPolicy(priority: SupportPriority): Promise<SlaPolicy | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("support_sla_policies")
    .select("*")
    .eq("priority", priority)
    .eq("active", true)
    .single()
  if (error || !data) return null
  return data as SlaPolicy
}

export async function getBusinessHours(): Promise<BusinessHours | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("support_business_hours")
    .select("*")
    .eq("active", true)
    .single()
  if (error || !data) return null
  return data as BusinessHours
}

export function addBusinessMinutes(start: Date, minutes: number, hours: BusinessHours): Date {
  const tz = hours.timezone || "Africa/Lagos"
  let current = new Date(start.toLocaleString("en-US", { timeZone: tz }))
  let remaining = minutes

  while (remaining > 0) {
    const day = current.getDay()
    const isWorking = hours.working_days.includes(day === 0 ? 7 : day)
    if (!isWorking) {
      current.setDate(current.getDate() + 1)
      current.setHours(0, 0, 0, 0)
      continue
    }

    const open = new Date(current)
    open.setHours(Number(hours.opening_time.split(":")[0]), Number(hours.opening_time.split(":")[1]), 0, 0)
    const close = new Date(current)
    close.setHours(Number(hours.closing_time.split(":")[0]), Number(hours.closing_time.split(":")[1]), 0, 0)

    if (current < open) current = open
    if (current >= close) {
      current.setDate(current.getDate() + 1)
      current.setHours(0, 0, 0, 0)
      continue
    }

    const available = (close.getTime() - current.getTime()) / 60000
    const use = Math.min(remaining, available)
    current = new Date(current.getTime() + use * 60000)
    remaining -= use
  }

  return current
}

export async function calculateSlaDue(
  priority: SupportPriority,
  startAt: string,
  type: "first_response" | "resolution"
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const [policy, hours] = await Promise.all([getSlaPolicy(priority), getBusinessHours()])
  if (!policy) return null

  const start = new Date(startAt)
  const minutes = type === "first_response" ? policy.first_response_minutes : policy.resolution_minutes

  if (!hours || !hours.active || !policy.business_hours_only) {
    return new Date(start.getTime() + minutes * 60000).toISOString()
  }

  return addBusinessMinutes(start, minutes, hours).toISOString()
}

export async function getSlaState(
  dueAt: string | null
): Promise<"ON_TRACK" | "DUE_SOON" | "BREACHED" | null> {
  if (!dueAt) return null
  const due = new Date(dueAt).getTime()
  const nowTime = Date.now()
  if (nowTime > due) return "BREACHED"
  if (due - nowTime < 60 * 60 * 1000) return "DUE_SOON"
  return "ON_TRACK"
}

/* ─────────────────────────────────────────────────────────────────────────────
   PARTNER ACCESS CONTROL
   ───────────────────────────────────────────────────────────────────────────── */

export function isTicketVisibleToPartner(ticket: SupportTicket, partnerId: string): boolean {
  if (isSensitiveSupportCategory(ticket.category)) return false
  if (ticket.complained_about_partner_id && ticket.complained_about_partner_id === partnerId) return false
  if (ticket.assigned_partner_id !== partnerId) return false
  return true
}

export async function canPartnerViewTicket(partnerId: string, ticket: SupportTicket, partnerUserId?: string): Promise<boolean> {
  if (!isTicketVisibleToPartner(ticket, partnerId)) return false
  const access = await canPartnerAccessBusiness(partnerId, ticket.business_id, {
    partnerUserId,
    userPermission: "support:view_assigned",
    orgCapability: "FIRST_LINE_SUPPORT",
    requiredAccessLevel: "SUPPORT",
  })
  return access.allowed
}

export async function canPartnerManageTicket(partnerId: string, ticket: SupportTicket, partnerUserId?: string): Promise<boolean> {
  if (!await canPartnerViewTicket(partnerId, ticket, partnerUserId)) return false
  if (ticket.assigned_partner_id !== partnerId) return false
  return true
}

/* ─────────────────────────────────────────────────────────────────────────────
   TICKET LIFECYCLE
   ───────────────────────────────────────────────────────────────────────────── */

export async function createTicket(input: {
  business_id: string
  partner_id?: string | null
  complained_about_partner_id?: string | null
  created_by_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM"
  created_by_id?: string | null
  source: string
  category: string
  priority: SupportPriority
  subject: string
  description?: string | null
}) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const ticketNumber = await nextSupportTicketNumber()
  const firstResponseDue = await calculateSlaDue(input.priority, new Date().toISOString(), "first_response")
  const resolutionDue = await calculateSlaDue(input.priority, new Date().toISOString(), "resolution")

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      ...input,
      ticket_number: ticketNumber,
      status: "NEW",
      first_response_due_at: firstResponseDue,
      resolution_due_at: resolutionDue,
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Ticket creation failed: ${error?.message || "unknown"}`)

  await addEvent(data.id, "CREATED", input.created_by_type, input.created_by_id, { ticket_number: ticketNumber })
  await logSupportAudit(input.created_by_type, input.created_by_id, "SUPPORT_TICKET_CREATED", data.id)

  return data as SupportTicket
}

export async function addMessage(
  ticketId: string,
  authorType: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM",
  authorId: string | null | undefined,
  message: string,
  visibility: "PUBLIC" | "INTERNAL" = "PUBLIC",
  attachmentPath?: string | null
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data, error } = await supabase
    .from("support_ticket_messages")
    .insert({
      ticket_id: ticketId,
      author_type: authorType,
      author_id: authorId,
      message,
      visibility,
      attachment_path: attachmentPath || null,
      created_at: now(),
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Message creation failed: ${error?.message || "unknown"}`)

  if (visibility === "INTERNAL") {
    await logSupportAudit(authorType, authorId, "SUPPORT_INTERNAL_NOTE_ADDED", ticketId)
  }

  // First qualifying customer-facing public response (admin or partner only)
  if (visibility === "PUBLIC" && (authorType === "ADMIN" || authorType === "PARTNER")) {
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("first_responded_at")
      .eq("id", ticketId)
      .single()
    if (ticket && !(ticket as { first_responded_at: string | null }).first_responded_at) {
      await supabase
        .from("support_tickets")
        .update({ first_responded_at: (data as SupportMessage).created_at, updated_at: now() })
        .eq("id", ticketId)
    }
  }

  return data as SupportMessage
}

export async function addEvent(
  ticketId: string,
  eventType: string,
  actorType: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM",
  actorId: string | null | undefined,
  metadata?: Record<string, unknown>,
  previousValue?: string,
  newValue?: string
) {
  if (!isSupabaseConfigured()) return
  await supabase.from("support_ticket_events").insert({
    ticket_id: ticketId,
    event_type: eventType,
    actor_type: actorType,
    actor_id: actorId,
    previous_value: previousValue,
    new_value: newValue,
    metadata,
    created_at: now(),
  })
}

export async function assignPartner(
  ticketId: string,
  partnerId: string,
  partnerUserId: string,
  actorType: "ADMIN" | "PARTNER",
  actorId: string
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data: ticket } = await supabase.from("support_tickets").select("*").eq("id", ticketId).single()
  if (!ticket) throw new Error("Ticket not found")
  if (isSensitiveSupportCategory((ticket as SupportTicket).category)) throw new Error("Cannot assign partner to sensitive ticket")
  if ((ticket as SupportTicket).complained_about_partner_id === partnerId) throw new Error("Cannot assign the complained-about partner to the complaint")

  const prev = (ticket as SupportTicket).assigned_partner_id
  const { data, error } = await supabase
    .from("support_tickets")
    .update({
      assigned_partner_id: partnerId,
      assigned_partner_user_id: partnerUserId,
      status: "ASSIGNED",
      updated_at: now(),
    })
    .eq("id", ticketId)
    .select()
    .single()

  if (error || !data) throw new Error(`Assignment failed: ${error?.message || "unknown"}`)

  await resolveAdminTasks("SUPPORT_TICKET", ticketId, ["SUPPORT_UNASSIGNED"])
  await addEvent(ticketId, "PARTNER_ASSIGNED", actorType, actorId, { partner_id: partnerId }, prev || undefined, partnerId)
  await logSupportAudit(actorType, actorId, "SUPPORT_TICKET_PARTNER_ASSIGNED", ticketId)
  return data as SupportTicket
}

export async function removePartner(
  ticketId: string,
  actorType: "ADMIN" | "PARTNER",
  actorId: string
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data: ticket } = await supabase.from("support_tickets").select("*").eq("id", ticketId).single()
  if (!ticket) throw new Error("Ticket not found")

  const prev = (ticket as SupportTicket).assigned_partner_id
  const { data, error } = await supabase
    .from("support_tickets")
    .update({
      assigned_partner_id: null,
      assigned_partner_user_id: null,
      status: "NEW",
      updated_at: now(),
    })
    .eq("id", ticketId)
    .select()
    .single()

  if (error || !data) throw new Error(`Removal failed: ${error?.message || "unknown"}`)

  await addEvent(ticketId, "PARTNER_REMOVED", actorType, actorId, {}, prev || undefined, undefined)
  return data as SupportTicket
}

export async function changeStatus(
  ticketId: string,
  newStatus: SupportTicketStatus,
  actorType: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM",
  actorId: string | undefined
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data: ticket } = await supabase.from("support_tickets").select("*").eq("id", ticketId).single()
  if (!ticket) throw new Error("Ticket not found")
  const t = ticket as SupportTicket

  const updates: Record<string, unknown> = { status: newStatus, updated_at: now() }
  if (newStatus === "RESOLVED") updates.resolved_at = now()
  if (newStatus === "CLOSED") updates.closed_at = now()

  const { data, error } = await supabase
    .from("support_tickets")
    .update(updates)
    .eq("id", ticketId)
    .select()
    .single()

  if (error || !data) throw new Error(`Status change failed: ${error?.message || "unknown"}`)

  await addEvent(ticketId, "STATUS_CHANGED", actorType, actorId, {}, t.status, newStatus)

  if (newStatus === "RESOLVED") {
    await resolveAdminTasks("SUPPORT_TICKET", ticketId, ["SLA_BREACH"])
    await logSupportAudit(actorType, actorId, "SUPPORT_TICKET_RESOLVED", ticketId)
  }
  if (newStatus === "CLOSED") await logSupportAudit(actorType, actorId, "SUPPORT_TICKET_CLOSED", ticketId)

  return data as SupportTicket
}

export async function changePriority(
  ticketId: string,
  newPriority: SupportPriority,
  actorType: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM",
  actorId: string | undefined
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data: ticket } = await supabase.from("support_tickets").select("*").eq("id", ticketId).single()
  if (!ticket) throw new Error("Ticket not found")
  const t = ticket as SupportTicket

  const firstResponseDue = await calculateSlaDue(newPriority, t.created_at, "first_response")
  const resolutionDue = await calculateSlaDue(newPriority, t.created_at, "resolution")

  const { data, error } = await supabase
    .from("support_tickets")
    .update({
      priority: newPriority,
      first_response_due_at: firstResponseDue,
      resolution_due_at: resolutionDue,
      updated_at: now(),
    })
    .eq("id", ticketId)
    .select()
    .single()

  if (error || !data) throw new Error(`Priority change failed: ${error?.message || "unknown"}`)

  await addEvent(ticketId, "PRIORITY_CHANGED", actorType, actorId, {}, t.priority, newPriority)
  await logSupportAudit(actorType, actorId, "SUPPORT_TICKET_PRIORITY_CHANGED", ticketId)
  return data as SupportTicket
}

export async function escalateTicket(
  ticketId: string,
  reason: string,
  actorType: "ADMIN" | "PARTNER",
  actorId: string
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data, error } = await supabase
    .from("support_tickets")
    .update({
      status: "ESCALATED",
      assigned_partner_id: null,
      assigned_partner_user_id: null,
      updated_at: now(),
    })
    .eq("id", ticketId)
    .select()
    .single()

  if (error || !data) throw new Error(`Escalation failed: ${error?.message || "unknown"}`)

  await addEvent(ticketId, "ESCALATED", actorType, actorId, { reason })
  await logSupportAudit(actorType, actorId, "SUPPORT_TICKET_ESCALATED", ticketId)
  return data as SupportTicket
}

export async function assignAdmin(
  ticketId: string,
  adminUserId: string,
  actorType: "ADMIN" | "PARTNER",
  actorId: string
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data: ticket } = await supabase.from("support_tickets").select("*").eq("id", ticketId).single()
  if (!ticket) throw new Error("Ticket not found")
  const t = ticket as SupportTicket

  const { data, error } = await supabase
    .from("support_tickets")
    .update({
      assigned_admin_user_id: adminUserId,
      status: t.status === "NEW" ? "ASSIGNED" : t.status,
      updated_at: now(),
    })
    .eq("id", ticketId)
    .select()
    .single()

  if (error || !data) throw new Error(`Admin assignment failed: ${error?.message || "unknown"}`)

  await resolveAdminTasks("SUPPORT_TICKET", ticketId, ["SUPPORT_UNASSIGNED"])
  await addEvent(ticketId, "ASSIGNED", actorType, actorId, {}, t.assigned_admin_user_id || undefined, adminUserId)
  await logSupportAudit(actorType, actorId, "SUPPORT_TICKET_ASSIGNED", ticketId)
  return data as SupportTicket
}
