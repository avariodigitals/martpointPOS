import { z } from "zod"
import { supabase } from "@/lib/supabase"
import { buildSignatureHtml, escapeHtml, htmlToText } from "@/lib/email-html"
import { sanitizeSupportHtml } from "@/lib/support-html"
import type { EmailLayout } from "@/lib/email-layout"
import { renderCorrespondenceHtml } from "@/lib/email-correspondence"

export interface PartnerEmailRecipient {
  email: string
  label: string
}

export function partnerEmailRecipients(
  partner: { public_email?: string | null },
  users: { email: string; full_name: string; status: string }[]
): PartnerEmailRecipient[] {
  const recipients = new Map<string, PartnerEmailRecipient>()
  function add(email: string | null | undefined, label: string) {
    const normalized = email?.trim().toLowerCase()
    if (normalized && z.email().safeParse(normalized).success && !recipients.has(normalized)) {
      recipients.set(normalized, { email: normalized, label })
    }
  }
  add(partner.public_email, "Partner contact")
  for (const user of users) if (["ACTIVE", "INVITED"].includes(user.status)) add(user.email, user.full_name)
  return [...recipients.values()]
}

export async function loadPartnerEmailContext(id: string) {
  const [partner, users] = await Promise.all([
    supabase.from("partners").select("id, business_name, public_email").eq("id", id).maybeSingle(),
    supabase.from("partner_users").select("email, full_name, status").eq("partner_id", id).order("created_at")
  ])
  if (partner.error || users.error) throw new Error("Could not load partner contacts")
  return partner.data
    ? { partner: partner.data, recipients: partnerEmailRecipients(partner.data, users.data || []) }
    : null
}

export function buildPartnerEmailContent(bodyHtml: string, signatureHtml: string, senderName: string) {
  const body = sanitizeSupportHtml(bodyHtml)
  if (!htmlToText(body).trim()) throw new Error("Message is required")
  const signature = sanitizeSupportHtml(
    signatureHtml.trim() || `<p><strong>${escapeHtml(senderName)}</strong><br>MartPoint Partner Team</p>`
  )
  return {
    text: `${htmlToText(body)}\n\n-- \n${htmlToText(signature)}`,
    html: `${body}${buildSignatureHtml(signature, "")}`
  }
}

export async function renderPartnerEmail(bodyHtml: string, signatureHtml: string, senderName: string, layout: EmailLayout = "branded") {
  const content = buildPartnerEmailContent(bodyHtml, signatureHtml, senderName)
  return {
    text: content.text,
    html: await renderCorrespondenceHtml(content.html, content.text, layout, {
      eyebrow: "Partner Network",
      title: "Message from MartPoint",
      signoff: "MartPoint Partner Team",
    })
  }
}

export const PARTNER_EMAIL_FIELDS =
  "id, direction, from_email, to_email, subject, body_text, status, sent_by_name, error_message, created_at"

export function mapPartnerEmail(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    direction: String(row.direction),
    fromEmail: String(row.from_email),
    toEmail: String(row.to_email),
    subject: String(row.subject),
    bodyText: String(row.body_text || ""),
    status: String(row.status),
    sentByName: row.sent_by_name || null,
    error: row.error_message || null,
    createdAt: String(row.created_at)
  }
}
