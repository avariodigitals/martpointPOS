import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { hasSupportAdminAction, isSensitiveSupportCategory } from "@/lib/support-permissions"
import type { SupportAdminAction } from "@/lib/support-permissions"
import { supabase } from "@/lib/supabase"
import { pushCreatorNotification } from "@/lib/creator-notifications"
import {
  createTicket,
  addMessage,
  assignAdmin,
  assignPartner,
  removePartner,
  changeStatus,
  changePriority,
  escalateTicket,
  getSlaState,
  presentSupportTicketEvents,
  addEvent,
  sendSupportUpdate,
  type SupportTicket,
  type SupportTicketStatus,
  type SupportPriority
} from "@/lib/support"
import {
  getSupportRequester,
  REQUESTER_FIELDS,
  requesterHref,
  type RequesterType
} from "@/lib/support-requester"
import {
  ticketSender,
  sendTicketRequesterEmail,
  sendResolutionSatisfactionEmail,
  sendSatisfactionReminder
} from "@/lib/support-ticket-email"
import { sanitizeSupportHtml } from "@/lib/support-html"
import { supportCategoryLabel } from "@/lib/utils"

type Action = string
type ProfileRow = {
  full_name?: string
  business_name?: string
  display_name?: string
  email?: string
  primary_email?: string
  public_email?: string
}
type TicketRow = SupportTicket & {
  business?: ProfileRow
  lead?: ProfileRow
  creator?: ProfileRow
  requester_partner?: ProfileRow
  admin?: { name: string }
  partner?: { display_name: string }
}
type ActionData = Record<string, string> & { attachmentIds?: string[] }

const ticketActionPerm: Record<string, SupportAdminAction> = {
  create: "support:create",
  update: "support:update",
  assign_admin: "support:assign",
  assign_partner: "support:assign",
  remove_partner: "support:assign",
  change_status: "support:update",
  change_priority: "support:update",
  escalate: "support:update",
  link_requester: "support:update"
}

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } })
}

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

async function getActor() {
  const session = await getSession()
  if (!session) return null
  return { id: session.userId, role: session.role, name: session.name }
}

function now() {
  return new Date().toISOString()
}

function validateStatus(value: string): value is SupportTicketStatus {
  return [
    "NEW",
    "ASSIGNED",
    "IN_PROGRESS",
    "WAITING_CUSTOMER",
    "WAITING_PARTNER",
    "ESCALATED",
    "RESOLVED",
    "CLOSED",
    "CANCELLED"
  ].includes(value)
}

function validatePriority(value: string): value is SupportPriority {
  return ["LOW", "NORMAL", "HIGH", "URGENT"].includes(value)
}

function validateCategory(value: string): boolean {
  const categories = [
    "SOFTWARE",
    "LOGIN_ACCOUNT",
    "POS",
    "INVENTORY",
    "PRODUCTS",
    "REPORTS",
    "ONLINE_STORE",
    "CONFIGURATION",
    "TRAINING",
    "BILLING",
    "LICENSING",
    "SECURITY",
    "PRIVACY_DATA",
    "HARDWARE_GUIDANCE",
    "FEATURE_REQUEST",
    "PARTNER_COMPLAINT",
    "PARTNER_NETWORK",
    "CREATOR_NETWORK",
    "OTHER"
  ]
  return categories.includes(value)
}

function validateSource(value: string): boolean {
  const sources = ["PORTAL", "PARTNER", "ADMIN", "EMAIL", "WHATSAPP", "PHONE", "SYSTEM", "OTHER", "DIRECT"]
  return sources.includes(value)
}

/* ─────────────────────────────────────────────────────────────────────────────
   GET — list / single by resource
   ───────────────────────────────────────────────────────────────────────────── */
