import { NextResponse } from "next/server"
import { requirePartnerSession } from "@/lib/partner-auth"
import {
  canPartnerViewTicket,
  canPartnerManageTicket,
  addMessage,
  changeStatus,
  escalateTicket,
  type SupportTicket,
  type SupportTicketStatus,
} from "@/lib/support"
import { supabase } from "@/lib/supabase"

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
      const canView = await canPartnerViewTicket(session.partnerId, ticket, session.partnerUserId)
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
      .eq("assigned_partner_id", session.partnerId)
      .order("created_at", { ascending: false })

    if (error) return err(error.message, 500)

    const visible = []
    for (const t of data || []) {
      const ticket = t as SupportTicket
      const canView = await canPartnerViewTicket(session.partnerId, ticket, session.partnerUserId)
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

    const ticketId = data.ticketId as string
    if (!ticketId) return err("Missing ticketId")

    const { data: row, error } = await supabase.from("support_tickets").select("*").eq("id", ticketId).single()
    if (error || !row) return err("Ticket not found", 404)
    const ticket = row as SupportTicket

    const canManage = await canPartnerManageTicket(session.partnerId, ticket, session.partnerUserId)
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
