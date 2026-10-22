/* ───────────────────  Outbound lead email (server-only)  ───────────────────
 * Sends a message to a lead through the transactional provider (Resend/Brevo)
 * for deliverability and sending logs, with From and Reply-To on the admin's
 * sales mailbox so replies land in that inbox and the IMAP sync files them
 * back into the lead thread. SMTP is only the fallback when no provider API
 * key is configured. Files every message into lead_emails.
 * Shared by the Email tab and meeting invites.
 */

import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, getEmailSettings, isSmtpConfigured, REPLY_TO, type EmailAttachment, type EmailSettings } from "./email"
import { sendEmailViaSmtp } from "./email-smtp"
import { escapeHtml, htmlToText, bodyTextToHtml, buildSignatureHtml, appendSignatureToHtml } from "./email-html"
import { brandedEmailHtml } from "./email-templates"
import { buildLeadEmailTemplate, type LeadEmailStageKey } from "./lead-email-templates"

export { escapeHtml }

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
  providerMessageId: string | null
  metadata: Record<string, unknown> | null
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
    providerMessageId: (row.provider_message_id as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    createdAt: row.created_at as string,
  }
}

export interface SendLeadEmailInput {
  leadId: string
  to: string | string[]
  subject: string
  /** Plain-text body; the signature from settings is appended. */
  body: string
  /** Optional pre-rendered HTML. Defaults to the escaped text body. */
  html?: string
  /** Skip appending the mailbox signature. */
  noSignature?: boolean
  /** Carbon-copy recipients (visible to all). */
  cc?: string | string[]
  /** File attachments — e.g. an .ics calendar invite or a requested document. */
  attachments?: EmailAttachment[]
  /** Display name to front the shared mailbox — "send as" this person. */
  senderName?: string
  /** Per-user signature override. An omitted value uses the global fallback. */
  signatureHtml?: string
  /** Extra headers used for RFC email threading (In-Reply-To/References). */
  headers?: Record<string, string>
  metadata?: Record<string, unknown>
}

export interface SendLeadEmailResult {
  sent: boolean
  email: LeadEmailRecord | null
  error?: string
}

const ADDRESS_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+\.[^\s@]+$/

/** Read a sender out of a settings field. Accepts "Name <a@b>" or a bare
 *  address; returns null for anything that isn't a real address (e.g. the
 *  display-name text people type into the mailbox "From" field), so a typo in
 *  Settings → Email can't poison From and get the send rejected. */
function parseSenderAddress(raw: string | undefined): { address: string; name: string } | null {
  const value = (raw || "").trim()
  if (!value) return null
  const angled = value.match(/^(.*?)<([^>]+)>$/)
  const address = (angled ? angled[2] : value).trim()
  if (!ADDRESS_RE.test(address)) return null
  return { address, name: (angled ? angled[1] : "").trim() }
}

export interface LeadSenders {
  from: string
  replyTo: string
  /** Account-level sender, used when the mailbox is unusable or refused. */
  safeFrom: string
}

/** From/Reply-To for lead mail. The mailbox username carries the mail when the
 *  "From Email" field holds only a display name ("MartPoint Solutions"), so a
 *  half-typed Settings → Email entry can't produce a From address the provider
 *  rejects.
 *
 *  `senderName` implements "send as": the signed-in salesperson fronts the
 *  shared mailbox, so the customer sees a person while every reply still lands
 *  in the one inbox the IMAP sync reads. */
export function resolveLeadSenders(settings: EmailSettings, senderName?: string): LeadSenders {
  const fromEmail = (settings.smtp.fromEmail || "").trim()
  const mailboxAddress = parseSenderAddress(fromEmail) || parseSenderAddress(settings.smtp.user)
  // A "From Email" entry without an address in it is a display name.
  const configuredName = parseSenderAddress(fromEmail)?.name || (fromEmail.includes("@") ? "" : fromEmail)
  const displayName = (senderName || "").trim() || configuredName
  const accountSender =
    parseSenderAddress(settings.fromEmail) ||
    parseSenderAddress(process.env.RESEND_FROM_EMAIL) ||
    { address: "hello@martpoint.com.ng", name: "MartPoint" }

  const safeFrom = `${accountSender.name || "MartPoint"} <${accountSender.address}>`
  if (!mailboxAddress) return { from: safeFrom, replyTo: REPLY_TO.sales, safeFrom }

  const from = `${displayName || "MartPoint"} <${mailboxAddress.address}>`
  // Replies must reach the mailbox the IMAP sync reads — never the sender.
  return { from, replyTo: from, safeFrom }
}

/* Renders the parts exactly as the lead receives them: the text part with the
 * settings signature appended ("-- \n" style) and the HTML part — either a
 * pre-rendered branded body or the escaped text body — with the signature
 * block. Shared by sendLeadEmail and the admin preview endpoint so "Preview"
 * always matches the real delivery. */
