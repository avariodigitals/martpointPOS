import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { changeStatus } from "@/lib/support"
import {
  sendSatisfactionReminder,
  sendResolutionSatisfactionEmail,
  sendFinalClosureEmail
} from "@/lib/support-ticket-email"
import { supportFollowupAction } from "@/lib/support-followup-policy"

export async function runSupportTicketFollowups() {
  if (!isSupabaseConfigured()) throw new Error("Database unavailable")
  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("status", "RESOLVED")
    .is("satisfaction_response", null)
    .order("followup_attempted_at", { nullsFirst: true })
    .limit(100)
  if (error) throw new Error(`Could not load ticket follow-ups: ${error.message}`)
  const counts = { confirmed: 0, reminded: 0, closed: 0, failed: 0 }
  const deadline = Date.now() + 45000
  for (const snapshot of tickets || []) {
    if (Date.now() >= deadline) break
    const action = supportFollowupAction(snapshot)
    if (!action) {
      await supabase
        .from("support_tickets")
        .update({ followup_attempted_at: new Date().toISOString() })
        .eq("id", snapshot.id)
        .eq("status", "RESOLVED")
      continue
    }
    const claim = crypto.randomUUID()
    const current = new Date().toISOString()
    const { data: ticket } = await supabase
      .from("support_tickets")
      .update({
        followup_attempted_at: current,
        followup_claim: claim,
        followup_claim_expires_at: new Date(Date.now() + 300000).toISOString()
      })
      .eq("id", snapshot.id)
      .eq("status", "RESOLVED")
      .eq("updated_at", snapshot.updated_at)
      .or(`followup_claim_expires_at.is.null,followup_claim_expires_at.lt.${current}`)
      .select("*")
      .maybeSingle()
    if (!ticket) continue
    try {
      if (action === "confirm") {
        if ((await sendResolutionSatisfactionEmail(ticket)).sent) counts.confirmed++
        else counts.failed++
      } else if (action === "remind") {
        if ((await sendSatisfactionReminder(ticket)).sent) counts.reminded++
        else counts.failed++
      } else {
        // A final note must be accepted before any unattended ticket closes.
        const result = await sendFinalClosureEmail(ticket)
        if (!result.sent) {
          counts.failed++
          continue
        }
        const { data: unchanged, error: markerError } = await supabase
          .from("support_tickets")
          .update({ final_closure_notice_sent_at: new Date().toISOString() })
          .eq("id", ticket.id)
          .eq("status", "RESOLVED")
          .eq("updated_at", ticket.updated_at)
          .eq("followup_claim", claim)
          .select("id")
          .maybeSingle()
        if (markerError || !unchanged) continue
        await changeStatus(ticket.id, "CLOSED", "SYSTEM", undefined, {
          skipEmail: true,
          allowUnconfirmedClose: true,
          expectedUpdatedAt: ticket.updated_at
        })
        counts.closed++
      }
    } catch (cause) {
      counts.failed++
      console.error("[support-ticket-followup]", ticket.ticket_number, cause)
    } finally {
      await supabase
        .from("support_tickets")
        .update({ followup_claim: null, followup_claim_expires_at: null })
        .eq("id", ticket.id)
        .eq("followup_claim", claim)
    }
  }
  return counts
}
