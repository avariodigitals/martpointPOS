import { supabase, isSupabaseConfigured } from "./supabase"
import { isSensitiveSupportCategory } from "./support-permissions"
import { canPartnerAccessBusiness } from "./partner-auth"
import { resolveAdminTasks } from "./tasks"
import { notifyAllAdmins, notifyAdminUser } from "./admin-notifications"
import { enumLabel, supportCategoryLabel, ticketStatusLabel } from "./utils"
import { sendResolutionSatisfactionEmail, sendTicketRequesterEmail, recordTicketEmail, ticketSender, type TicketEmail } from "./support-ticket-email"
import { getSupportRequester, resolveChatTicketRequester, REQUESTER_FIELDS, type RequesterType } from "./support-requester"
import { sanitizeSupportHtml } from "./support-html"
import { htmlToText } from "./email-html"

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
  business_id?: string | null
  lead_id?: string | null
  creator_id?: string | null
  partner_id?: string | null
  requester_partner_id?: string | null
  complained_about_partner_id?: string | null
  requester_name?: string | null
  requester_email?: string | null
  requester_on_behalf_of?: string | null
  created_by_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "CREATOR" | "SYSTEM"
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
  author_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "CREATOR" | "SYSTEM"
  author_id?: string | null
  message: string
  message_html?: string | null
  author_name?: string | null
  signature_html?: string | null
  email_status?: string
  email_error?: string | null
  email_recipient?: string | null
  visibility: "PUBLIC" | "INTERNAL"
  attachment_path?: string | null
  created_at: string
}

type TicketEmailForNotification = TicketEmail

export type SupportEvent = {
  id: string
  ticket_id: string
  event_type: string
  actor_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "CREATOR" | "SYSTEM"
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
  actorType: "ADMIN" | "PARTNER" | "CUSTOMER" | "CREATOR" | "SYSTEM",
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
  if (ticket.requester_partner_id === partnerId) return true
  if (ticket.complained_about_partner_id && ticket.complained_about_partner_id === partnerId) return false
  if (ticket.assigned_partner_id !== partnerId) return false
  return true
}

export async function canPartnerViewTicket(partnerId: string, ticket: SupportTicket, partnerUserId?: string): Promise<boolean> {
  if (!isTicketVisibleToPartner(ticket, partnerId)) return false
  if (ticket.requester_partner_id === partnerId) return true
  if (!ticket.business_id) return false // creator tickets are not partner-visible
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
  if (ticket.requester_partner_id === partnerId) return true
  if (ticket.assigned_partner_id !== partnerId) return false
  return true
}

/* ─────────────────────────────────────────────────────────────────────────────
   TICKET LIFECYCLE
   ───────────────────────────────────────────────────────────────────────────── */

export async function createTicket(input: {
  business_id?: string | null
  lead_id?: string | null
  creator_id?: string | null
  partner_id?: string | null
  requester_partner_id?: string | null
  complained_about_partner_id?: string | null
  created_by_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "CREATOR" | "SYSTEM"
  created_by_id?: string | null
  source: string
  category: string
  priority: SupportPriority
  subject: string
  description?: string | null
  requester_name?: string | null
  requester_email?: string | null
  requester_on_behalf_of?: string | null
}) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const payload = { ...input }
  if (payload.business_id && payload.source === "OMNICHANNEL") {
    const account = await getSupportRequester("business",payload.business_id)
    if (account?.name.trim().toLowerCase() === "martpoint support") {
      const owner = await resolveChatTicketRequester({ name: payload.requester_name, email: payload.requester_email })
      payload.business_id = null
      payload[REQUESTER_FIELDS[owner.type]] = owner.id
    }
  }
  const owners = (Object.keys(REQUESTER_FIELDS) as RequesterType[]).filter((type) => Boolean(payload[REQUESTER_FIELDS[type]]))
  if (owners.length !== 1) throw new Error("Select the lead, partner, creator or business this ticket is for")
  const owner = await getSupportRequester(owners[0],payload[REQUESTER_FIELDS[owners[0]]] as string)
  if (!owner) throw new Error("The selected requester profile no longer exists")
  payload.requester_name ||= owner.contactName || owner.name
  payload.requester_email ||= owner.email || null

  const ticketNumber = await nextSupportTicketNumber()
  const firstResponseDue = await calculateSlaDue(input.priority, new Date().toISOString(), "first_response")
  const resolutionDue = await calculateSlaDue(input.priority, new Date().toISOString(), "resolution")

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      ...payload,
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

  await notifyAllAdmins({
    type: "SUPPORT_TICKET_CREATED",
    title: "New support ticket",
    message: `${ticketNumber}: ${input.subject}`,
    deep_link: `/admin/support/${data.id}`,
    source_type: "support_ticket",
    source_id: data.id as string,
    exclude_admin_user_id: input.created_by_type === "ADMIN" ? input.created_by_id || undefined : undefined,
    roles: ["Admin", "Customer Care", "Tech"],
    email: {
      route: "support_ticket",
      subject: `New Support Ticket — ${ticketNumber}`,
      text: `A new support ticket needs attention.\n\nTicket: ${ticketNumber}\nSubject: ${input.subject}\n\nOpen Support in the Admin Portal:\n/admin/support/${data.id}`,
    },
  })

  await sendSupportUpdate(data.id,"We have received your support request. Our team will review it and keep you informed of progress.",input.created_by_type === "ADMIN" ? input.created_by_id || undefined : undefined)

  return data as SupportTicket
}

