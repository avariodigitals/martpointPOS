/* ───────────────────────────  Email marketing helpers  ───────────────────────────
 * Shared logic for the admin email-marketing mini app: audience resolution,
 * unsubscribe suppression, per-recipient tracked HTML (open pixel + click
 * redirect + unsubscribe footer), merge tags and HTML→text fallback.
 */

import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail } from "./email"
import type { EmailProvider } from "./email"

export interface MarketingRecipient {
  email: string
  name: string
}

export type MarketingAudience = "leads" | "partner_leads" | "businesses" | "manual"

export const MARKETING_AUDIENCES: Array<{ key: MarketingAudience; label: string }> = [
  { key: "leads", label: "Leads" },
  { key: "partner_leads", label: "Partner Leads" },
  { key: "businesses", label: "Businesses" },
  { key: "manual", label: "Paste emails" },
]

const MAX_CAMPAIGN_RECIPIENTS = 500

export function normalizeEmail(e: string): string {
  return (e || "").trim().toLowerCase()
}

export function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** Parse a pasted list — one per line or comma/semicolon separated. Accepts "Name <email>". */
export function parseManualEmails(raw: string): MarketingRecipient[] {
  const seen = new Set<string>()
  const out: MarketingRecipient[] = []
  for (const part of raw.split(/[\n,;]+/)) {
    const p = part.trim()
    if (!p) continue
    const m = p.match(/^(.*?)<([^>]+)>\s*$/)
    const name = m ? m[1].trim() : ""
    const email = normalizeEmail(m ? m[2] : p)
    if (!isValidEmail(email) || seen.has(email)) continue
    seen.add(email)
    out.push({ email, name })
  }
  return out
}

export async function getAudienceRecipients(audience: string): Promise<MarketingRecipient[]> {
  if (!isSupabaseConfigured()) return []
  const seen = new Set<string>()
  const out: MarketingRecipient[] = []
  const push = (email: unknown, name: unknown) => {
    const e = normalizeEmail(String(email || ""))
    if (!isValidEmail(e) || seen.has(e)) return
    seen.add(e)
    out.push({ email: e, name: String(name || "").trim() })
  }

  if (audience === "leads") {
    const { data } = await supabase
      .from("leads")
      .select("email, full_name")
      .order("submitted_at", { ascending: false })
    for (const r of data || []) push(r.email, r.full_name)
  } else if (audience === "partner_leads") {
    const { data } = await supabase
      .from("partner_leads")
      .select("email, contact_name, business_name")
      .order("created_at", { ascending: false })
    for (const r of data || []) push(r.email, r.contact_name || r.business_name)
  } else if (audience === "businesses") {
    const { data } = await supabase
      .from("businesses")
      .select("primary_email, primary_contact_name, business_name")
      .order("created_at", { ascending: false })
    for (const r of data || []) push(r.primary_email, r.primary_contact_name || r.business_name)
  }

  return out.slice(0, MAX_CAMPAIGN_RECIPIENTS)
}

/** Contacts of a saved audience created in /admin/marketing/audiences. */
export async function getSavedAudienceRecipients(audienceId: string): Promise<MarketingRecipient[]> {
  if (!isSupabaseConfigured() || !audienceId) return []
  const { data } = await supabase
    .from("marketing_contacts")
    .select("email, name")
    .eq("audience_id", audienceId)
    .order("created_at", { ascending: true })

  const seen = new Set<string>()
  const out: MarketingRecipient[] = []
  for (const r of data || []) {
    const e = normalizeEmail(String(r.email || ""))
    if (!isValidEmail(e) || seen.has(e)) continue
    seen.add(e)
    out.push({ email: e, name: String(r.name || "").trim() })
  }
  return out.slice(0, MAX_CAMPAIGN_RECIPIENTS)
}

/** Returns the subset of `emails` present on the unsubscribe suppression list. */
export async function getSuppressedEmails(emails: string[]): Promise<Set<string>> {
  const suppressed = new Set<string>()
  if (!isSupabaseConfigured() || emails.length === 0) return suppressed
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200)
    const { data } = await supabase.from("marketing_unsubscribes").select("email").in("email", chunk)
    for (const r of data || []) suppressed.add(normalizeEmail(r.email))
  }
  return suppressed
}

export function applyMergeTags(input: string, recipient: MarketingRecipient): string {
  const firstName = recipient.name.split(/\s+/)[0] || ""
  return input
    .replace(/\{\{\s*name\s*\}\}/gi, recipient.name)
    .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
    .replace(/\{\{\s*email\s*\}\}/gi, recipient.email)
}

/**
 * Builds the final campaign HTML for one recipient:
 *  - resolves relative src/href URLs against the site base
 *  - wraps simple content in the branded MartPoint shell (logo header + card);
 *    pasted full documents (with <html>/<body>) pass through unwrapped
 *  - rewrites http(s) links through the click tracker
 *  - injects the hidden preheader, unsubscribe footer and open pixel
 */
