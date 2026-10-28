import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { addMessage } from "@/lib/support"
import { inboundMessageKey, type InboundLeadEmail } from "@/lib/lead-emails-inbound"
import { htmlToText } from "@/lib/email-html"

/** Match only an explicit ticket reference and its known requester address. */
export async function fileInboundSupportEmail(email: InboundLeadEmail): Promise<boolean> {
  if (!isSupabaseConfigured() || !email.from) return false
  const reference = email.subject.match(/\bMPS-\d{4}-\d+\b/i)?.[0]?.toUpperCase()
  const ticketId = `${email.inReplyTo || ""} ${email.references || ""}`.match(
    /support-([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})-/i
  )?.[1]
  if (!reference && !ticketId) return false
  let query = supabase.from("support_tickets").select("id,requester_email,creator_id,requester_partner_id")
  query = ticketId ? query.eq("id", ticketId) : query.eq("ticket_number", reference)
  const { data: ticket, error } = await query.maybeSingle()
  if (error) throw new Error(`Could not match support reply: ${error.message}`)
  if (!ticket || ticket.requester_email?.trim().toLowerCase() !== email.from.trim().toLowerCase())
    return false
  const key = inboundMessageKey(email)
  if (key) {
    const { data: existing, error: lookupError } = await supabase
      .from("support_ticket_messages")
      .select("id")
      .eq("provider_message_id", key)
      .maybeSingle()
    if (lookupError) throw new Error("Could not check support email history")
    if (existing) return true
  }
  const text = email.text?.trim() || htmlToText(email.html || "")
  if (!text) return false
  try {
    await addMessage(
      ticket.id,
      ticket.creator_id ? "CREATOR" : ticket.requester_partner_id ? "PARTNER" : "CUSTOMER",
      null,
      text,
      "PUBLIC",
      null,
      { html: email.html || null, providerMessageId: key }
    )
  } catch (error) {
    // Concurrent IMAP/webhook delivery may have saved the same mail first.
    if (key) {
      const { data: existing } = await supabase
        .from("support_ticket_messages")
        .select("id")
        .eq("provider_message_id", key)
        .maybeSingle()
      if (existing) return true
    }
    throw error
  }
  return true
}
