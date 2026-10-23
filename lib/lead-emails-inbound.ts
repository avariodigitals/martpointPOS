/* ───────────────────  Inbound lead email filing  ───────────────────
 * Shared logic used by /api/webhooks/email (provider inbound-parse) and
 * /api/cron/email-sync (IMAP polling): match the sender to a lead, dedupe by
 * message id, and insert an inbound row into lead_emails.
 */

import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { notifyAllAdmins } from "./admin-notifications"

export interface InboundLeadEmail {
  from: string
  to: string
  subject: string
  text: string
  html: string
  messageId: string | null
  inReplyTo?: string | null
  cc?: string | null
  references?: string | null
  sentAt?: string | null
  provider?: string | null
}

/**
 * Stable id for a message. Mail without a Message-ID header (rare, but some
 * bulk senders omit it) still needs one, otherwise every sync run would file it
 * again — so fall back to a fingerprint of sender, subject and timestamp.
 */
export function inboundMessageKey(email: Pick<InboundLeadEmail, "messageId" | "from" | "subject" | "sentAt">): string | null {
  const messageId = email.messageId?.trim()
  if (messageId) return messageId
  if (!email.from && !email.subject) return null
  const fingerprint = crypto
    .createHash("sha1")
    .update(`${email.from.toLowerCase()}|${email.subject}|${email.sentAt || ""}`)
    .digest("hex")
  return `no-message-id:${fingerprint}`
}

/** Leads reply from the address on their form, and sometimes a second one. */
async function findLeadByAddress(address: string): Promise<{ id: string; full_name: string; business_name: string } | null> {
  for (const column of ["email", "additional_email"] as const) {
    const { data } = await supabase
      .from("leads")
      .select("id, full_name, business_name")
      .ilike(column, address)
      .limit(1)
      .maybeSingle()
    if (data?.id) {
      return {
        id: String(data.id),
        full_name: String(data.full_name || "Lead"),
        business_name: String(data.business_name || "Unnamed business"),
      }
    }
  }
  return null
}

/** Files an inbound email into lead_emails if the sender matches a lead.
 * Returns true when a row was inserted. */
export async function fileInboundLeadEmail(email: InboundLeadEmail): Promise<boolean> {
  if (!isSupabaseConfigured() || !email.from) return false

  const lead = await findLeadByAddress(email.from)
  if (!lead) return false

  const messageKey = inboundMessageKey(email)
  if (messageKey) {
    const { data: existing } = await supabase
      .from("lead_emails")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("provider_message_id", messageKey)
      .limit(1)
      .maybeSingle()
    if (existing) return false
  }

  const { data: inserted, error } = await supabase.from("lead_emails").insert({
    lead_id: lead.id,
    direction: "inbound",
    from_email: email.from,
    to_email: email.to || null,
    subject: email.subject,
    body_text: email.text || null,
    body_html: email.html || null,
    status: "received",
    provider: email.provider || null,
    provider_message_id: messageKey,
    metadata: {
      in_reply_to: email.inReplyTo || null,
      references: email.references || null,
      cc: email.cc || null,
      sent_at: email.sentAt || null,
    },
  }).select("id").single()

  if (error) {
    console.error("[lead-emails] inbound insert failed:", error.message)
    return false
  }

  try {
    await notifyAllAdmins({
      type: "LEAD_EMAIL_RECEIVED",
      title: "New email received from a lead",
      message: `${lead.business_name} · ${lead.full_name} · ${email.subject || "(no subject)"}`,
      deep_link: `/admin/leads?lead=${encodeURIComponent(lead.id)}`,
      source_type: "lead_email",
      source_id: inserted?.id ? String(inserted.id) : lead.id,
      email: {
        route: "lead_submission",
        subject: `New lead email: ${email.subject || "(no subject)"}`,
        text: [
          "A new email was received from a lead.",
          `Lead: ${lead.full_name}`,
          `Business: ${lead.business_name}`,
          `From: ${email.from}`,
          `Subject: ${email.subject || "(no subject)"}`,
          "",
          "Open Admin → Leads → Email to reply.",
        ].join("\n"),
      },
    })
  } catch (notificationError) {
    console.error("[lead-emails] admin notification failed:", notificationError)
  }
  return true
}