export async function addMessage(
  ticketId: string,
  authorType: "ADMIN" | "PARTNER" | "CUSTOMER" | "CREATOR" | "SYSTEM",
  authorId: string | null | undefined,
  message: string,
  visibility: "PUBLIC" | "INTERNAL" = "PUBLIC",
  attachmentPath?: string | null,
  options: { html?: string | null; attachmentIds?: string[]; providerMessageId?: string | null } = {}
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  const { data: ticketRow, error: ticketError } = await supabase.from("support_tickets").select("*").eq("id",ticketId).single()
  if (ticketError || !ticketRow) throw new Error("Ticket not found")
  const staffReply = authorType === "ADMIN" || (authorType === "PARTNER" && !ticketRow.requester_partner_id)
  const rich = options.html ? sanitizeSupportHtml(options.html) : null
  const plain = rich ? htmlToText(rich) : message.trim()
  if (!plain && !options.attachmentIds?.length) throw new Error("Write a reply or attach a file")
  if (plain.length > 50000 || (rich?.length || 0) > 100000) throw new Error("This reply is too long")
  let senderName = ticketRow.requester_name || (authorType === "SYSTEM" ? "MartPoint Support" : "Requester")
  if (authorType === "ADMIN") senderName = (await ticketSender(authorId)).name
  if (authorType === "PARTNER" && authorId) {
    const { data: user } = await supabase.from("partner_users").select("full_name").eq("id",authorId).maybeSingle()
    senderName = user?.full_name || "Partner"
  }
  const attachments: { filename: string; content: string }[] = []
  if (options.attachmentIds?.length) {
    if (options.attachmentIds.length > 3) throw new Error("Attach up to three files per reply")
    const { data: files, error } = await supabase.from("support_attachments").select("id,storage_path,original_name,is_internal").eq("ticket_id",ticketId).in("id",options.attachmentIds)
    if (error || files?.length !== options.attachmentIds.length || (visibility === "PUBLIC" && files.some((f) => f.is_internal))) throw new Error("One or more attachments are unavailable for this reply")
    for (const file of files) {
      const { data: bytes, error: downloadError } = await supabase.storage.from("support-attachments").download(file.storage_path)
      if (downloadError || !bytes) throw new Error("Could not read a reply attachment")
      attachments.push({ filename: file.original_name, content: Buffer.from(await bytes.arrayBuffer()).toString("base64") })
    }
  }

  const { data, error } = await supabase
    .from("support_ticket_messages")
    .insert({
      ticket_id: ticketId,
      author_type: authorType,
      author_id: authorId,
      message: plain || "Attachment",
      message_html: rich,
      author_name: senderName,
      attachment_ids: options.attachmentIds || [],
      provider_message_id: options.providerMessageId || null,
      email_status: staffReply && visibility === "PUBLIC" ? "pending" : "not_required",
      visibility,
      attachment_path: attachmentPath || null,
      created_at: now(),
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Message creation failed: ${error?.message || "unknown"}`)
  await supabase.from("support_tickets").update({ updated_at: now() }).eq("id",ticketId)

  if (visibility === "INTERNAL") {
    await logSupportAudit(authorType, authorId, "SUPPORT_INTERNAL_NOTE_ADDED", ticketId)
  }

  if (visibility === "PUBLIC" && authorType !== "ADMIN") {
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("ticket_number, subject")
      .eq("id", ticketId)
      .maybeSingle()
    await notifyAllAdmins({
      type: "SUPPORT_TICKET_MESSAGE",
      title: "New support ticket reply",
      message: `${ticket?.ticket_number || "Support ticket"}: ${ticket?.subject || "New customer message"}`,
      deep_link: `/admin/support/${ticketId}`,
      source_type: "support_ticket",
      source_id: ticketId,
      roles: ["Admin", "Customer Care", "Tech"],
      email: {
        route: "support_ticket",
        subject: `New Support Ticket Reply — ${ticket?.ticket_number || "Ticket"}`,
        text: `A customer or partner replied to a support ticket.\n\nTicket: ${ticket?.ticket_number || ticketId}\nSubject: ${ticket?.subject || "New customer message"}\n\nOpen Support in the Admin Portal:\n/admin/support/${ticketId}`,
      },
    })
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

  // Keep the support team aware of internal notes and admin replies too. A
  // ticket update should not disappear simply because the original requester
  // was not the person who changed it.
  if (visibility === "INTERNAL" || authorType === "ADMIN") {
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("ticket_number, subject")
      .eq("id", ticketId)
      .maybeSingle()
    await notifyAllAdmins({
      type: visibility === "INTERNAL" ? "SUPPORT_INTERNAL_NOTE" : "SUPPORT_TICKET_ADMIN_REPLY",
      title: visibility === "INTERNAL" ? "New internal support note" : "Support ticket updated",
      message: `${ticket?.ticket_number || "Support ticket"}: ${ticket?.subject || "Ticket activity"}`,
      deep_link: `/admin/support/${ticketId}`,
      source_type: "support_ticket",
      source_id: ticketId,
      exclude_admin_user_id: authorType === "ADMIN" ? authorId || undefined : undefined,
      roles: ["Admin", "Customer Care", "Tech"],
    })
  }

  if (visibility === "PUBLIC" && staffReply) {
    const ticket = ticketRow as TicketEmail
    if (ticket) {
      try {
        const result = await sendTicketRequesterEmail({
          ticket,
          message: plain || "Please see the attached file.",
          messageHtml: rich,
          actorId: authorId,
          subjectPrefix: "New reply",
          messageId: data.id,
          attachments,
        })
        const delivery = { signature_html: result.signature, email_status: result.status, email_error: result.error, email_recipient: result.email || null, email_sent_at: result.sent ? now() : null }
        const { error: deliveryError } = await supabase.from("support_ticket_messages").update(delivery).eq("id",data.id)
        Object.assign(data,delivery)
        if (deliveryError) throw new Error("Could not save the email outcome")
        if (!result.sent && !result.skipped) console.error("[support-ticket-email] reply email was not delivered", ticket.ticket_number)
      } catch (error) {
        console.error("[support-ticket-email] reply email failed:", error)
        const failure = { email_status: "failed", email_error: "Email could not be sent. Retry this update." }
        await supabase.from("support_ticket_messages").update(failure).eq("id",data.id)
        Object.assign(data,failure)
      }
    }
  }

  if (visibility === "PUBLIC" && !staffReply && authorType !== "SYSTEM" && ["RESOLVED","WAITING_CUSTOMER","CLOSED"].includes(ticketRow.status)) {
    await changeStatus(ticketId,"IN_PROGRESS",authorType,authorId || undefined)
  }

  return data as SupportMessage
}

export async function addEvent(
  ticketId: string,
  eventType: string,
  actorType: "ADMIN" | "PARTNER" | "CUSTOMER" | "CREATOR" | "SYSTEM",
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

export async function sendSupportUpdate(ticketId: string, message: string, actorId?: string) {
  const { data: ticket } = await supabase.from("support_tickets").select("*").eq("id",ticketId).single()
  if (!ticket) throw new Error("Ticket not found")
  const result = await sendTicketRequesterEmail({ ticket,message,actorId })
  await recordTicketEmail(ticket,message,result,actorId)
  return result
}

/** Replace internal assignee UUIDs and enum values before ticket events reach a portal. */
export async function presentSupportTicketEvents<T extends Record<string, unknown>>(events: T[]): Promise<T[]> {
  if (!events.length) return []
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const userIds = new Set<string>()
  const partnerIds = new Set<string>()
  for (const event of events) {
    if (!["previous_value", "new_value"].some((key) => typeof event[key] === "string" && uuidPattern.test(event[key] as string))) continue
    if (event.event_type === "ASSIGNED" || event.event_type === "REASSIGNED") {
      for (const key of ["previous_value", "new_value"]) if (typeof event[key] === "string" && uuidPattern.test(event[key] as string)) userIds.add(event[key] as string)
    }
    if (event.event_type === "PARTNER_ASSIGNED" || event.event_type === "PARTNER_REMOVED") {
      for (const key of ["previous_value", "new_value"]) if (typeof event[key] === "string" && uuidPattern.test(event[key] as string)) partnerIds.add(event[key] as string)
    }
  }
  const actorIds=events.filter(event=>event.actor_type==="ADMIN"&&typeof event.actor_id==="string").map(event=>event.actor_id as string)
  for(const id of actorIds)userIds.add(id)
  const [usersResult, partnersResult] = await Promise.all([
    userIds.size ? supabase.from("users").select("id,name").in("id", [...userIds]) : Promise.resolve({ data: [] }),
    partnerIds.size ? supabase.from("partners").select("id,business_name,partner_id").in("id", [...partnerIds]) : Promise.resolve({ data: [] }),
  ])
  const userNames = new Map((usersResult.data || []).map((row) => [row.id as string, row.name as string]))
  const partnerNames = new Map((partnersResult.data || []).map((row) => [row.id as string, (row.business_name || row.partner_id || "Partner") as string]))

  return events.map((event) => {
    const output: Record<string, unknown> = { ...event }
    output.actor_name=event.actor_type==="ADMIN"?userNames.get(String(event.actor_id))||"Support team":event.actor_type==="SYSTEM"?"MartPoint Support":enumLabel(String(event.actor_type || "Requester"))
    const assignmentKind = event.event_type === "ASSIGNED" || event.event_type === "REASSIGNED" ? "user" : event.event_type === "PARTNER_ASSIGNED" || event.event_type === "PARTNER_REMOVED" ? "partner" : null
    for (const key of ["previous_value", "new_value"] as const) {
      const value = event[key]
      if (typeof value !== "string") continue
      if (uuidPattern.test(value)) {
        const label = assignmentKind === "user" ? userNames.get(value) || "Team member" : assignmentKind === "partner" ? partnerNames.get(value) || "Partner" : "Reference"
        output[key] = label
      } else if (event.event_type === "STATUS_CHANGED") output[key] = ticketStatusLabel(value)
      else if (event.event_type === "PRIORITY_CHANGED") output[key] = enumLabel(value)
      else if (event.event_type === "CATEGORY_CHANGED") output[key] = supportCategoryLabel(value)
      else if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(value)) output[key] = enumLabel(value)
    }
    return output as T
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
  const {data:partnerAgent,error:partnerAgentError}=await supabase.from("partner_users").select("id").eq("id",partnerUserId).eq("partner_id",partnerId).eq("status","ACTIVE").maybeSingle()
  if(partnerAgentError||!partnerAgent)throw new Error("Select an active teammate from this partner")
  const { data, error } = await supabase
    .from("support_tickets")
    .update({
      assigned_partner_id: partnerId,
      assigned_partner_user_id: partnerUserId,
      status: ["NEW","ASSIGNED"].includes(ticket.status) ? "ASSIGNED" : ticket.status,
      updated_at: now(),
    })
    .eq("id", ticketId)
    .select()
    .single()

  if (error || !data) throw new Error(`Assignment failed: ${error?.message || "unknown"}`)

  await resolveAdminTasks("SUPPORT_TICKET", ticketId, ["SUPPORT_UNASSIGNED"])
  await addEvent(ticketId, "PARTNER_ASSIGNED", actorType, actorId, { partner_id: partnerId }, prev || undefined, partnerId)
  await logSupportAudit(actorType, actorId, "SUPPORT_TICKET_PARTNER_ASSIGNED", ticketId)
  await sendSupportUpdate(ticketId,"Your support request has been assigned to our partner support team.",actorType === "ADMIN" ? actorId : undefined)
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
      status: ["NEW","ASSIGNED"].includes(ticket.status) ? "NEW" : ticket.status,
      updated_at: now(),
    })
    .eq("id", ticketId)
    .select()
    .single()

  if (error || !data) throw new Error(`Removal failed: ${error?.message || "unknown"}`)

  await addEvent(ticketId, "PARTNER_REMOVED", actorType, actorId, {}, prev || undefined, undefined)
  await sendSupportUpdate(ticketId,"Your support request has been returned to the MartPoint support team.",actorType === "ADMIN" ? actorId : undefined)
  return data as SupportTicket
}

export async function changeStatus(
  ticketId: string,
  newStatus: SupportTicketStatus,
  actorType: "ADMIN" | "PARTNER" | "CUSTOMER" | "CREATOR" | "SYSTEM",
  actorId: string | undefined,
  options: { skipEmail?: boolean; allowUnconfirmedClose?: boolean; expectedUpdatedAt?: string } = {}
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data: ticket } = await supabase.from("support_tickets").select("*").eq("id", ticketId).single()
  if (!ticket) throw new Error("Ticket not found")
  const t = ticket as SupportTicket
  if (t.status === newStatus) return t
  if (options.expectedUpdatedAt && t.updated_at !== options.expectedUpdatedAt) throw new Error("This ticket has new activity; automatic closure was cancelled")
  if (newStatus === "CLOSED" && ticket.satisfaction_response !== "satisfied" && !options.allowUnconfirmedClose) throw new Error("Resolve the ticket and request customer confirmation before closing it")

  const updates: Record<string, unknown> = { status: newStatus, updated_at: now() }
  if (newStatus === "RESOLVED") {
    updates.resolved_at = now()
    updates.auto_close_at = null
    updates.final_closure_notice_sent_at = null
    updates.resolution_actor_id = actorType === "ADMIN" ? actorId || null : ticket.assigned_admin_user_id || null
    updates.satisfaction_token_hash = null
    updates.satisfaction_sent_at = null
    updates.satisfaction_reminder_sent_at = null
    updates.satisfaction_response = null
    updates.satisfaction_responded_at = null
  }
  if (newStatus === "CLOSED") { updates.closed_at = now(); updates.auto_close_at = null }
  if (!["RESOLVED","CLOSED","CANCELLED"].includes(newStatus)) {
    updates.closed_at = null; updates.resolved_at = null; updates.auto_close_at = null
    updates.satisfaction_token_hash = null; updates.followup_claim = null; updates.followup_claim_expires_at = null
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .update(updates)
    .eq("id", ticketId)
    .eq("updated_at",t.updated_at)
    .select()
    .single()

  if (error || !data) throw new Error(`Status change failed: ${error?.message || "unknown"}`)

  if(t.status==="RESOLVED"||newStatus==="RESOLVED")await supabase.from("support_ticket_feedback_tokens").update({used_at:now()}).eq("ticket_id",ticketId).is("used_at",null)

  await addEvent(ticketId, "STATUS_CHANGED", actorType, actorId, {}, t.status, newStatus)

  if (newStatus === "RESOLVED") {
    await resolveAdminTasks("SUPPORT_TICKET", ticketId, ["SLA_BREACH"])
    await logSupportAudit(actorType, actorId, "SUPPORT_TICKET_RESOLVED", ticketId)
  }
  if (newStatus === "CLOSED") await logSupportAudit(actorType, actorId, "SUPPORT_TICKET_CLOSED", ticketId)

  await notifyAllAdmins({
    type: "SUPPORT_TICKET_STATUS_CHANGED",
    title: "Support ticket status changed",
    message: `${t.ticket_number}: ${ticketStatusLabel(t.status)} → ${ticketStatusLabel(newStatus)}`,
    deep_link: `/admin/support/${ticketId}`,
    source_type: "support_ticket",
    source_id: ticketId,
    exclude_admin_user_id: actorType === "ADMIN" ? actorId : undefined,
    roles: ["Admin", "Customer Care", "Tech"],
  })

  if (options.skipEmail) return data as SupportTicket
  if (newStatus === "RESOLVED") {
    const satisfaction = await sendResolutionSatisfactionEmail(data as TicketEmailForNotification,actorType === "ADMIN" ? actorId : undefined)
    if (!satisfaction.sent && !satisfaction.skipped) console.error("[support-ticket-email] resolution survey email was not delivered", t.ticket_number)
  } else {
    const requesterTicket = data as TicketEmailForNotification
    try {
      const statusMessage = `The status of your support request has changed to ${ticketStatusLabel(newStatus, true)}.`
      const result = await sendTicketRequesterEmail({
        ticket: requesterTicket,
        message: statusMessage,
        actorId: actorType === "ADMIN" ? actorId : undefined,
        subjectPrefix: "Ticket status update",
      })
      await recordTicketEmail(requesterTicket,statusMessage,result,actorType === "ADMIN" ? actorId : undefined)
      if (!result.sent && !result.skipped) console.error("[support-ticket-email] status email was not delivered", t.ticket_number)
    } catch (error) {
      console.error("[support-ticket-email] status email failed:", error)
    }
  }

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
  await sendSupportUpdate(ticketId,`The priority of your support request is now ${enumLabel(newPriority)}.`,actorType === "ADMIN" ? actorId : undefined)
  await notifyAllAdmins({
    type: "SUPPORT_TICKET_PRIORITY_CHANGED",
    title: "Support ticket priority changed",
    message: `${t.ticket_number}: ${t.priority} → ${newPriority}`,
    deep_link: `/admin/support/${ticketId}`,
    source_type: "support_ticket",
    source_id: ticketId,
    exclude_admin_user_id: actorType === "ADMIN" ? actorId : undefined,
    roles: ["Admin", "Customer Care", "Tech"],
  })
  return data as SupportTicket
}

export async function escalateTicket(
  ticketId: string,
  reason: string,
  actorType: "ADMIN" | "PARTNER",
  actorId: string
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  await changeStatus(ticketId,"ESCALATED",actorType,actorId,{skipEmail:true})

  const { data, error } = await supabase
    .from("support_tickets")
    .update({
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
  await sendSupportUpdate(ticketId,"Your support request has been escalated to our senior support team.",actorType === "ADMIN" ? actorId : undefined)
  await notifyAllAdmins({
    type: "SUPPORT_TICKET_ESCALATED",
    title: "Support ticket escalated",
    message: `${(data as SupportTicket).ticket_number}: ${reason || "Needs higher-level attention"}`,
    deep_link: `/admin/support/${ticketId}`,
    source_type: "support_ticket",
    source_id: ticketId,
    exclude_admin_user_id: actorType === "ADMIN" ? actorId : undefined,
    roles: ["Admin", "Customer Care", "Tech"],
  })
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
  const {data:agent,error:agentError}=await supabase.from("users").select("id").eq("id",adminUserId).eq("status","ACTIVE").in("role",["Admin","Customer Care","Tech"]).maybeSingle()
  if(agentError||!agent)throw new Error("Select an active support teammate")

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
  await sendSupportUpdate(ticketId,"A member of our support team has been assigned to your request.",actorType === "ADMIN" ? actorId : undefined)
  await notifyAdminUser({
    admin_user_id: adminUserId,
    type: "SUPPORT_TICKET_ASSIGNED",
    title: "Support ticket assigned to you",
    message: `${t.ticket_number}: ${t.subject}`,
    deep_link: `/admin/support/${ticketId}`,
    source_type: "support_ticket",
    source_id: ticketId,
  })
  return data as SupportTicket
}