export function buildMarketingHtml(html: string, token: string, baseUrl: string, preheader?: string): string {
  const base = baseUrl.replace(/\/$/, "")

  const preheaderBlock = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}${"&zwnj;&nbsp;".repeat(20)}</div>`
    : ""

  // Resolve relative asset/link URLs so pasted content and uploads always render
  let body = html.replace(/\b(src|href)="(?!https?:|mailto:|tel:|#|data:)([^"]+)"/gi, (_m, attr: string, url: string) => {
    const path = url.startsWith("/") ? url : `/${url}`
    return `${attr}="${base}${path}"`
  })

  // Rewrite external links through the click tracker
  body = body.replace(/href="([^"]+)"/gi, (match, url: string) => {
    if (!/^https?:\/\//i.test(url)) return match
    if (url.includes("/unsubscribe") || url.includes("/api/marketing/")) return match
    return `href="${base}/api/marketing/track/click/${token}?u=${encodeURIComponent(url)}"`
  })

  const unsubUrl = `${base}/unsubscribe?t=${encodeURIComponent(token)}`
  const footer = `<div style="margin-top:24px;font-size:12px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;text-align:center">
  You are receiving this email because you subscribed to MartPoint updates or shared your details with our team.<br>
  <a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline">Unsubscribe</a> from these emails &middot; MartPoint &middot; martpoint.com.ng
</div>`
  const pixel = `<img src="${base}/api/marketing/track/open/${encodeURIComponent(token)}" width="1" height="1" alt="" style="display:none" />`

  // Full documents keep their own layout — just add footer + pixel
  if (/<html|<body/i.test(html)) {
    return `${preheaderBlock}${body}\n${footer}\n${pixel}`
  }

  // Branded shell for simple content
  return `${preheaderBlock}<div style="margin:0;padding:0;background:#f4f5f7">
  <div style="max-width:620px;margin:0 auto;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="padding:18px 24px;border-bottom:1px solid #f1f5f9">
        <img src="${base}/logo.webp" alt="MartPoint" height="34" style="height:34px;display:block" />
      </div>
      <div style="padding:24px;font-size:15px;line-height:1.65;color:#1f2937">
        ${body}
      </div>
    </div>
    ${footer}
  </div>
</div>
${pixel}`
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&middot;/g, "·")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function unsubscribeUrl(token: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/unsubscribe?t=${encodeURIComponent(token)}`
}

export function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "https://www.martpoint.com.ng").replace(/\/$/, "")
}

/** Resolve recipients for a campaign — snapshot first, else by audience. */
export async function resolveCampaignRecipients(campaign: {
  audience: string
  audience_id?: string | null
  recipients_snapshot?: MarketingRecipient[] | null
}): Promise<MarketingRecipient[]> {
  const snapshot = campaign.recipients_snapshot
  if (Array.isArray(snapshot) && snapshot.length > 0) {
    const seen = new Set<string>()
    const out: MarketingRecipient[] = []
    for (const r of snapshot) {
      const e = normalizeEmail(String(r?.email || ""))
      if (!isValidEmail(e) || seen.has(e)) continue
      seen.add(e)
      out.push({ email: e, name: String(r?.name || "").trim() })
    }
    return out
  }
  if (campaign.audience === "saved") {
    return getSavedAudienceRecipients(String(campaign.audience_id || ""))
  }
  return getAudienceRecipients(campaign.audience || "leads")
}

/**
 * Executes a campaign: resolves recipients, re-checks the suppression list at
 * send time, sends per-recipient tracked email, records sends and updates the
 * campaign status. Used for immediate sends and by the scheduler.
 */
export async function executeCampaign(campaignId: string): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!isSupabaseConfigured()) return { sent: 0, failed: 0, skipped: 0 }

  const { data: campaign } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single()

  if (!campaign) return { sent: 0, failed: 0, skipped: 0 }

  const recipients = await resolveCampaignRecipients(campaign)
  const suppressed = await getSuppressedEmails(recipients.map((r) => r.email))
  const deliverable = recipients.filter((r) => !suppressed.has(r.email))
  const skipped = recipients.length - deliverable.length

  const baseUrl = getBaseUrl()
  const plainText = campaign.text || htmlToText(campaign.html || "")
  const provider: EmailProvider | undefined =
    campaign.provider === "resend" || campaign.provider === "brevo" ? campaign.provider : undefined

  await supabase
    .from("marketing_campaigns")
    .update({ status: "sending", recipient_count: deliverable.length })
    .eq("id", campaignId)

  let sent = 0
  let failed = 0

  for (const recipient of deliverable) {
    const token = crypto.randomUUID()
    const mergedSubject = applyMergeTags(campaign.subject || "", recipient)
    const trackedHtml = buildMarketingHtml(
      applyMergeTags(campaign.html || "", recipient),
      token,
      baseUrl,
      campaign.preheader || undefined
    )

    const ok = await sendEmail({
      to: recipient.email,
      subject: mergedSubject,
      text: applyMergeTags(plainText, recipient),
      html: trackedHtml,
      provider,
      route: "marketing",
      headers: { "List-Unsubscribe": `<${unsubscribeUrl(token, baseUrl)}>` },
    })

    await supabase.from("marketing_sends").insert({
      campaign_id: campaignId,
      email: recipient.email,
      name: recipient.name,
      token,
      status: ok ? "sent" : "failed",
      error_message: ok ? null : "send failed",
      sent_at: ok ? new Date().toISOString() : null,
    })

    if (ok) sent += 1
    else failed += 1
  }

  const status = sent === 0 ? "failed" : failed > 0 ? "partial" : "sent"
  await supabase
    .from("marketing_campaigns")
    .update({ status, sent_at: new Date().toISOString() })
    .eq("id", campaignId)

  return { sent, failed, skipped }
}
