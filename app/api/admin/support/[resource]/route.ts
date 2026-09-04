import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { hasSupportAdminAction, isSensitiveSupportCategory } from "@/lib/support-permissions"
import type { SupportAdminAction } from "@/lib/support-permissions"
import { supabase } from "@/lib/supabase"
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
  type SupportTicket,
  type SupportTicketStatus,
  type SupportPriority,
} from "@/lib/support"

type Action = string

const ticketActionPerm: Record<string, SupportAdminAction> = {
  create: "support:create",
  update: "support:update",
  assign_admin: "support:assign",
  assign_partner: "support:assign",
  remove_partner: "support:assign",
  change_status: "support:update",
  change_priority: "support:update",
  escalate: "support:update",
}

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
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
    "CANCELLED",
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
    "OTHER",
  ]
  return categories.includes(value)
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
    if (resource === "tickets") {
      let q = supabase
        .from("support_tickets")
        .select(
          "*, business:business_id (business_name, primary_contact_name, primary_email), admin:assigned_admin_user_id (name), partner:assigned_partner_id (display_name)"
        )
        .order("created_at", { ascending: false })

      if (id) q = q.eq("id", id).single() as any
      else {
        if (status) q = q.eq("status", status)
        if (priority) q = q.eq("priority", priority)
        if (category) q = q.eq("category", category)
        if (businessId) q = q.eq("business_id", businessId)
      }

      const { data, error } = await q
      if (error) return err(error.message, 500)

      const tickets = Array.isArray(data) ? data : [data]
      const canSeeSensitive = hasSupportAdminAction(actor.role, "support:sensitive")

      const visible = tickets.filter((t: any) => {
        if (!isSensitiveSupportCategory(t.category)) return true
        return canSeeSensitive
      })

      const enriched = await Promise.all(
        visible.map(async (t: any) => {
          const slaState = await getSlaState(t.resolution_due_at as string | null)
          const summary: any = { business: t.business }
          if (id) {
            const [{ data: ent }, { data: sub }] = await Promise.all([
              supabase.from("business_entitlements").select("*").eq("business_id", t.business_id).maybeSingle(),
              supabase
                .from("subscriptions")
                .select("*, plans(*)")
                .eq("business_id", t.business_id)
                .order("current_period_end", { ascending: false })
                .maybeSingle(),
            ])
            summary.entitlement = ent
            summary.subscription = sub
          }
          return { ...t, sla_state: slaState, business_summary: summary }
        })
      )

      if (id) {
        const single = enriched[0]
        if (!single) return err("Not found", 404)
        if (isSensitiveSupportCategory(single.category) && !canSeeSensitive) {
          return err("Forbidden", 403)
        }
        return ok(single)
      }

      if (search) {
        const s = search.toLowerCase()
        return ok(
          enriched.filter(
            (t: any) =>
              t.ticket_number?.toLowerCase().includes(s) ||
              t.subject?.toLowerCase().includes(s) ||
              t.business?.business_name?.toLowerCase().includes(s)
          )
        )
      }

      return ok(enriched)
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
      return ok(data)
    }

    if (resource === "events") {
      if (!ticketId) return err("Missing ticketId")
      const { data, error } = await supabase
        .from("support_ticket_events")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false })
      if (error) return err(error.message, 500)
      return ok(data)
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
    const { action, data } = body as { action: Action; data: any }
    if (!action) return err("Missing action")

    if (resource === "tickets") {
      const perm = ticketActionPerm[action]
      if (!perm || !hasSupportAdminAction(actor.role, perm)) {
        return err("Forbidden", 403)
      }

      if (action === "create") {
        if (!data.business_id) return err("Missing business_id")
        if (!data.category || !validateCategory(data.category)) return err("Invalid category")
        if (!data.priority || !validatePriority(data.priority)) return err("Invalid priority")
        if (!data.subject) return err("Missing subject")
        if (isSensitiveSupportCategory(data.category) && !hasSupportAdminAction(actor.role, "support:sensitive")) {
          return err("Forbidden", 403)
        }

        const ticket = await createTicket({
          business_id: data.business_id,
          partner_id: data.partner_id || null,
          created_by_type: "ADMIN",
          created_by_id: actor.id,
          source: "ADMIN",
          category: data.category,
          priority: data.priority,
          subject: data.subject,
          description: data.description || null,
        })
        return ok(ticket)
      }

      if (action === "update") {
        if (!data.id) return err("Missing id")
        const { id, ...fields } = data
        const update: Record<string, any> = { updated_at: now() }
        if (fields.subject !== undefined) update.subject = fields.subject
        if (fields.description !== undefined) update.description = fields.description
        if (fields.category !== undefined) {
          if (!validateCategory(fields.category)) return err("Invalid category")
          if (isSensitiveSupportCategory(fields.category) && !hasSupportAdminAction(actor.role, "support:sensitive")) {
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
        return ok(ticket)
      }

      if (action === "assign_admin") {
        if (!data.id || !data.adminUserId) return err("Missing id or adminUserId")
        const ticket = await assignAdmin(data.id, data.adminUserId, "ADMIN", actor.id)
        return ok(ticket)
      }

      if (action === "assign_partner") {
        if (!data.id || !data.partnerId || !data.partnerUserId) return err("Missing id, partnerId or partnerUserId")
        const ticket = await assignPartner(data.id, data.partnerId, data.partnerUserId, "ADMIN", actor.id)
        return ok(ticket)
      }

      if (action === "remove_partner") {
        if (!data.id) return err("Missing id")
        const ticket = await removePartner(data.id, "ADMIN", actor.id)
        return ok(ticket)
      }

      if (action === "change_status") {
        if (!data.id || !data.status || !validateStatus(data.status)) return err("Missing id or invalid status")
        if (data.status === "CLOSED" && !hasSupportAdminAction(actor.role, "support:close")) {
          return err("Forbidden", 403)
        }
        const ticket = await changeStatus(data.id, data.status, "ADMIN", actor.id)
        return ok(ticket)
      }

      if (action === "change_priority") {
        if (!data.id || !data.priority || !validatePriority(data.priority)) return err("Missing id or invalid priority")
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
      if (action !== "create") return err("Unknown action", 400)
      if (!hasSupportAdminAction(actor.role, "support:update")) {
        return err("Forbidden", 403)
      }
      if (!data.ticketId || !data.message) return err("Missing ticketId or message")
      const visibility = data.visibility === "INTERNAL" ? "INTERNAL" : "PUBLIC"
      if (visibility === "INTERNAL" && !hasSupportAdminAction(actor.role, "support:internal_notes")) {
        return err("Forbidden", 403)
      }
      const msg = await addMessage(data.ticketId, "ADMIN", actor.id, data.message, visibility, data.attachment_path)
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
