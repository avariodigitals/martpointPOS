/* ───────────────────  Inbound lead email filing  ───────────────────
 * Shared logic used by /api/webhooks/email (provider inbound-parse) and
 * /api/cron/email-sync (IMAP polling): match the sender to a lead, dedupe by
 * provider_message_id, and insert an inbound row into lead_emails.
 */

import { supabase, isSupabaseConfigured } from "./supabase"

export interface InboundLeadEmail {
  from: string
  to: string
  subject: string
  text: string
  html: string
  messageId: string | null
  inReplyTo?: string | null
  provider?: string | null
}

/** Files an inbound email into lead_emails if the sender matches a lead.
 * Returns true when a row was inserted. */
export async function fileInboundLeadEmail(email: InboundLeadEmail): Promise<boolean> {
  if (!isSupabaseConfigured() || !email.from) return false

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .ilike("email", email.from)
    .limit(1)
    .maybeSingle()

  if (!lead) return false

  if (email.messageId) {
    const { data: existing } = await supabase
      .from("lead_emails")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("provider_message_id", email.messageId)
      .limit(1)
      .maybeSingle()
    if (existing) return false
  }

  const { error } = await supabase.from("lead_emails").insert({
    lead_id: lead.id,
    direction: "inbound",
    from_email: email.from,
    to_email: email.to || null,
    subject: email.subject,
    body_text: email.text || null,
    body_html: email.html || null,
    status: "received",
    provider: email.provider || null,
    provider_message_id: email.messageId,
    metadata: email.inReplyTo ? { in_reply_to: email.inReplyTo } : null,
  })

  if (error) {
    console.error("[lead-emails] inbound insert failed:", error.message)
    return false
  }
  return true
}
