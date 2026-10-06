import { NextResponse } from "next/server"
import { requirePartnerSession } from "@/lib/partner-auth"
import {
  canPartnerViewTicket,
  canPartnerManageTicket,
  addMessage,
  changeStatus,
  escalateTicket,
  createTicket,
  type SupportTicket,
  type SupportTicketStatus,
} from "@/lib/support"
import { supabase } from "@/lib/supabase"
import { partnerUserHasPermission } from "@/lib/partner-permissions"

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
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

/* ─────────────────────────────────────────────────────────────────────────────
   GET — list or single
   ───────────────────────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  const session = await requirePartnerSession()

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  try {
    if (id) {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, business:business_id (business_name, primary_contact_name, primary_email, primary_phone)")
        .eq("id", id)
        .single()
      if (error || !data) return err("Ticket not found", 404)

      const ticket = data as SupportTicket
      const canView = ticket.requester_partner_id === session.partnerId
        ? true
        : await canPartnerViewTicket(session.partnerId, ticket, session.partnerUserId)
      if (!canView) return err("Forbidden", 403)

      const [{ data: messages }, { data: events }] = await Promise.all([
        supabase
          .from("support_ticket_messages")
          .select("*")
          .eq("ticket_id", id)
          .eq("visibility", "PUBLIC")
          .order("created_at", { ascending: true }),
        supabase
          .from("support_ticket_events")
          .select("id, ticket_id, event_type, actor_type, previous_value, new_value, created_at")
          .eq("ticket_id", id)
          .order("created_at", { ascending: false }),
      ])

      return ok({ ticket, messages: messages || [], events: events || [] })
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .select("*, business:business_id (business_name)")
      .or(`assigned_partner_id.eq.${session.partnerId},requester_partner_id.eq.${session.partnerId}`)
      .order("created_at", { ascending: false })

    if (error) return err(error.message, 500)

    const visible = []
    for (const t of data || []) {
      const ticket = t as SupportTicket
      const canView = ticket.requester_partner_id === session.partnerId
        ? true
        : await canPartnerViewTicket(session.partnerId, ticket, session.partnerUserId)
      if (canView) visible.push(t)
    }

    return ok(visible)
  } catch (e) {
    return err(String(e), 500)
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   POST — partner actions
   ───────────────────────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  const session = await requirePartnerSession()

  try {
    const body = await request.json()
    const { action, data } = body as { action: string; data: Record<string, unknown> }
    if (!action) return err("Missing action")

    if (action === "create") {
      if (!partnerUserHasPermission(session.role, "partner:support:create")) return err("Forbidden", 403)
      const subject = typeof data?.subject === "string" ? data.subject.trim() : ""
      const description = typeof data?.description === "string" ? data.description.trim() : ""
      if (subject.length < 4 || subject.length > 200) return err("Subject must be between 4 and 200 characters")
      if (description.length < 10 || description.length > 5000) return err("Please describe the issue in 10 to 5000 characters")
      try {
        const ticket = await createTicket({
          requester_partner_id: session.partnerId,
          created_by_type: "PARTNER",
          created_by_id: session.partnerUserId,
          source: "PARTNER",
          category: "PARTNER_NETWORK",
          priority: "NORMAL",
          subject,
          description,
        })
        return ok(ticket)
      } catch (e) {
        console.error("[partner/support] ticket creation failed", e)
        return err("Could not create support ticket", 500)
      }
    }

    const ticketId = data.ticketId as string
    if (!ticketId) return err("Missing ticketId")

    const { data: row, error } = await supabase.from("support_tickets").select("*").eq("id", ticketId).single()
    if (error || !row) return err("Ticket not found", 404)
    const ticket = row as SupportTicket

    const canManage = ticket.requester_partner_id === session.partnerId
      ? true
      : await canPartnerManageTicket(session.partnerId, ticket, session.partnerUserId)
    if (!canManage) return err("Forbidden", 403)

    if (action === "reply") {
      const message = data.message as string
      if (!message) return err("Missing message")
      const visibility = (data.visibility as string) || "PUBLIC"
      if (visibility !== "PUBLIC") return err("Partner replies must be PUBLIC")
      const msg = await addMessage(ticketId, "PARTNER", session.partnerUserId, message, "PUBLIC", data.attachment_path as string | undefined)
      return ok(msg)
    }

    if (action === "set_in_progress") {
      const updated = await changeStatus(ticketId, "IN_PROGRESS", "PARTNER", session.partnerUserId)
      return ok(updated)
    }

    if (action === "set_waiting_customer") {
      const updated = await changeStatus(ticketId, "WAITING_CUSTOMER", "PARTNER", session.partnerUserId)
      return ok(updated)
    }

    if (action === "mark_resolved") {
      const updated = await changeStatus(ticketId, "RESOLVED", "PARTNER", session.partnerUserId)
      return ok(updated)
    }

    if (action === "escalate") {
      const reason = data.reason as string
      const updated = await escalateTicket(ticketId, reason || "", "PARTNER", session.partnerUserId)
      return ok(updated)
    }

    if (action === "change_status") {
      const status = data.status as string
      if (!validateStatus(status)) return err("Invalid status")
      const updated = await changeStatus(ticketId, status, "PARTNER", session.partnerUserId)
      return ok(updated)
    }

    return err("Unknown action", 400)
  } catch (e) {
    return err(String(e), 500)
  }
}
