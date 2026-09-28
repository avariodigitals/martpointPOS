/* ───────────────────  Outbound lead email (server-only)  ───────────────────
 * Sends a message to a lead through the admin mailbox (SMTP) when configured,
 * otherwise through the transactional provider, and files it into the lead's
 * email thread (lead_emails). Shared by the Email tab and meeting invites.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, getEmailSettings, isSmtpConfigured, REPLY_TO, type EmailAttachment } from "./email"
import { sendEmailViaSmtp } from "./email-smtp"

export interface LeadEmailRecord {
  id: string
  leadId: string
  direction: "inbound" | "outbound"
  fromEmail: string | null
  toEmail: string | null
  subject: string | null
  bodyText: string | null
  bodyHtml: string | null
  status: string
  provider: string | null
  createdAt: string
}

export function mapLeadEmail(row: Record<string, unknown>): LeadEmailRecord {
  return {
    id: row.id as string,
    leadId: row.lead_id as string,
    direction: row.direction as LeadEmailRecord["direction"],
    fromEmail: (row.from_email as string) ?? null,
    toEmail: (row.to_email as string) ?? null,
    subject: (row.subject as string) ?? null,
    bodyText: (row.body_text as string) ?? null,
    bodyHtml: (row.body_html as string) ?? null,
    status: (row.status as string) ?? "sent",
    provider: (row.provider as string) ?? null,
    createdAt: row.created_at as string,
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

export interface SendLeadEmailInput {
  leadId: string
  to: string
  subject: string
  /** Plain-text body; the signature from settings is appended. */
  body: string
  /** Optional pre-rendered HTML. Defaults to the escaped text body. */
  html?: string
  /** Skip appending the mailbox signature. */
  noSignature?: boolean
  /** File attachments — e.g. an .ics calendar invite. */
  attachments?: EmailAttachment[]
  metadata?: Record<string, unknown>
}

export interface SendLeadEmailResult {
  sent: boolean
  email: LeadEmailRecord | null
  error?: string
}

export async function sendLeadEmail(input: SendLeadEmailInput): Promise<SendLeadEmailResult> {
  const settings = await getEmailSettings()
  // Lead threads go through the admin's own mailbox (SMTP) when configured,
  // so replies land in the real inbox and are picked up by the IMAP sync.
  const useMailbox = isSmtpConfigured(settings)
  const rawFrom = useMailbox
    ? settings.smtp.fromEmail || settings.smtp.user
    : settings.fromEmail || process.env.RESEND_FROM_EMAIL || "MartPoint <hello@martpoint.com.ng>"
  // Bare addresses get a display name so mail clients don't show an anonymous sender.
  const from = rawFrom.includes("<") ? rawFrom : `MartPoint <${rawFrom}>`

  const signature = settings.signature.trim()
  const textBody = signature && !input.noSignature ? `${input.body}\n\n-- \n${signature}` : input.body
  const html =
    input.html ||
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827;white-space:pre-wrap;">${escapeHtml(textBody)}</div>`

  const sent = useMailbox
    ? await sendEmailViaSmtp(
        { subject: input.subject, text: textBody, html, replyTo: from, attachments: input.attachments },
        settings,
        from,
        [input.to],
      )
    : await sendEmail({
        to: input.to,
        subject: input.subject,
        text: textBody,
        html,
        replyTo: REPLY_TO.sales,
        attachments: input.attachments,
      })

  if (!isSupabaseConfigured()) return { sent, email: null }

  const { data: row, error } = await supabase
    .from("lead_emails")
    .insert({
      lead_id: input.leadId,
      direction: "outbound",
      from_email: from,
      to_email: input.to,
      subject: input.subject,
      body_text: textBody,
      body_html: html,
      status: sent ? "sent" : "failed",
      provider: useMailbox ? "smtp" : settings.provider,
      metadata: input.metadata || null,
    })
    .select()
    .single()

  if (error) {
    console.error("[lead-emails] outbound insert failed:", error.message)
    return { sent, email: null, error: sent ? "Email sent but failed to save to thread" : "Failed to send email" }
  }

  return { sent, email: mapLeadEmail(row as Record<string, unknown>) }
}