export async function GET(request: Request, props: { params: Promise<{ resource: string }> }) {
  const actor = await getActor()
  if (!actor) return err("Unauthorized", 401)
  const { resource } = await props.params

  if (!hasSupportAdminAction(actor.role, "support:view")) {
    return err("Forbidden", 403)
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const ticketId = searchParams.get("ticketId")
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")
  const category = searchParams.get("category")
  const businessId = searchParams.get("businessId")
  const search = searchParams.get("search")

  try {
    if (resource === "sender") {
      const sender = await ticketSender(actor.id)
      return ok({
        name: sender.name,
        signatureHtml: sender.signature,
        canUpdate: hasSupportAdminAction(actor.role, "support:update"),
        canAssign: hasSupportAdminAction(actor.role, "support:assign"),
        canNotes: hasSupportAdminAction(actor.role, "support:internal_notes")
      })
    }
    if (resource === "assignees") {
      if (!hasSupportAdminAction(actor.role, "support:assign")) return err("Forbidden", 403)
      const partnerId = searchParams.get("partnerId")
      if (partnerId) {
        const { data, error } = await supabase
          .from("partner_users")
          .select("id,full_name")
          .eq("partner_id", partnerId)
          .eq("status", "ACTIVE")
        return error ? err("Could not load partner agents", 500) : ok({ partnerUsers: data || [] })
      }
      const [users, partners] = await Promise.all([
        supabase
          .from("users")
          .select("id,name")
          .eq("status", "ACTIVE")
          .in("role", ["Admin", "Customer Care", "Tech"]),
        supabase.from("partners").select("id,business_name,display_name").eq("status", "ACTIVE")
      ])
      if (users.error || partners.error) return err("Could not load support assignees", 500)
      return ok({ users: users.data || [], partners: partners.data || [] })
    }
    if (resource === "requesters") {
      const type = searchParams.get("type") as RequesterType
      if (!(type in REQUESTER_FIELDS)) return err("Select a requester type")
      if (id) return ok(await getSupportRequester(type, id))
      const tables = { lead: "leads", business: "businesses", creator: "creators", partner: "partners" }
      const cols = {
        lead: "id,full_name,email",
        business: "id,business_name,primary_email",
        creator: "id,full_name,email",
        partner: "id,business_name,display_name,public_email"
      }
      let query = supabase.from(tables[type]).select(cols[type]).limit(15)
      const term = (search || "").replace(/[,()\\%_]/g, " ").trim()
      if (term) {
        const name = type === "lead" || type === "creator" ? "full_name" : "business_name"
        const mail = type === "business" ? "primary_email" : type === "partner" ? "public_email" : "email"
        query = query.or(`${name}.ilike.%${term}%,${mail}.ilike.%${term}%`)
      }
      const { data, error } = await query
      if (error) return err("Could not search requester profiles", 500)
      return ok(
        (data || []).map((item) => {
          const row = item as unknown as Record<string, string>
          return {
            type,
            id: row.id,
            name: row.full_name || row.display_name || row.business_name,
            email: row.email || row.primary_email || row.public_email || "",
            href: requesterHref(type, row.id)
          }
        })
      )
    }
    if (resource === "tickets" || resource === "workspace") {
      if (resource === "workspace" && !id) return err("Missing ticket ID")
      let q = supabase
        .from("support_tickets")
        .select(
          "*, business:business_id (business_name, primary_contact_name, primary_email), lead:lead_id (full_name,email,business_name), creator:creator_id (full_name, creator_id, email), requester_partner:requester_partner_id (business_name,display_name,public_email), admin:assigned_admin_user_id (name), partner:assigned_partner_id (display_name)"
        )
        .order("updated_at", { ascending: false })

      if (id) q = q.eq("id", id)
      else {
        if (status) q = q.eq("status", status)
        if (priority) q = q.eq("priority", priority)
        if (category) q = q.eq("category", category)
        if (businessId) q = q.eq("business_id", businessId)
        const requesterType = searchParams.get("requesterType") as RequesterType
        const requesterId = searchParams.get("requesterId")
        if (requesterId && requesterType in REQUESTER_FIELDS)
          q = q.eq(REQUESTER_FIELDS[requesterType], requesterId)
      }

      const { data, error } = id ? await q.single() : await q
      if (error)
        return err(
          id && error.code === "PGRST116" ? "Ticket not found" : error.message,
          id && error.code === "PGRST116" ? 404 : 500
        )

      const tickets = (Array.isArray(data) ? data : data ? [data] : []) as unknown as TicketRow[]
      const canSeeSensitive = hasSupportAdminAction(actor.role, "support:sensitive")

      const visible = tickets.filter((t) => {
        if (!isSensitiveSupportCategory(t.category)) return true
        return canSeeSensitive
      })

      const enriched = await Promise.all(
        visible.map(async (t) => {
          const slaState = await getSlaState(t.resolution_due_at as string | null)
          const summary: Record<string, unknown> = { business: t.business, creator: t.creator }
          if (resource !== "workspace" && id && t.business_id) {
            const [{ data: ent }, { data: sub }] = await Promise.all([
              supabase
                .from("business_entitlements")
                .select("*")
                .eq("business_id", t.business_id)
                .maybeSingle(),
              supabase
                .from("subscriptions")
                .select("*, plans(*)")
                .eq("business_id", t.business_id)
                .order("current_period_end", { ascending: false })
                .maybeSingle()
            ])
            summary.entitlement = ent
            summary.subscription = sub
          }
          const ownerType: RequesterType = t.lead_id
            ? "lead"
            : t.creator_id
              ? "creator"
              : t.requester_partner_id
                ? "partner"
                : "business"
          const ownerRow = t.lead || t.creator || t.requester_partner || t.business
          const ownerId = t[REQUESTER_FIELDS[ownerType]] || ""
          const profile = {
            type: ownerType,
            id: ownerId,
            name: ownerRow?.full_name || ownerRow?.display_name || ownerRow?.business_name || "Requester",
            email:
              t.requester_email || ownerRow?.email || ownerRow?.primary_email || ownerRow?.public_email || "",
            href: requesterHref(ownerType, ownerId)
          }
          return { ...t, sla_state: slaState, business_summary: summary, requester_profile: profile }
        })
      )

      if (id) {
        const single = enriched[0]
        if (!single) return err("Not found", 404)
        if (isSensitiveSupportCategory(single.category) && !canSeeSensitive) {
          return err("Forbidden", 403)
        }
        if (resource === "workspace") {
          // Read ticket identity/access once, then fetch the thread in parallel.
          // No full inbox, sender settings or unused subscription queries here.
          const canInternal = hasSupportAdminAction(actor.role, "support:internal_notes")
          let messageQuery = supabase
            .from("support_ticket_messages")
            .select("*")
            .eq("ticket_id", id)
            .order("created_at", { ascending: false })
          if (!canInternal) messageQuery = messageQuery.eq("visibility", "PUBLIC")
          const [messages, events, attachments] = await Promise.all([
            messageQuery,
            supabase
              .from("support_ticket_events")
              .select(
                "id,ticket_id,event_type,actor_type,actor_id,previous_value,new_value,metadata,created_at"
              )
              .eq("ticket_id", id)
              .order("created_at", { ascending: false }),
            supabase
              .from("support_attachments")
              .select("id,storage_path,original_name,is_internal")
              .eq("ticket_id", id)
          ])
          if (messages.error || events.error || attachments.error)
            return err("Could not load ticket conversation", 500)
          return ok({
            ticket: single,
            messages: (messages.data || []).map((message) => ({
              ...message,
              attachments: (attachments.data || []).filter(
                (file) =>
                  (canInternal || !file.is_internal) &&
                  (message.attachment_ids?.includes(file.id) || message.attachment_path === file.storage_path)
              )
            })),
            events: await presentSupportTicketEvents(events.data || [])
          })
        }
        return ok(single)
      }

      if (search) {
        const s = search.toLowerCase()
        return ok(
          enriched.filter(
            (t) =>
              t.ticket_number?.toLowerCase().includes(s) ||
              t.subject?.toLowerCase().includes(s) ||
              t.business?.business_name?.toLowerCase().includes(s) ||
              t.creator?.full_name?.toLowerCase().includes(s) ||
              t.requester_profile?.name?.toLowerCase().includes(s) ||
              t.requester_email?.toLowerCase().includes(s)
          )
        )
      }

      return ok(enriched)
    }

    if (resource === "messages" || resource === "events") {
      if (!ticketId) return err("Missing ticketId")
      const { data: protectedTicket } = await supabase
        .from("support_tickets")
        .select("category")
        .eq("id", ticketId)
        .maybeSingle()
      if (!protectedTicket) return err("Ticket not found", 404)
      if (
        isSensitiveSupportCategory(protectedTicket.category) &&
        !hasSupportAdminAction(actor.role, "support:sensitive")
      )
        return err("Forbidden", 403)
    }
    if (resource === "messages") {
      if (!ticketId) return err("Missing ticketId")
      const canInternal = hasSupportAdminAction(actor.role, "support:internal_notes")
      let q = supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true })

      if (!canInternal) q = q.eq("visibility", "PUBLIC")

      const { data, error } = await q
      if (error) return err(error.message, 500)
      const { data: attachments } = await supabase
        .from("support_attachments")
        .select("id,storage_path,original_name,is_internal")
        .eq("ticket_id", ticketId)
      return ok(
        (data || []).map((message) => ({
          ...message,
          attachments: (attachments || []).filter(
            (file) =>
              (canInternal || !file.is_internal) &&
              (message.attachment_ids?.includes(file.id) || message.attachment_path === file.storage_path)
          )
        }))
      )
    }

    if (resource === "events") {
      if (!ticketId) return err("Missing ticketId")
      const { data, error } = await supabase
        .from("support_ticket_events")
        .select(
          "id, ticket_id, event_type, actor_type, actor_id, previous_value, new_value, metadata, created_at"
        )
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false })
      if (error) return err(error.message, 500)
      return ok(await presentSupportTicketEvents(data || []))
    }

    if (resource === "sla") {
      const { data, error } = await supabase.from("support_sla_policies").select("*").order("priority")
      if (error) return err(error.message, 500)
      return ok(data)
    }

    if (resource === "business_hours") {
      const { data, error } = await supabase.from("support_business_hours").select("*")
      if (error) return err(error.message, 500)
      return ok(data)
    }

    return err("Unknown resource", 404)
  } catch (e) {
    return err(String(e), 500)
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   POST — create / action
   ───────────────────────────────────────────────────────────────────────────── */
export async function POST(request: Request, props: { params: Promise<{ resource: string }> }) {
  const actor = await getActor()
  if (!actor) return err("Unauthorized", 401)
  const { resource } = await props.params

  try {
    const body = await request.json()
    const { action, data } = body as { action: Action; data: ActionData }
    if (!action) return err("Missing action")

    if (resource === "tickets") {
      const perm = ticketActionPerm[action]
      if (!perm || !hasSupportAdminAction(actor.role, perm)) {
        return err("Forbidden", 403)
      }
      if (action !== "create" && data.id) {
        const { data: existing, error: lookupError } = await supabase
          .from("support_tickets")
          .select("category")
          .eq("id", data.id)
          .maybeSingle()
        if (lookupError) return err("Could not load the ticket", 500)
        if (!existing) return err("Ticket not found", 404)
        if (
          isSensitiveSupportCategory(existing.category) &&
          !hasSupportAdminAction(actor.role, "support:sensitive")
        )
          return err("Forbidden", 403)
      }

      if (action === "create") {
        if (!data.business_id && !data.lead_id && !data.creator_id && !data.requester_partner_id)
          return err("Select the requester profile")
        if (!data.category || !validateCategory(data.category)) return err("Invalid category")
        if (!data.priority || !validatePriority(data.priority)) return err("Invalid priority")
        if (!data.subject) return err("Missing subject")
        if (data.requester_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.requester_email))
          return err("Enter a valid requester email")
        if (
          isSensitiveSupportCategory(data.category) &&
          !hasSupportAdminAction(actor.role, "support:sensitive")
        ) {
          return err("Forbidden", 403)
        }

        const source = data.source && validateSource(data.source) ? data.source : "ADMIN"
        const ticket = await createTicket({
          business_id: data.business_id,
          lead_id: data.lead_id || null,
          creator_id: data.creator_id || null,
          requester_partner_id: data.requester_partner_id || null,
          requester_name: data.requester_name || null,
          requester_email: data.requester_email || null,
          requester_on_behalf_of: data.requester_on_behalf_of || null,
          partner_id: data.partner_id || null,
          created_by_type: "ADMIN",
          created_by_id: actor.id,
          source,
          category: data.category,
          priority: data.priority,
          subject: data.subject,
          description: data.description || null
        })
        return ok(ticket)
      }

      if (action === "link_requester") {
        const type = data.requesterType as RequesterType
        if (!data.id || !(type in REQUESTER_FIELDS) || !data.requesterId)
          return err("Select a requester profile")
        const owner = await getSupportRequester(type, data.requesterId)
        if (!owner) return err("Requester not found", 404)
        const email = String(data.requesterEmail || owner.email || "").trim()
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("Enter a valid requester email")
        const { data: ticket, error } = await supabase
          .from("support_tickets")
          .update({
            business_id: null,
            lead_id: null,
            creator_id: null,
            requester_partner_id: null,
            [REQUESTER_FIELDS[type]]: owner.id,
            requester_name: String(data.requesterName || owner.contactName || owner.name).trim(),
            requester_email: email || null,
            requester_on_behalf_of: data.onBehalfOf || null,
            updated_at: now()
          })
          .eq("id", data.id)
          .select()
          .single()
        if (error || !ticket) return err("Could not link the requester", 500)
        await addEvent(
          data.id,
          "REQUESTER_CHANGED",
          "ADMIN",
          actor.id,
          {},
          undefined,
          `${type}: ${owner.name}`
        )
        await sendSupportUpdate(
          data.id,
          "Your support request is now linked to your contact profile.",
          actor.id
        )
        return ok(ticket)
      }

      if (action === "update") {
        if (!data.id) return err("Missing id")
        const { id, ...fields } = data
        const update: Record<string, string> = { updated_at: now() }
        if (fields.subject !== undefined) update.subject = fields.subject
        if (fields.description !== undefined) update.description = fields.description
        if (fields.category !== undefined) {
          if (!validateCategory(fields.category)) return err("Invalid category")
          if (
            isSensitiveSupportCategory(fields.category) &&
            !hasSupportAdminAction(actor.role, "support:sensitive")
          ) {
            return err("Forbidden", 403)
          }
          update.category = fields.category
        }

        const { data: ticket, error } = await supabase
          .from("support_tickets")
          .update(update)
          .eq("id", id)
          .select()
          .single()
        if (error || !ticket) return err(error?.message || "Update failed", 500)
        await addEvent(
          id,
          "DETAILS_UPDATED",
          "ADMIN",
          actor.id,
          {},
          undefined,
          update.category ? supportCategoryLabel(update.category) : "Ticket details updated"
        )
        await sendSupportUpdate(
          id,
          update.category
            ? `Your request has been categorised as ${supportCategoryLabel(update.category)}.`
            : "Your support request details have been updated.",
          actor.id
        )
        return ok(ticket)
      }

      if (action === "assign_admin") {
        if (!data.id || !data.adminUserId) return err("Missing id or adminUserId")
        const ticket = await assignAdmin(data.id, data.adminUserId, "ADMIN", actor.id)
        return ok(ticket)
      }

      if (action === "assign_partner") {
        if (!data.id || !data.partnerId || !data.partnerUserId)
          return err("Missing id, partnerId or partnerUserId")
        const ticket = await assignPartner(data.id, data.partnerId, data.partnerUserId, "ADMIN", actor.id)
        return ok(ticket)
      }

      if (action === "remove_partner") {
        if (!data.id) return err("Missing id")
        const ticket = await removePartner(data.id, "ADMIN", actor.id)
        return ok(ticket)
      }

      if (action === "change_status") {
        if (!data.id || !data.status || !validateStatus(data.status))
          return err("Missing id or invalid status")
        if (data.status === "CLOSED" && !hasSupportAdminAction(actor.role, "support:close")) {
          return err("Forbidden", 403)
        }
        const ticket = await changeStatus(data.id, data.status, "ADMIN", actor.id)
        return ok(ticket)
      }

      if (action === "change_priority") {
        if (!data.id || !data.priority || !validatePriority(data.priority))
          return err("Missing id or invalid priority")
        const ticket = await changePriority(data.id, data.priority, "ADMIN", actor.id)
        return ok(ticket)
      }

      if (action === "escalate") {
        if (!data.id) return err("Missing id")
        const reason = data.reason || ""
        const ticket = await escalateTicket(data.id, reason, "ADMIN", actor.id)
        return ok(ticket)
      }

      return err("Unknown action", 400)
    }

    if (resource === "messages") {
      if (action !== "create" && action !== "retry_email") return err("Unknown action", 400)
      if (!hasSupportAdminAction(actor.role, "support:update")) {
        return err("Forbidden", 403)
      }
      const { data: accessibleTicket } = await supabase
        .from("support_tickets")
        .select("category")
        .eq("id", data.ticketId)
        .maybeSingle()
      if (!accessibleTicket) return err("Ticket not found", 404)
      if (
        isSensitiveSupportCategory(accessibleTicket.category) &&
        !hasSupportAdminAction(actor.role, "support:sensitive")
      )
        return err("Forbidden", 403)
      if (action === "retry_email") {
        const { data: saved } = await supabase
          .from("support_ticket_messages")
          .select("*")
          .eq("id", data.messageId)
          .eq("ticket_id", data.ticketId)
          .eq("visibility", "PUBLIC")
          .single()
        if (!saved || !["ADMIN", "PARTNER", "SYSTEM"].includes(saved.author_type))
          return err("Reply not found", 404)
        const { data: ticket } = await supabase
          .from("support_tickets")
          .select("*")
          .eq("id", data.ticketId)
          .single()
        if (!ticket) return err("Ticket not found", 404)
        if (
          saved.author_type === "SYSTEM" &&
          ticket.status === "RESOLVED" &&
          (["resolution", "reminder"].includes(saved.email_kind) || !ticket.satisfaction_sent_at)
        ) {
          const result =
            saved.email_kind === "reminder"
              ? await sendSatisfactionReminder(ticket, actor.id)
              : await sendResolutionSatisfactionEmail(ticket, actor.id)
          await supabase
            .from("support_ticket_messages")
            .update({
              message_html: result.html,
              signature_html: result.signature,
              email_status: result.status,
              email_error: result.error,
              email_recipient: result.email,
              email_sent_at: result.sent ? now() : null
            })
            .eq("id", saved.id)
          return ok({ sent: result.sent, error: result.error })
        }
        const attachments: { filename: string; content: string }[] = []
        if (saved.attachment_ids?.length) {
          const { data: files, error: fileError } = await supabase
            .from("support_attachments")
            .select("storage_path,original_name")
            .eq("ticket_id", ticket.id)
            .in("id", saved.attachment_ids)
            .eq("is_internal", false)
          if (fileError || files?.length !== saved.attachment_ids.length)
            return err("Could not load the original attachments", 500)
          for (const file of files) {
            const { data: bytes, error: downloadError } = await supabase.storage
              .from("support-attachments")
              .download(file.storage_path)
            if (downloadError || !bytes) return err("Could not read the original attachment", 500)
            attachments.push({
              filename: file.original_name,
              content: Buffer.from(await bytes.arrayBuffer()).toString("base64")
            })
          }
        }
        const result = await sendTicketRequesterEmail({
          ticket,
          message: saved.message,
          messageHtml: saved.author_type === "SYSTEM" ? null : saved.message_html,
          actorId: actor.id,
          subjectPrefix: "Ticket update",
          messageId: saved.id,
          attachments
        })
        await supabase
          .from("support_ticket_messages")
          .update({
            signature_html: result.signature,
            email_status: result.status,
            email_error: result.error,
            email_recipient: result.email,
            email_sent_at: result.sent ? now() : null
          })
          .eq("id", saved.id)
        await addEvent(
          ticket.id,
          "EMAIL_RETRIED",
          "ADMIN",
          actor.id,
          {},
          undefined,
          result.sent ? "Email sent" : "Email failed"
        )
        return ok({ sent: result.sent, error: result.error })
      }
      if (!data.ticketId || !data.message) return err("Missing ticketId or message")
      const visibility = data.visibility === "INTERNAL" ? "INTERNAL" : "PUBLIC"
      if (visibility === "INTERNAL" && !hasSupportAdminAction(actor.role, "support:internal_notes")) {
        return err("Forbidden", 403)
      }
      const msg = await addMessage(
        data.ticketId,
        "ADMIN",
        actor.id,
        data.message,
        visibility,
        data.attachment_path,
        {
          html: typeof data.messageHtml === "string" ? sanitizeSupportHtml(data.messageHtml) : null,
          attachmentIds: Array.isArray(data.attachmentIds) ? data.attachmentIds : []
        }
      )

      // Creator tickets: notify the creator in-portal when the team replies publicly.
      if (visibility === "PUBLIC") {
        const { data: t } = await supabase
          .from("support_tickets")
          .select("creator_id, ticket_number")
          .eq("id", data.ticketId)
          .maybeSingle()
        if (t?.creator_id) {
          void pushCreatorNotification({
            creatorId: t.creator_id,
            type: "SUPPORT",
            title: `Reply on ticket ${t.ticket_number}`,
            body: String(data.message).slice(0, 200),
            link: `/creator/support/${data.ticketId}`
          })
        }
      }
      return ok(msg)
    }

    if (resource === "sla") {
      if (!hasSupportAdminAction(actor.role, "support:sla_manage")) {
        return err("Forbidden", 403)
      }
      if (action === "create") {
        const { data: row, error } = await supabase
          .from("support_sla_policies")
          .insert({ ...data, created_at: now(), updated_at: now() })
          .select()
          .single()
        if (error) return err(error.message, 500)
        return ok(row)
      }
      if (action === "update") {
        const { id, ...fields } = data
        const { data: row, error } = await supabase
          .from("support_sla_policies")
          .update({ ...fields, updated_at: now() })
          .eq("id", id)
          .select()
          .single()
        if (error) return err(error.message, 500)
        return ok(row)
      }
      return err("Unknown action", 400)
    }

    if (resource === "business_hours") {
      if (!hasSupportAdminAction(actor.role, "support:sla_manage")) {
        return err("Forbidden", 403)
      }
      if (action === "update") {
        const { id, ...fields } = data
        const { data: row, error } = await supabase
          .from("support_business_hours")
          .update({ ...fields, updated_at: now() })
          .eq("id", id)
          .select()
          .single()
        if (error) return err(error.message, 500)
        return ok(row)
      }
      return err("Unknown action", 400)
    }

    return err("Unknown resource", 404)
  } catch (e) {
    return err(String(e), 500)
  }
}
