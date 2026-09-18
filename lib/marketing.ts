/* ───────────────────────────  Email marketing helpers  ───────────────────────────
 * Shared logic for the admin email-marketing mini app: audience resolution,
 * unsubscribe suppression, per-recipient tracked HTML (open pixel + click
 * redirect + unsubscribe footer), merge tags and HTML→text fallback.
 */

import { supabase, isSupabaseConfigured } from "./supabase"

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
 * Wraps every http(s) link in the HTML with the click-tracking redirect,
 * injects the inbox preheader (hidden preview text), and appends the
 * unsubscribe footer plus the open-tracking pixel.
 */
export function buildMarketingHtml(html: string, token: string, baseUrl: string, preheader?: string): string {
  const base = baseUrl.replace(/\/$/, "")
  const preheaderBlock = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}${"&zwnj;&nbsp;".repeat(20)}</div>`
    : ""
  const tracked = html.replace(/href="([^"]+)"/gi, (match, url: string) => {
    if (!/^https?:\/\//i.test(url)) return match
    if (url.includes("/unsubscribe") || url.includes("/api/marketing/")) return match
    return `href="${base}/api/marketing/track/click/${token}?u=${encodeURIComponent(url)}"`
  })
  const unsubUrl = `${base}/unsubscribe?t=${encodeURIComponent(token)}`
  return `${preheaderBlock}${tracked}
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;font-family:sans-serif">
  You are receiving this email because you subscribed to MartPoint updates or shared your details with our team.<br>
  <a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline">Unsubscribe</a> from these emails &middot; MartPoint &middot; martpoint.com.ng
</div>
<img src="${base}/api/marketing/track/open/${encodeURIComponent(token)}" width="1" height="1" alt="" style="display:none" />`
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
