/* ───────────────────────────  Creator support tickets  ───────────────────────────
 * Creators use the same support_tickets system as businesses — tickets carry
 * creator_id + category CREATOR_NETWORK so admin can route them to the
 * Creator/Digital team. SLA policies, messages and assignment all reuse
 * lib/support.ts.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { createTicket, addMessage, getSlaState, type SupportTicket, type SupportMessage } from "./support"

export const CREATOR_TICKET_CATEGORY = "CREATOR_NETWORK"

export const CREATOR_TICKET_TOPICS = [
  "Account & Login",
  "Learning & Onboarding",
  "Content & Brand",
  "Challenges",
  "Referrals & Rewards",
  "Payments",
  "Other",
] as const

export async function listCreatorTickets(creatorId: string): Promise<SupportTicket[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
  return (data || []) as SupportTicket[]
}

export async function getCreatorTicket(creatorId: string, ticketId: string): Promise<SupportTicket | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("creator_id", creatorId)
    .maybeSingle()
  return (data as SupportTicket | null) ?? null
}

export async function listCreatorTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .eq("visibility", "PUBLIC")
    .order("created_at", { ascending: true })
  return (data || []) as SupportMessage[]
}

export async function createCreatorTicket(input: {
  creatorId: string
  topic: string
  subject: string
  message: string
}): Promise<{ ok: boolean; ticket?: SupportTicket; error?: string }> {
  try {
    const ticket = await createTicket({
      business_id: null,
      creator_id: input.creatorId,
      created_by_type: "CREATOR",
      created_by_id: input.creatorId,
      source: "PORTAL",
      category: CREATOR_TICKET_CATEGORY,
      priority: "NORMAL",
      subject: input.topic ? `[${input.topic}] ${input.subject}` : input.subject,
      description: input.message,
    })
    await addMessage(ticket.id, "CREATOR", input.creatorId, input.message, "PUBLIC")
    return { ok: true, ticket }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create ticket" }
  }
}

export async function replyToCreatorTicket(
  creatorId: string,
  ticketId: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const ticket = await getCreatorTicket(creatorId, ticketId)
  if (!ticket) return { ok: false, error: "Ticket not found" }
  if (ticket.status === "CLOSED" || ticket.status === "CANCELLED") {
    return { ok: false, error: "This ticket is closed" }
  }
  try {
    await addMessage(ticketId, "CREATOR", creatorId, message, "PUBLIC")
    // A creator reply on a ticket waiting on them re-opens it for the team.
    if (ticket.status === "WAITING_CUSTOMER" || ticket.status === "RESOLVED") {
      await supabase
        .from("support_tickets")
        .update({ status: "IN_PROGRESS", updated_at: new Date().toISOString() })
        .eq("id", ticketId)
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send reply" }
  }
}

export { getSlaState }