export async function renderLeadEmail(
  input: Pick<SendLeadEmailInput, "body" | "html" | "noSignature" | "signatureHtml">,
  settings?: EmailSettings,
): Promise<{ text: string; html: string }> {
  const s = settings || (await getEmailSettings())
  // HTML signature (rich editor) wins; the plain-text field is the legacy
  // fallback. The text part always gets a derived plain-text version, like a
  // normal mail client signature.
  const hasSignatureOverride = input.signatureHtml !== undefined
  const signatureHtml = hasSignatureOverride ? input.signatureHtml!.trim() : s.signatureHtml.trim()
  const signatureText = (signatureHtml ? htmlToText(signatureHtml) : hasSignatureOverride ? "" : s.signature).trim()
  const hasSignature =
    !input.noSignature && Boolean(signatureText || /<img\b/i.test(signatureHtml))

  const text = hasSignature ? `${input.body}\n\n-- \n${signatureText}` : input.body
  const signatureBlock = hasSignature ? buildSignatureHtml(signatureHtml, signatureText) : ""
  const html = input.html
    ? appendSignatureToHtml(input.html, signatureBlock)
    : `${bodyTextToHtml(input.body)}${signatureBlock}`
  return { text, html }
}

/** Branded HTML body for a packaged lead email template, resolved against the
 *  lead's own industry when the composer didn't override it. */
export function leadTemplateBrandedHtml(
  template: { key: LeadEmailStageKey; industry?: string },
  lead: { full_name: string | null; business_name: string | null; industry?: string | null; business_type?: string | null },
): string {
  const tpl = buildLeadEmailTemplate(template.key, template.industry || lead.industry || lead.business_type, {
    fullName: lead.full_name,
    businessName: lead.business_name,
  })
  return brandedEmailHtml(tpl.bodyHtml, {
    eyebrow: tpl.eyebrow,
    title: tpl.title,
    signoff: "MartPoint Sales",
    preheader: tpl.preheader,
  })
}

export async function sendLeadEmail(input: SendLeadEmailInput): Promise<SendLeadEmailResult> {
  const settings = await getEmailSettings()
  // Lead mail goes out through the transactional provider (Resend/Brevo) for
  // deliverability and sending logs. From and Reply-To stay on the admin's
  // sales mailbox, so a plain Reply lands in the real inbox and the IMAP sync
  // files it back into the lead thread. SMTP only carries the mail when no
  // provider API key is configured.
  const useProvider =
    settings.provider === "brevo"
      ? Boolean(settings.brevoApiKey || process.env.BREVO_API_KEY)
      : Boolean(settings.resendApiKey || process.env.RESEND_API_KEY)
  const { from, replyTo, safeFrom } = resolveLeadSenders(settings, input.senderName)

  const { text: textBody, html } = await renderLeadEmail(input, settings)
  const messageId = input.headers?.["Message-ID"] || `<lead-${crypto.randomUUID()}@martpoint.com.ng>`
  const headers = { ...(input.headers || {}), "Message-ID": messageId }

  const viaProvider = useProvider || !isSmtpConfigured(settings)
  const sendProvider = (sender: string) =>
    sendEmail({
      to: input.to,
      subject: input.subject,
      text: textBody,
      html,
      from: sender,
      replyTo,
      cc: input.cc,
      attachments: input.attachments,
      headers,
    })
  const sendSmtp = (sender: string) =>
    sendEmailViaSmtp(
      { subject: input.subject, text: textBody, html, replyTo: sender, cc: input.cc, attachments: input.attachments, headers },
      settings,
      sender,
      Array.isArray(input.to) ? input.to : [input.to],
    )

  let sent = viaProvider ? await sendProvider(from) : await sendSmtp(from)
  let effectiveFrom = from
  let effectiveProvider = viaProvider ? settings.provider : "smtp"
  // The mailbox sender was refused (unverified domain, bad mailbox config).
  // Retry through the transactional provider with the account sender so the
  // lead still receives the message.
  if (!sent && useProvider && safeFrom !== from) {
    effectiveFrom = safeFrom
    effectiveProvider = settings.provider
    sent = await sendProvider(safeFrom)
  }

  if (!isSupabaseConfigured()) return { sent, email: null }

  const { data: row, error } = await supabase
    .from("lead_emails")
    .insert({
      lead_id: input.leadId,
      direction: "outbound",
      from_email: effectiveFrom,
      to_email: Array.isArray(input.to) ? input.to.join(", ") : input.to,
      subject: input.subject,
      body_text: textBody,
      body_html: html,
      status: sent ? "sent" : "failed",
      provider: effectiveProvider,
      provider_message_id: sent ? messageId : null,
      metadata: {
        ...(input.metadata || {}),
        cc: input.cc ? (Array.isArray(input.cc) ? input.cc.join(", ") : input.cc) : null,
      },
    })
    .select()
    .single()

  if (error) {
    console.error("[lead-emails] outbound insert failed:", error.message)
    return { sent, email: null, error: sent ? "Email sent but failed to save to thread" : "Failed to send email" }
  }

  return { sent, email: mapLeadEmail(row as Record<string, unknown>) }
}
