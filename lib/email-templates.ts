/* ───────────────────────────  Email templates  ───────────────────────────
 * Predefined outbound-email copy. Each template has a subject + plain-text
 * body with {{variable}} placeholders. Admins can override any template in
 * /admin/settings/email-templates; overrides are stored in
 * settings.data.email.templates and merged over the defaults at send time.
 */

import { supabase, isSupabaseConfigured } from "./supabase"

export interface EmailTemplate {
  subject: string
  text: string
  /** Optional HTML body; if empty the text body is used. */
  html?: string
}

export interface TemplateDefinition extends EmailTemplate {
  key: string
  label: string
  description: string
  variables: string[]
}

/** Escape user/admin-supplied text before embedding it in an HTML email. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export type StatusTone = "success" | "info" | "warning" | "danger" | "neutral"

const STATUS_TONE_COLORS: Record<StatusTone, { bg: string; fg: string }> = {
  success: { bg: "#d1fae5", fg: "#065f46" },
  info: { bg: "#dbeafe", fg: "#1e40af" },
  warning: { bg: "#fef3c7", fg: "#92400e" },
  danger: { bg: "#fee2e2", fg: "#991b1b" },
  neutral: { bg: "#e5e7eb", fg: "#374151" },
}

/** Rounded status badge used inside HTML status emails. Label is HTML-escaped. */
export function statusPillHtml(label: string, tone: StatusTone): string {
  const c = STATUS_TONE_COLORS[tone]
  return `<span style="display:inline-block; padding:6px 14px; border-radius:9999px; font-size:13px; font-weight:600; background-color:${c.bg}; color:${c.fg};">${escapeHtml(label)}</span>`
}

/* ───────────────────────────  Branded HTML shell  ───────────────────────────
 * Wraps a body fragment in the standard MartPoint email layout (gradient
 * header with the MartPoint wordmark + logo, white card, grey footer).
 * {{variable}} placeholders inside `body` are substituted at send time.
 *
 * Exported so every email sender (lead outbound, onboarding, quotations,
 * marketing, notifications) renders the same branded shell. When the site base
 * URL is available the header shows the real logo image; otherwise it falls
 * back to the MartPoint wordmark so it always looks intentional.
 */
export interface EmailFooterOptions {
  /** Social profile URLs keyed by network (facebook, instagram, x/twitter, linkedin, youtube, tiktok). */
  social?: Record<string, string | undefined>
  contactEmail?: string
  phone?: string
  whatsappNumber?: string
  companyName?: string
  website?: string
  address?: string
  /** Absolute URL of the footer banner image. Defaults to `<site>/footerbanner.png`. */
  bannerImageUrl?: string
}

/**
 * Social networks shown in the email footer. Rendered as brand-coloured
 * letter-mark "chips" — pure table/CSS markup with no external image, so they
 * render identically in every mail client (Gmail, Outlook, Apple Mail, etc.).
 */
const SOCIAL_META: Record<string, { label: string; color: string; mark: string; slug: string }> = {
  facebook: { label: "Facebook", color: "#1877F2", mark: "f", slug: "facebook" },
  instagram: { label: "Instagram", color: "#E4405F", mark: "ig", slug: "instagram" },
  twitter: { label: "X", color: "#111827", mark: "X", slug: "x" },
  linkedin: { label: "LinkedIn", color: "#0A66C2", mark: "in", slug: "linkedin" },
  youtube: { label: "YouTube", color: "#FF0000", mark: "▶", slug: "youtube" },
  tiktok: { label: "TikTok", color: "#111827", mark: "♪", slug: "tiktok" },
}

function buildEmailFooter(signoff: string, opts: EmailFooterOptions): { cardFooter: string; banner: string } {
  const year = new Date().getFullYear()
  const company = opts.companyName || "MartPoint"
  const website = (opts.website || "martpoint.com.ng").replace(/^https?:\/\//, "").replace(/\/$/, "")
  const email = (opts.contactEmail || "").trim()
  const phone = (opts.phone || "").trim()
  const whatsapp = (opts.whatsappNumber || "").trim()

  const social = Object.entries(opts.social || {})
    .filter(([key, url]) => url && (url as string).trim() && SOCIAL_META[key])
    .map(([key, url]) => ({ key, url: (url as string).trim(), ...SOCIAL_META[key] }))

  const socialRow = social.length
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 18px;">
        <tr>
          ${social
            .map(
              (s) => `<td style="padding:0 4px;" valign="middle">
                <a href="${escapeHtml(s.url)}" target="_blank" title="${escapeHtml(s.label)}" style="text-decoration:none;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                    <td width="34" height="34" align="center" valign="middle" style="width:34px; height:34px; border-radius:50%; background-color:${s.color}; color:#ffffff; font-family:Arial,Helvetica,sans-serif; font-size:14px; font-weight:700; line-height:34px; text-align:center;">${s.mark}</td>
                  </tr></table>
                </a>
              </td>`,
            )
            .join("")}
        </tr>
      </table>`
    : ""

  const contactBits: string[] = []
  if (email) contactBits.push(`<a href="mailto:${escapeHtml(email)}" style="color:#0057FF; text-decoration:none;">${escapeHtml(email)}</a>`)
  if (phone) contactBits.push(`<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}" style="color:#0057FF; text-decoration:none;">${escapeHtml(phone)}</a>`)
  if (whatsapp) {
    const digits = whatsapp.replace(/[^\d]/g, "")
    contactBits.push(`<a href="https://wa.me/${digits}" target="_blank" style="color:#0057FF; text-decoration:none;">WhatsApp</a>`)
  }
  const contactRow = contactBits.length
    ? `<p style="font-size:13px; color:#6b7280; margin:0 0 16px; line-height:1.7;">${contactBits.join(' &nbsp;&middot;&nbsp; ')}</p>`
    : ""

  const cardFooter = `
              <div style="padding:32px 40px 28px; background-color:#f9fafb; text-align:center; border-top:1px solid #e5e7eb;">
                <p style="font-size:13px; color:#6b7280; margin:0 0 28px; line-height:1.6;">Best regards,<br/><strong style="color:#111827; font-size:14px;">${escapeHtml(signoff)}</strong></p>
                ${socialRow}
                ${contactRow}
                <div style="border-top:1px solid #e5e7eb; margin-top:8px; padding-top:18px;">
                  <p style="font-size:12px; color:#9ca3af; margin:0 0 4px; line-height:1.6;">&copy; ${year} ${escapeHtml(company)}. All rights reserved.</p>
                  <p style="font-size:12px; color:#9ca3af; margin:0; line-height:1.6;">
                    <a href="https://${escapeHtml(website)}" style="color:#9ca3af; text-decoration:underline;">${escapeHtml(website)}</a>
                    &nbsp;&middot;&nbsp; Built in Africa for African businesses.
                  </p>
                </div>
              </div>`

  // Brand banner strip *after* (below) the card. Prefers the hosted MartPoint
  // banner image (`/footerbanner.png`); falls back to a styled blue bar with a
  // headline + CTA if the image is not configured. Centred within the column.
  const bannerImage =
    (opts.bannerImageUrl ?? `${(process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng").replace(/\/$/, "")}/footerbanner.png`).trim()
  const banner = bannerImage
    ? `
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:600px; width:100%; margin:20px auto 0;">
          <tr>
            <td align="center" style="text-align:center;">
              <a href="https://${escapeHtml(website)}" target="_blank" style="text-decoration:none; display:inline-block;">
                <img src="${escapeHtml(bannerImage)}" alt="MartPoint — ${escapeHtml(company)}" width="600" style="display:block; width:100%; max-width:600px; height:auto; margin:0 auto; border:0; border-radius:12px; outline:none; text-decoration:none;" />
              </a>
            </td>
          </tr>
        </table>`
    : `
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:600px; width:100%; margin:20px auto 0;">
          <tr>
            <td style="background-color:#0047CC; background-image:linear-gradient(135deg, #0057FF 0%, #003BB3 100%); border-radius:12px; padding:22px 32px; text-align:center;">
              <p style="color:#ffffff; font-size:15px; font-weight:700; margin:0 0 4px; letter-spacing:-0.2px;">${escapeHtml(company)} &mdash; The operating system for African retail</p>
              <p style="color:#DCE8FF; font-size:12px; margin:0 0 14px; line-height:1.6;">Sell smarter, manage stock, and delight your customers &mdash; all in one place.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="border-radius:8px; background-color:#ffffff;">
                    <a href="https://${escapeHtml(website)}" target="_blank" style="display:inline-block; padding:10px 24px; font-size:13px; font-weight:600; color:#0057FF; text-decoration:none; border-radius:8px;">Visit ${escapeHtml(website)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`

  return { cardFooter, banner }
}

/**
 * Default footer content for every branded email. Social profile URLs and
 * contact details come from env vars so nothing is hard-coded per caller:
 *   EMAIL_SOCIAL_FACEBOOK / INSTAGRAM / X / LINKEDIN / YOUTUBE / TIKTOK
 *   EMAIL_CONTACT_EMAIL / EMAIL_PHONE / EMAIL_WEBSITE / EMAIL_COMPANY_ADDRESS
 * Falls back to the known MartPoint profiles when unset.
 */
export function defaultEmailFooter(): EmailFooterOptions {
  const env = (k: string, fallback = "") => (process.env[k] || fallback).trim()
  const website = env("EMAIL_WEBSITE", "https://martpoint.com.ng")
  return {
    social: {
      facebook: env("EMAIL_SOCIAL_FACEBOOK", "https://facebook.com/usemartpoint"),
      instagram: env("EMAIL_SOCIAL_INSTAGRAM", "https://instagram.com/usemartpoint"),
      twitter: env("EMAIL_SOCIAL_X", "https://x.com/usemartpoint"),
      linkedin: env("EMAIL_SOCIAL_LINKEDIN", "https://www.linkedin.com/company/usemartpoint"),
      youtube: env("EMAIL_SOCIAL_YOUTUBE", "https://www.youtube.com/@usemartpoint"),
      tiktok: env("EMAIL_SOCIAL_TIKTOK", "https://www.tiktok.com/@usemartpoint"),
    },
    contactEmail: env("EMAIL_CONTACT_EMAIL", "sales@martpoint.com.ng"),
    phone: env("EMAIL_PHONE", "+234 701 042 6993"),
    whatsappNumber: env("EMAIL_WHATSAPP", "+2348037978230"),
    companyName: env("EMAIL_COMPANY_NAME", "MartPoint Solutions"),
    website,
    address: env("EMAIL_COMPANY_ADDRESS"),
  }
}

export function brandedEmailHtml(
  body: string,
  opts: {
    eyebrow?: string
    title?: string
    signoff?: string
    logoUrl?: string
    logoWhiteUrl?: string | null
    preheader?: string
    footer?: EmailFooterOptions
  } = {}
): string {
  const eyebrow = opts.eyebrow || "MartPoint"
  const title = opts.title || "MartPoint"
  const signoff = opts.signoff || "MartPoint Team"
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(opts.preheader)}${"&zwnj;&nbsp;".repeat(20)}</div>`
    : ""

  // The header sits on a dark blue gradient, so it needs a WHITE (or
  // white-on-transparent) logo — a coloured logo looks broken here. We use the
  // white logo asset when available; otherwise we fall back to a crisp white
  // "MartPoint" wordmark, which always looks right.
  // `logoWhiteUrl: null` explicitly falls back to the wordmark; a string (or
  // the configured default) renders the white logo image.
  const whiteLogo = opts.logoWhiteUrl === null ? "" : (opts.logoWhiteUrl ?? getEmailWhiteLogoUrl() ?? "").trim()
  const headerMark = whiteLogo
    ? `<img src="${whiteLogo}" alt="MartPoint" width="126" height="36" style="width:126px; height:36px; display:inline-block; margin:0 auto; border:0; outline:none; text-decoration:none;" />`
    : `<div style="color:#ffffff; font-size:26px; font-weight:700; letter-spacing:-0.5px; line-height:1;">MartPoint</div>`

  const { cardFooter, banner } = buildEmailFooter(signoff, opts.footer || defaultEmailFooter())

  return `${preheader}<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f6f7; padding:40px 0;">
    <tr>
      <td align="center" style="padding:0 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); max-width:600px; width:100%;">
          <tr>
            <td style="padding:40px 40px 28px; text-align:center; background-color:#0057FF; background-image:linear-gradient(135deg, #0057FF 0%, #003BB3 100%);">
              ${headerMark}
              <div style="color:#E0EAFF; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-top:12px;">${escapeHtml(eyebrow)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 48px;">
${body}
            </td>
          </tr>
          ${cardFooter}
        </table>
        ${banner}
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Absolute URL of the WHITE MartPoint logo for dark backgrounds (email headers).
 * Defaults to `/logo-white.png` on the site (the white logo asset in `public/`).
 * Override with `EMAIL_LOGO_WHITE_URL` if the asset moves or is hosted on a CDN.
 */
export function getEmailWhiteLogoUrl(): string | undefined {
  const configured = (process.env.EMAIL_LOGO_WHITE_URL || "").trim()
  if (configured) return configured
  return `${(process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng").replace(/\/$/, "")}/logo-white.png`
}

/**
 * Guarantee an outbound HTML email renders inside the branded MartPoint shell.
 * - Full documents (a real <!DOCTYPE/ <html>) are assumed to be already
 *   branded and pass through untouched — except legacy hand-rolled shells that
 *   lack the MartPoint header, which we re-wrap.
 * - Fragments and plain text are wrapped in the branded shell so no email can
 *   ever go out looking unbranded.
 */
export function ensureBrandedHtml(
  html: string | undefined,
  opts: { eyebrow?: string; title?: string; signoff?: string; text?: string; logoWhiteUrl?: string | null; footer?: EmailFooterOptions } = {}
): string {
  const isFullDoc = /<!DOCTYPE|<html[\s>]/i.test(html || "")
  // A branded email always contains the MartPoint gradient header (with or
  // without the white logo image) and the branded footer tagline.
  const alreadyBranded =
    /linear-gradient\(135deg,\s*#0057FF/i.test(html || "") ||
    /MartPoint &middot; martpoint\.com\.ng/i.test(html || "")

  if (html && isFullDoc && alreadyBranded) return html

  // Unwrap a full doc's <body> contents so we can re-house it in the branded shell.
  let inner = html || ""
  if (isFullDoc) {
    const bodyMatch = inner.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    inner = bodyMatch ? bodyMatch[1] : inner.replace(/<!DOCTYPE[^>]*>/i, "").replace(/<\/?html[^>]*>/gi, "").replace(/<head[\s\S]*?<\/head>/i, "")
  } else if (!inner) {
    inner = escapeHtml(opts.text || "").replace(/\n/g, "<br/>")
  }

  return brandedEmailHtml(inner.trim(), opts)
}

export const EMAIL_TEMPLATES: TemplateDefinition[] = [
  {
    key: "partner_application_received",
    label: "Application Received (applicant)",
    description: "Sent to the applicant right after they submit a partner application.",
    variables: ["fullName", "reference", "statusUrl"],
    subject: "MartPoint Partner Application Received — {{reference}}",
    text: `Hi {{fullName}},

Thank you for applying to become a MartPoint partner. Your application has been received.

Application Reference: {{reference}}

You can check your application status anytime at:
{{statusUrl}}

You will need your application reference and the email used to apply.

Best regards,
MartPoint Partner Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Thank you for applying to become a MartPoint partner. Your application has been received and is now being reviewed by our team.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Application reference</p>
                    <p style="font-size:17px; font-weight:700; color:#111827; margin:0; letter-spacing:0.5px;">{{reference}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{statusUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Track Your Application</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0 0 16px; color:#6b7280; word-break:break-all;">
                Or copy and paste this link into your browser:<br />
                <a href="{{statusUrl}}" style="color:#0057FF; text-decoration:underline;">{{statusUrl}}</a>
              </p>
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280;">
                You will need your application reference and the email used to apply.
              </p>`,
      { title: "Application received" }
    ),
  },
  {
    key: "partner_application_admin",
    label: "Application Received (internal copy)",
    description: "Notification to the team when a new partner application arrives.",
    variables: ["fullName", "reference", "email"],
    subject: "New Partner Application — {{reference}}",
    text: `A new partner application was submitted.

Reference: {{reference}}
Applicant: {{fullName}}
Email: {{email}}

Review it in the Control Centre.`,
  },
  {
    key: "application_status_change",
    label: "Application Status Update",
    description: "Sent to the applicant whenever the application status changes.",
    variables: ["fullName", "reference", "statusLabel", "statusPill", "previousLabel", "previousLabelBlock", "previousLabelHtmlBlock", "message", "messageBlock", "messageHtmlBlock", "statusUrl"],
    subject: "MartPoint Partner Application Update — {{reference}}",
    text: `Hi {{fullName}},

Your MartPoint partner application (Reference: {{reference}}) has been updated.

Current status: {{statusLabel}}{{previousLabelBlock}}{{messageBlock}}

You can view the latest status and any required actions at:
{{statusUrl}}

Best regards,
MartPoint Partner Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Your MartPoint partner application <strong>{{reference}}</strong> has been updated.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#6b7280; margin:0 0 10px;">Current status</p>
                    {{statusPill}}
                    {{previousLabelHtmlBlock}}
                  </td>
                </tr>
              </table>
              {{messageHtmlBlock}}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{statusUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">View Application Status</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280; word-break:break-all;">
                Or copy and paste this link into your browser:<br />
                <a href="{{statusUrl}}" style="color:#0057FF; text-decoration:underline;">{{statusUrl}}</a>
              </p>`,
      { title: "Application status update" }
    ),
  },
  {
    key: "compliance_doc_request",
    label: "Compliance Document Request",
    description: "One-time upload link emailed when admin requests a compliance document.",
    variables: ["fullName", "reference", "docType", "uploadUrl"],
    subject: "Action required: submit your {{docType}} for MartPoint partner application {{reference}}",
    text: `Hi {{fullName}},

Thank you for your interest in partnering with MartPoint. Before we can proceed, please submit the following compliance document:

Document: {{docType}}
Application reference: {{reference}}

Upload here (one-time link, expires in 7 days):
{{uploadUrl}}

Once submitted, this link will become invalid. If you need to submit a revised document, the MartPoint team will send you a new link.

Best regards,
MartPoint Partner Team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Submit your {{docType}}</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f6f7; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); max-width:600px; width:100%;">
          <tr>
            <td style="padding:48px 40px 32px; text-align:center; background:linear-gradient(135deg, #0057FF 0%, #003BB3 100%);">
              <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">MartPoint</div>
              <div style="color:#E0EAFF; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-top:6px;">Partner Programme</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Thank you for your interest in partnering with MartPoint. Before we can proceed, please submit the following compliance document.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Document requested</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{docType}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:12px 0 4px;">Application reference</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{reference}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{uploadUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Upload {{docType}}</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0 0 24px; color:#6b7280; word-break:break-all;">
                Or copy and paste this one-time link into your browser (expires in 7 days):<br />
                <a href="{{uploadUrl}}" style="color:#0057FF; text-decoration:underline;">{{uploadUrl}}</a>
              </p>
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280;">
                Once submitted, this link will become invalid. If you need to submit a revised document, the MartPoint team will send you a new link.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px; background-color:#f9fafb; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="font-size:12px; color:#6b7280; margin:0;">Best regards,<br/><strong>MartPoint Partner Team</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    key: "compliance_docs_request",
    label: "Compliance Documents Request",
    description: "One branded email with all upload links when admin requests compliance documents.",
    variables: ["fullName", "reference", "documentsTextBlock", "documentsBlock"],
    subject: "Action required: submit your compliance documents for MartPoint partner application {{reference}}",
    text: `Hi {{fullName}},

Thank you for your interest in partnering with MartPoint. Before we can proceed, please submit the following compliance documents:

{{documentsTextBlock}}

Application reference: {{reference}}

Each link is one-time and expires in 7 days. Once a document is submitted, that link will become invalid.

Best regards,
MartPoint Partner Team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Submit your compliance documents</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f6f7; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); max-width:600px; width:100%;">
          <tr>
            <td style="padding:48px 40px 32px; text-align:center; background:linear-gradient(135deg, #0057FF 0%, #003BB3 100%);">
              <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">MartPoint</div>
              <div style="color:#E0EAFF; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-top:6px;">Partner Programme</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Thank you for your interest in partnering with MartPoint. Before we can proceed, please submit the following compliance documents.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Application reference</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{reference}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                {{documentsBlock}}
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280;">
                Each button above is a one-time link and expires in 7 days. Once a document is submitted, that link becomes invalid.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px; background-color:#f9fafb; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="font-size:12px; color:#6b7280; margin:0;">Best regards,<br/><strong>MartPoint Partner Team</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    key: "compliance_doc_reminder",
    label: "Compliance Document Reminder",
    description: "New one-time upload link when admin resends a document request.",
    variables: ["fullName", "reference", "docType", "uploadUrl"],
    subject: "Reminder: submit your {{docType}} for MartPoint partner application {{reference}}",
    text: `Hi {{fullName}},

Please submit the following document using this one-time upload link:

Document: {{docType}}
Upload link (expires in 7 days):
{{uploadUrl}}

Best regards,
MartPoint Partner Team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reminder: submit your {{docType}}</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f6f7; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); max-width:600px; width:100%;">
          <tr>
            <td style="padding:48px 40px 32px; text-align:center; background:linear-gradient(135deg, #0057FF 0%, #003BB3 100%);">
              <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">MartPoint</div>
              <div style="color:#E0EAFF; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-top:6px;">Partner Programme</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Please submit the following document using this one-time upload link.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Document</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{docType}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:12px 0 4px;">Application reference</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{reference}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{uploadUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Upload {{docType}}</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280; word-break:break-all;">
                Or copy and paste this link (expires in 7 days):<br />
                <a href="{{uploadUrl}}" style="color:#0057FF; text-decoration:underline;">{{uploadUrl}}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px; background-color:#f9fafb; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="font-size:12px; color:#6b7280; margin:0;">Best regards,<br/><strong>MartPoint Partner Team</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    key: "compliance_doc_submitted",
    label: "Compliance Document Submitted",
    description: "Sent to the applicant after they successfully submit a compliance document.",
    variables: ["fullName", "reference", "docType"],
    subject: "MartPoint received your {{docType}} for application {{reference}}",
    text: `Hi {{fullName}},

We have received your {{docType}} for application {{reference}}.

Our team will review it and get back to you if anything else is needed.

Best regards,
MartPoint Partner Team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document received</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f6f7; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); max-width:600px; width:100%;">
          <tr>
            <td style="padding:48px 40px 32px; text-align:center; background:linear-gradient(135deg, #0057FF 0%, #003BB3 100%);">
              <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">MartPoint</div>
              <div style="color:#E0EAFF; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-top:6px;">Partner Programme</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                We have received your <strong>{{docType}}</strong> for application <strong>{{reference}}</strong>.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                Our team will review it and contact you if anything else is needed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px; background-color:#f9fafb; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="font-size:12px; color:#6b7280; margin:0;">Best regards,<br/><strong>MartPoint Partner Team</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    key: "compliance_doc_status_update",
    label: "Compliance Document Status Update",
    description: "Sent to the applicant when an admin reviews a compliance document.",
    variables: ["fullName", "reference", "docType", "statusLabel", "notesTextBlock", "notesHtmlBlock"],
    subject: "Update on your {{docType}} for MartPoint partner application {{reference}}",
    text: `Hi {{fullName}},

Your {{docType}} for application {{reference}} has been updated.

Status: {{statusLabel}}{{notesTextBlock}}

Best regards,
MartPoint Partner Team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document status update</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f6f7; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); max-width:600px; width:100%;">
          <tr>
            <td style="padding:48px 40px 32px; text-align:center; background:linear-gradient(135deg, #0057FF 0%, #003BB3 100%);">
              <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">MartPoint</div>
              <div style="color:#E0EAFF; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-top:6px;">Partner Programme</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Your <strong>{{docType}}</strong> for application <strong>{{reference}}</strong> has been reviewed.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Status</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{statusLabel}}</p>
                    {{notesHtmlBlock}}
                  </td>
                </tr>
              </table>
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                We will contact you if anything else is needed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px; background-color:#f9fafb; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="font-size:12px; color:#6b7280; margin:0;">Best regards,<br/><strong>MartPoint Partner Team</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    key: "partner_user_invite",
    label: "Partner Portal Invitation",
    description: "Sent when a partner user is invited to the partner portal.",
    variables: ["fullName", "businessName", "link"],
    subject: "Invitation to join the MartPoint Partner Portal",
    text: `Hi {{fullName}},

You have been invited to join the MartPoint Partner Portal for {{businessName}}.

Click the link below to accept your invitation and set your password. This link expires in 7 days and can only be used once.

{{link}}

Welcome,
MartPoint Partner Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                You have been invited to join the <strong>MartPoint Partner Portal</strong> for <strong>{{businessName}}</strong>.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 32px; color:#374151;">
                Accept your invitation and set your password to get started.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{link}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0 0 16px; color:#6b7280; word-break:break-all;">
                Or copy and paste this link into your browser:<br />
                <a href="{{link}}" style="color:#0057FF; text-decoration:underline;">{{link}}</a>
              </p>
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280;">
                This link expires in 7 days and can only be used once.
              </p>`,
      { title: "Partner Portal invitation" }
    ),
  },
  {
    key: "partner_user_invite_resent",
    label: "Partner Portal Invitation (resend)",
    description: "Sent when a partner portal invitation link is re-issued.",
    variables: ["fullName", "businessName", "link"],
    subject: "Your MartPoint Partner Portal invitation",
    text: `Hi {{fullName}},

Here is your new invitation link to join the MartPoint Partner Portal for {{businessName}}.

{{link}}

This link expires in 7 days and can only be used once.

MartPoint Partner Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 32px; color:#374151;">
                Here is your new invitation link to join the <strong>MartPoint Partner Portal</strong> for <strong>{{businessName}}</strong>.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{link}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0 0 16px; color:#6b7280; word-break:break-all;">
                Or copy and paste this link into your browser:<br />
                <a href="{{link}}" style="color:#0057FF; text-decoration:underline;">{{link}}</a>
              </p>
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280;">
                This link expires in 7 days and can only be used once.
              </p>`,
      { title: "Partner Portal invitation" }
    ),
  },
  {
    key: "partner_password_reset",
    label: "Partner Password Reset",
    description: "Password-reset link for partner portal users.",
    variables: ["fullName", "link"],
    subject: "Reset your MartPoint Partner Portal password",
    text: `Hi {{fullName}},

You requested a password reset for your MartPoint Partner Portal account.

Click the link below to set a new password. This link expires in 1 hour and can only be used once.

{{link}}

If you did not request this, please ignore this email.

MartPoint Partner Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 32px; color:#374151;">
                We received a request to reset the password for your MartPoint Partner Portal account.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{link}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0 0 16px; color:#6b7280; word-break:break-all;">
                Or copy and paste this link into your browser:<br />
                <a href="{{link}}" style="color:#0057FF; text-decoration:underline;">{{link}}</a>
              </p>
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280;">
                This link expires in 1 hour and can only be used once. If you did not request this, you can ignore this email — your password will stay the same.
              </p>`,
      { title: "Reset your password" }
    ),
  },
  {
    key: "partner_lead_invite",
    label: "Partner Lead — Invite to Apply",
    description: "Sent when an admin invites a partner lead or prospect to complete the partner application form.",
    variables: ["contactName", "businessName", "inviteLink"],
    subject: "Let's grow together — your MartPoint Partner invitation",
    text: `Hi {{contactName}},

Thank you for your interest in partnering with MartPoint. We help ambitious businesses across Africa sell smarter, manage inventory, and delight their customers — and we're building a partner ecosystem to make that impact even bigger.

We'd love to invite you to formally apply to the MartPoint Partner Program. We have pre-filled some of the information you shared with us, so the application should only take a few minutes.

Complete your application here:
{{inviteLink}}

If you have any questions before applying, simply reply to this email and our Partner Team will be happy to help.

Looking forward to building something great together.

Warm regards,
The MartPoint Partner Team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your MartPoint Partner invitation</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f6f7; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); max-width:600px; width:100%;">
          <tr>
            <td style="padding:48px 40px 32px; text-align:center; background:linear-gradient(135deg, #0057FF 0%, #003BB3 100%);">
              <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">MartPoint</div>
              <div style="color:#E0EAFF; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-top:6px;">Partner Programme</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{contactName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Thank you for your interest in partnering with MartPoint. We help ambitious businesses across Africa sell smarter, manage inventory, and delight their customers — and we're growing a partner ecosystem to make that impact even bigger.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 32px; color:#374151;">
                We'd love to invite you to formally apply to the <strong>MartPoint Partner Program</strong>. We've pre-filled some of the details you shared, so the application should only take a few minutes.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{inviteLink}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Complete Your Application</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0 0 24px; color:#6b7280; word-break:break-all;">
                Or copy and paste this link into your browser:<br />
                <a href="{{inviteLink}}" style="color:#0057FF; text-decoration:underline;">{{inviteLink}}</a>
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 8px; color:#374151;">
                If you have any questions before applying, simply reply to this email — our Partner Team will be happy to help.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                Looking forward to building something great together.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px; background-color:#f9fafb; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="font-size:12px; color:#6b7280; margin:0;">Warm regards,<br/><strong>The MartPoint Partner Team</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    key: "lead_submission",
    label: "New Website Lead (internal)",
    description: "Internal notification when a public lead form is submitted. Recipient is controlled by the lead_submission email route.",
    variables: ["fullName", "businessName", "email", "phone", "productInterest", "branches", "staffSize", "challenge", "message", "source", "referringPartnerBlock"],
    subject: "New Lead: {{fullName}} — {{businessName}}",
    text: `New lead submitted via {{source}}{{referringPartnerBlock}}

Name: {{fullName}}
Business: {{businessName}}
Email: {{email}}
Phone: {{phone}}
Product: {{productInterest}}
Branches: {{branches}}
Staff: {{staffSize}}

Challenge: {{challenge}}
Message: {{message}}`,
  },
  {
    key: "estimate_submission",
    label: "Cost Estimator Submission (internal)",
    description: "Internal notification when a visitor completes the cost estimator. Recipient is controlled by the estimate_submission email route.",
    variables: ["fullName", "businessName", "email", "phone", "businessType", "country", "branches", "staffSize", "productCount", "productOrService", "onlineStore", "hardwareAvailable", "receiptHardware", "dataMigration", "offlineOperation", "erpInterest", "trainingPreference", "retailPlan", "retailRange", "retailTier", "erpBlock", "notes"],
    subject: "New Estimate Request: {{fullName}} — {{businessName}}",
    text: `New estimate request from the Cost Estimator.

CONTACT
Name: {{fullName}}
Business: {{businessName}}
Email: {{email}}
Phone: {{phone}}

BUSINESS PROFILE
Type: {{businessType}}
Country: {{country}}
Branches: {{branches}}
Staff: {{staffSize}}
Products/Services: {{productCount}} ({{productOrService}})

REQUIREMENTS
Online store: {{onlineStore}}
Hardware available: {{hardwareAvailable}}
Receipt printer/scanner: {{receiptHardware}}
Data migration: {{dataMigration}}
Offline operation: {{offlineOperation}}
ERP interest: {{erpInterest}}
Training: {{trainingPreference}}

RECOMMENDED PLAN
{{retailPlan}} ({{retailTier}}) — {{retailRange}}
{{erpBlock}}
Notes: {{notes}}

Review and follow up via the Leads dashboard.`,
  },
  {
    key: "career_application",
    label: "Career Application (internal)",
    description: "Notification for a new job application. The CV is attached to the email. Recipient is controlled by the career_application email route.",
    variables: ["fullName", "email", "phone", "linkedin"],
    subject: "New Career Application: {{fullName}}",
    text: `New career application received.

Full Name: {{fullName}}
Email: {{email}}
Phone: {{phone}}
LinkedIn: {{linkedin}}

Reply to this candidate at {{email}}.`,
  },
  {
    key: "payout_request_admin",
    label: "Partner Payout Request (internal)",
    description: "Notification to the finance team when a partner requests a withdrawal.",
    variables: ["partnerId", "amount", "notes"],
    subject: "Partner payout request — ₦{{amount}}",
    text: `A partner has requested a commission payout.

Partner: {{partnerId}}
Amount: ₦{{amount}}
Notes: {{notes}}

Review it in the Control Centre under Partners → Payout Requests.`,
  },
  {
    key: "payout_approved",
    label: "Payout Request Approved",
    description: "Sent to the partner user when a withdrawal request is approved.",
    variables: ["fullName", "amount", "payoutReference"],
    subject: "Your MartPoint payout request was approved",
    text: `Hi {{fullName}},

Your payout request for ₦{{amount}} has been approved and scheduled for payment (reference {{payoutReference}}).

MartPoint Partner Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Good news — your payout request has been approved and scheduled for payment.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Amount</p>
                    <p style="font-size:17px; font-weight:700; color:#111827; margin:0;">₦{{amount}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:12px 0 4px;">Payout reference</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{payoutReference}}</p>
                  </td>
                </tr>
              </table>`,
      { title: "Payout approved" }
    ),
  },
  {
    key: "payout_rejected",
    label: "Payout Request Declined",
    description: "Sent to the partner user when a withdrawal request is rejected.",
    variables: ["fullName", "amount", "reasonBlock", "reasonHtmlBlock"],
    subject: "Your MartPoint payout request was declined",
    text: `Hi {{fullName}},

Your payout request for ₦{{amount}} was declined.{{reasonBlock}}

Contact your partner manager if you have questions.

MartPoint Partner Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Your payout request for <strong>₦{{amount}}</strong> was declined.
              </p>
              {{reasonHtmlBlock}}
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                Contact your partner manager if you have questions.
              </p>`,
      { title: "Payout declined" }
    ),
  },
  {
    key: "partner_status_change",
    label: "Partner Account Status Update",
    description: "Sent to partner portal users whenever the partner account status changes (e.g. suspended, reactivated, terminated).",
    variables: ["fullName", "businessName", "statusLabel", "statusPill", "previousLabel", "previousLabelBlock", "previousLabelHtmlBlock", "message", "messageBlock", "messageHtmlBlock", "portalUrl"],
    subject: "MartPoint Partner Account Update — {{businessName}}",
    text: `Hi {{fullName}},

The status of your MartPoint partner account ({{businessName}}) has been updated.

Current status: {{statusLabel}}{{previousLabelBlock}}{{messageBlock}}

You can sign in to the Partner Portal at:
{{portalUrl}}

Best regards,
MartPoint Partner Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                The status of your MartPoint partner account (<strong>{{businessName}}</strong>) has been updated.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#6b7280; margin:0 0 10px;">Current status</p>
                    {{statusPill}}
                    {{previousLabelHtmlBlock}}
                  </td>
                </tr>
              </table>
              {{messageHtmlBlock}}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{portalUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Sign in to Partner Portal</a>
                  </td>
                </tr>
              </table>`,
      { title: "Partner account update" }
    ),
  },
  {
    key: "partner_user_status_change",
    label: "Partner Portal Access Update",
    description: "Sent to a partner portal user when their access status changes (e.g. suspended, re-enabled).",
    variables: ["fullName", "businessName", "statusLabel", "statusPill", "portalUrl"],
    subject: "Your MartPoint Partner Portal access — {{businessName}}",
    text: `Hi {{fullName}},

Your access to the MartPoint Partner Portal for {{businessName}} has been updated.

Status: {{statusLabel}}

{{portalUrl}}

MartPoint Partner Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Your access to the MartPoint Partner Portal for <strong>{{businessName}}</strong> has been updated.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#6b7280; margin:0 0 10px;">Account status</p>
                    {{statusPill}}
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{portalUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Sign in to Partner Portal</a>
                  </td>
                </tr>
              </table>`,
      { title: "Partner Portal access update" }
    ),
  },
  {
    key: "onboarding_welcome",
    label: "Onboarding Welcome",
    description: "Sent when an onboarding record is created. Note: a custom message entered in the admin UI overrides this body.",
    variables: ["fullName", "setupQuestions", "formLink"],
    subject: "Welcome to MartPoint — Action Required: Setup Your Account",
    text: `Hi {{fullName}},

Welcome to MartPoint! To get your system up and running, we need a few critical details.

{{setupQuestions}}

Complete your onboarding form:
{{formLink}}

Best regards,
MartPoint Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px;font-weight:600;margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#374151;">
                Welcome to MartPoint! To get your system up and running, we need a few critical details.
              </p>
              <div style="font-size:15px;line-height:1.6;color:#374151;background-color:#f9fafb;border-radius:8px;padding:16px;margin:0 0 24px;white-space:pre-line;">{{setupQuestions}}</div>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr><td style="border-radius:8px;background-color:#0057FF;text-align:center;"><a href="{{formLink}}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Complete Onboarding Form</a></td></tr>
              </table>
              <p style="font-size:13px;line-height:1.5;margin:0;color:#6b7280;word-break:break-all;">Or copy and paste this link: <a href="{{formLink}}" style="color:#0057FF;text-decoration:underline;">{{formLink}}</a></p>`,
      { eyebrow: "Onboarding", title: "Welcome to MartPoint", signoff: "MartPoint Team" }
    ),
  },
  {
    key: "onboarding_invoice",
    label: "Onboarding Invoice",
    description: "Invoice email for onboarding customers. Note: a custom message entered in the admin UI overrides this body.",
    variables: ["fullName", "businessName", "description", "amount", "tax", "total", "dueDate", "formLink"],
    subject: "Your MartPoint Invoice — {{businessName}}",
    text: `Hi {{fullName}},

Thank you for choosing MartPoint. Please find your invoice below:

Description: {{description}}
Amount: ₦{{amount}}
Tax: ₦{{tax}}
Total Due: ₦{{total}}
Due Date: {{dueDate}}

You can complete your onboarding here: {{formLink}}

Best regards,
MartPoint Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px;font-weight:600;margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#374151;">Thank you for choosing MartPoint. Please find your invoice below.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb;border-radius:8px;margin:0 0 24px;">
                <tr><td style="padding:16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr><td style="font-size:14px;color:#6b7280;padding-bottom:6px;">Description</td><td align="right" style="font-size:15px;color:#111827;padding-bottom:6px;">{{description}}</td></tr>
                    <tr><td style="font-size:14px;color:#6b7280;padding-bottom:6px;">Amount</td><td align="right" style="font-size:15px;color:#111827;padding-bottom:6px;">₦{{amount}}</td></tr>
                    <tr><td style="font-size:14px;color:#6b7280;padding-bottom:6px;">Tax</td><td align="right" style="font-size:15px;color:#111827;padding-bottom:6px;">₦{{tax}}</td></tr>
                    <tr><td style="font-size:14px;color:#6b7280;padding-bottom:6px;">Due date</td><td align="right" style="font-size:15px;color:#111827;padding-bottom:6px;">{{dueDate}}</td></tr>
                  </table>
                  <div style="border-top:1px solid #e5e7eb;margin-top:12px;padding-top:12px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="font-size:14px;color:#6b7280;">Total due</td><td align="right" style="font-size:20px;font-weight:700;color:#0057FF;">₦{{total}}</td></tr></table>
                  </div>
                </td></tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr><td style="border-radius:8px;background-color:#0057FF;text-align:center;"><a href="{{formLink}}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Complete Onboarding</a></td></tr>
              </table>`,
      { eyebrow: "Billing", title: "Your MartPoint Invoice", signoff: "MartPoint Team" }
    ),
  },
  {
    key: "onboarding_access",
    label: "Onboarding Access Details",
    description: "Sent after deployment to share the client's software URL, admin credentials and support information. Note: a custom message entered in the admin UI overrides this body.",
    variables: ["fullName", "businessName", "productLabel", "softwareUrl", "adminUsername", "tempPassword", "onlineStoreBlock", "supportGroupBlock", "supportContact", "trainingSchedule"],
    subject: "Welcome to MartPoint — Your Access Details ({{businessName}})",
    text: `Hi {{fullName}},

Welcome to MartPoint! We're pleased to confirm that your MartPoint {{productLabel}} system is ready.

Your MartPoint Access Details

Software URL: {{softwareUrl}}
Admin Username/Email: {{adminUsername}}
Temporary Password: {{tempPassword}}

For security, please change the temporary password after your first login and do not share your login credentials with anyone who is not authorised to access your business account.

{{onlineStoreBlock}}Your training session will be arranged according to the agreed schedule, and our team will guide you through the system, your initial setup and the key features your team will be using.

{{supportGroupBlock}}Support Hours
Monday–Friday: 9:00 a.m.–5:00 p.m.
Time Zone: West Africa Time (WAT)

Messages received outside these hours will be attended to on the next business day.

What Standard MartPoint Support Covers

Your MartPoint licence and standard support cover the MartPoint Retail software and assistance with using the system.

Hardware, computers, printers, internet connections, power supply, data entry, third-party applications and services outside the MartPoint software are not covered under standard support.

Online Store & Marketing Services

Please note that Online Store services and Marketing services are not included in the standard MartPoint licence fee.

These are optional add-on services that can be requested separately depending on your business needs. This may include online store setup or customisation, product uploads, marketing campaigns, and other related digital services. Where required, the scope and cost will be provided separately before any additional service begins.

When reporting an issue, please include a clear description together with a screenshot or short screen recording where possible.

For security, please do not share passwords, payment information or sensitive customer information in the support group or over email.

Your MartPoint Support Contact: {{supportContact}}
Training Date & Time: {{trainingSchedule}}

Our commitment does not end with providing the software. We will guide your team through onboarding and continue to support the proper use of MartPoint so your business can operate confidently.

We appreciate your patronage.

Best regards,
MartPoint Team`,
  },
  {
    key: "partner_installation_handover",
    label: "Partner Installation Handover",
    description: "Sent by an implementation partner to a client after installing and setting up their MartPoint store — shares the store URL and the login created during installation. Installation guides can be attached. Note: a custom message entered in the portal overrides this body.",
    variables: ["contactName", "businessName", "partnerName", "softwareUrl", "adminUsername", "tempPassword", "messageBlock", "supportBlock"],
    subject: "Your MartPoint store is ready — {{businessName}}",
    text: `Hi {{contactName}},

Great news — {{partnerName}}, a certified MartPoint implementation partner, has finished installing and setting up MartPoint for {{businessName}}.

Your Access Details

Store / Login URL: {{softwareUrl}}
Admin Username/Email: {{adminUsername}}
Temporary Password: {{tempPassword}}

For security, please sign in and change this temporary password as soon as possible, and do not share your login credentials with anyone who is not authorised to access your business account.

{{messageBlock}}If an installation guide is attached to this email, please keep it handy — it walks you through the essentials of running your new store.

{{supportBlock}}We appreciate your patronage.

Best regards,
{{partnerName}}
MartPoint Partner`,
    html: brandedEmailHtml(
      `<p style="font-size:18px;font-weight:600;margin:0 0 16px;">Hi {{contactName}},</p>
              <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#374151;">
                Great news — <strong>{{partnerName}}</strong>, a certified MartPoint implementation partner, has finished installing and setting up MartPoint for <strong>{{businessName}}</strong>.
              </p>
              <p style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin:0 0 12px;">Your access details</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb;border-radius:8px;margin:0 0 24px;">
                <tr><td style="padding:16px;">
                  <p style="font-size:14px;color:#6b7280;margin:0 0 4px;">Store / Login URL</p>
                  <p style="font-size:15px;font-weight:600;color:#0057FF;margin:0 0 12px;word-break:break-all;">{{softwareUrl}}</p>
                  <p style="font-size:14px;color:#6b7280;margin:0 0 4px;">Admin Username / Email</p>
                  <p style="font-size:15px;font-weight:600;color:#111827;margin:0 0 12px;">{{adminUsername}}</p>
                  <p style="font-size:14px;color:#6b7280;margin:0 0 4px;">Temporary Password</p>
                  <p style="font-size:15px;font-weight:600;color:#111827;margin:0;">{{tempPassword}}</p>
                </td></tr>
              </table>
              <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px;">For security, please sign in and change this temporary password as soon as possible, and do not share your login credentials with anyone who is not authorised to access your business account.</p>
              <div style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px;">{{messageBlock}}</div>
              <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px;">If an installation guide is attached to this email, please keep it handy — it walks you through the essentials of running your new store.</p>
              <div style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px;">{{supportBlock}}</div>
              <p style="font-size:14px;line-height:1.6;color:#374151;margin:0;">We appreciate your patronage.</p>`,
      { eyebrow: "Partner Programme", title: "Your store is ready", signoff: "{{partnerName}} · MartPoint Partner" }
    ),
  },
  {
    key: "support_magic_link",
    label: "Support Sign-in Link",
    description: "Magic-link email for the customer support portal.",
    variables: ["contactName", "businessName", "link"],
    subject: "Your MartPoint Support sign-in link",
    text: `Hi {{contactName}},

Click the link below to sign in to the MartPoint customer support portal for {{businessName}}:

{{link}}

This link expires in 15 minutes and can only be used from this device.
If you did not request this link, you can ignore this email.`,
    html: brandedEmailHtml(
      `<p style="font-size:18px;font-weight:600;margin:0 0 16px;">Hi {{contactName}},</p>
              <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#374151;">Click the button below to sign in to the MartPoint customer support portal for <strong>{{businessName}}</strong>.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr><td style="border-radius:8px;background-color:#0057FF;text-align:center;"><a href="{{link}}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Sign in to Support</a></td></tr>
              </table>
              <p style="font-size:13px;line-height:1.5;margin:0 0 16px;color:#6b7280;word-break:break-all;">Or copy and paste this link: <a href="{{link}}" style="color:#0057FF;text-decoration:underline;">{{link}}</a></p>
              <p style="font-size:13px;line-height:1.5;margin:0;color:#6b7280;">This link expires in 15 minutes and can only be used from this device. If you did not request this link, you can ignore this email.</p>`,
      { eyebrow: "Support", title: "Your sign-in link", signoff: "MartPoint Support" }
    ),
  },
  {
    key: "quotation_subject",
    label: "Quotation Email — Subject",
    description: "Subject line for quotation emails (the quotation body is generated from the quote line items).",
    variables: ["quoteNumber", "titleBlock"],
    subject: "Quotation {{quoteNumber}}{{titleBlock}} from MartPoint",
    text: "",
  },
  {
    key: "quotation_revised_subject",
    label: "Revised Quotation Email — Subject",
    description: "Subject line for the email sent to a lead when their change request is approved and a revised quote is issued.",
    variables: ["quoteNumber", "titleBlock"],
    subject: "Revised Quotation {{quoteNumber}}{{titleBlock}} from MartPoint",
    text: "",
  },
  {
    key: "quotation_revised",
    label: "Revised Quotation (client)",
    description: "Sent to a lead when admin approves their change request and issues a revised quotation.",
    variables: ["fullName", "quoteNumber", "publicUrl"],
    subject: "Your MartPoint quotation has been revised",
    text: `Hi {{fullName}},

Your requested changes to quotation {{quoteNumber}} have been reviewed and a revised quotation is ready for you.

View your revised quotation here:
{{publicUrl}}

If you have any questions, reply to this email.

Best regards,
MartPoint Sales Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px;font-weight:600;margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#374151;">Your requested changes to quotation <strong>{{quoteNumber}}</strong> have been reviewed and a revised quotation is ready for you.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr><td style="border-radius:8px;background-color:#0057FF;text-align:center;"><a href="{{publicUrl}}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View Revised Quotation</a></td></tr>
              </table>
              <p style="font-size:13px;line-height:1.5;margin:0 0 16px;color:#6b7280;word-break:break-all;">Or copy and paste this link: <a href="{{publicUrl}}" style="color:#0057FF;text-decoration:underline;">{{publicUrl}}</a></p>
              <p style="font-size:13px;line-height:1.5;margin:0;color:#6b7280;">If you have any questions, reply to this email.</p>`,
      { eyebrow: "Sales", title: "Revised quotation", signoff: "MartPoint Sales Team" }
    ),
  },
  {
    key: "quote_change_request_received",
    label: "Quote Change Request (internal)",
    description: "Internal notification when a lead submits a change request or counter-offer on a quotation. Recipient is controlled by the quote_change_request email route.",
    variables: ["quoteNumber", "leadName", "businessName", "requestType", "clientNote", "adminUrl"],
    subject: "Quote change request — {{quoteNumber}} ({{requestType}})",
    text: `A lead has submitted a change request on a quotation.

Quote: {{quoteNumber}}
Lead: {{leadName}} — {{businessName}}
Request type: {{requestType}}

Client note:
{{clientNote}}

Review and resolve it in the Control Centre:
{{adminUrl}}`,
  },
  {
    key: "quote_declined_client",
    label: "Quote Declined (client)",
    description: "Sent to the lead when they decline a quotation.",
    variables: ["fullName", "quoteNumber", "title", "total", "publicUrl"],
    subject: "Quotation {{quoteNumber}} declined",
    text: `Hi {{fullName}},

We have received your response and noted that you have declined quotation {{quoteNumber}} ({{total}}).

Title: {{title}}

If anything changes or you would like to discuss alternative options, reply to this email or contact us.

Best regards,
MartPoint Sales Team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quotation declined</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f6f7; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); max-width:600px; width:100%;">
          <tr>
            <td style="padding:48px 40px 32px; text-align:center; background:linear-gradient(135deg, #0057FF 0%, #003BB3 100%);">
              <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">MartPoint</div>
              <div style="color:#E0EAFF; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-top:6px;">Sales</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                We have received your response and noted that you have declined quotation <strong>{{quoteNumber}}</strong> ({{total}}).
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Title: {{title}}
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                If anything changes or you would like to discuss alternative options, reply to this email or contact us.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px; background-color:#f9fafb; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="font-size:12px; color:#6b7280; margin:0;">Best regards,<br/><strong>MartPoint Sales Team</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    key: "quote_declined_team",
    label: "Quote Declined (internal)",
    description: "Internal notification when a lead declines a quotation. Recipient is controlled by the quote_declined email route.",
    variables: ["quoteNumber", "title", "fullName", "businessName", "email", "adminUrl"],
    subject: "Quotation {{quoteNumber}} was declined",
    text: `A lead has declined a quotation.

Quote: {{quoteNumber}}
Title: {{title}}
Lead: {{fullName}} — {{businessName}}
Email: {{email}}

Review the quotation in the Control Centre:
{{adminUrl}}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quotation declined</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f6f7; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); max-width:600px; width:100%;">
          <tr>
            <td style="padding:48px 40px 32px; text-align:center; background:linear-gradient(135deg, #0057FF 0%, #003BB3 100%);">
              <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">MartPoint</div>
              <div style="color:#E0EAFF; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-top:6px;">Partner Programme</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:18px; font-weight:600; margin:0 0 16px;">Quotation declined</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                A lead has declined quotation <strong>{{quoteNumber}}</strong>.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Title</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{title}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:12px 0 4px;">Lead</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{fullName}} — {{businessName}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:12px 0 4px;">Email</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{email}}</p>
                  </td>
                </tr>
              </table>
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                <a href="{{adminUrl}}" style="color:#0057FF; text-decoration:underline;">Review the quotation in the Control Centre</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    key: "lead_questionnaire",
    label: "Lead Requirements Questionnaire",
    description: "Sent to a lead before a quotation is issued. Contains a unique per-client questionnaire link.",
    variables: ["fullName", "businessName", "questionnaireLink"],
    subject: "MartPoint Requirements Questionnaire — {{businessName}}",
    text: `Hi {{fullName}},

To prepare an accurate quote for {{businessName}}, please complete this short requirements questionnaire:

{{questionnaireLink}}

It only takes a few minutes and the details you provide will help us tailor the right MartPoint package for your business.

Best regards,
MartPoint Sales Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px;font-weight:600;margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#374151;">To prepare an accurate quote for <strong>{{businessName}}</strong>, please complete this short requirements questionnaire.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr><td style="border-radius:8px;background-color:#0057FF;text-align:center;"><a href="{{questionnaireLink}}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Start Questionnaire</a></td></tr>
              </table>
              <p style="font-size:13px;line-height:1.5;margin:0 0 16px;color:#6b7280;word-break:break-all;">Or copy and paste this link: <a href="{{questionnaireLink}}" style="color:#0057FF;text-decoration:underline;">{{questionnaireLink}}</a></p>
              <p style="font-size:13px;line-height:1.5;margin:0;color:#6b7280;">It only takes a few minutes and the details you provide will help us tailor the right MartPoint package for your business.</p>`,
      { eyebrow: "Sales", title: "Requirements questionnaire", signoff: "MartPoint Sales Team" }
    ),
  },
  {
    key: "lead_additional_questions",
    label: "Lead Additional Questions",
    description: "Short follow-up questions sent to a lead after their initial requirements questionnaire was submitted.",
    variables: ["fullName", "businessName", "questionsLink"],
    subject: "A few additional questions — {{businessName}}",
    text: `Hi {{fullName}},

Thanks for completing our requirements questionnaire for {{businessName}}. To finalise your quote, we just need answers to a few additional questions:

{{questionsLink}}

This will only take a couple of minutes — you don't need to fill the full questionnaire again.

Best regards,
MartPoint Sales Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px;font-weight:600;margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#374151;">Thanks for completing our requirements questionnaire for <strong>{{businessName}}</strong>. To finalise your quote, we just need answers to a few additional questions.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr><td style="border-radius:8px;background-color:#0057FF;text-align:center;"><a href="{{questionsLink}}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Answer Questions</a></td></tr>
              </table>
              <p style="font-size:13px;line-height:1.5;margin:0 0 16px;color:#6b7280;word-break:break-all;">Or copy and paste this link: <a href="{{questionsLink}}" style="color:#0057FF;text-decoration:underline;">{{questionsLink}}</a></p>
              <p style="font-size:13px;line-height:1.5;margin:0;color:#6b7280;">This will only take a couple of minutes — you don't need to fill the full questionnaire again.</p>`,
      { eyebrow: "Sales", title: "A few more questions", signoff: "MartPoint Sales Team" }
    ),
  },
  {
    key: "customer_feedback",
    label: "Customer Feedback (internal)",
    description: "Internal notification when a customer submits a rating. Recipient is controlled by the customer_feedback email route.",
    variables: ["fullName", "businessName", "average", "mood", "comment", "ratingsList"],
    subject: "Customer Feedback: {{fullName}} — {{average}}/5",
    text: `New customer feedback submitted.

Customer: {{fullName}}
Business: {{businessName}}
Average rating: {{average}}/5
Mood: {{mood}}

Ratings:
{{ratingsList}}

Comment: {{comment}}`,
  },
  {
    key: "meeting_invite",
    label: "Meeting / Demo Invite (lead)",
    description: "Sent to a lead when an admin invites them to pick a time for a call or demo.",
    variables: ["fullName", "businessNameBlock", "title", "durationMinutes", "bookingUrl"],
    subject: "{{title}} — pick a time that suits you",
    text: `Hi {{fullName}},

Thanks for your interest in MartPoint{{businessNameBlock}}. We'd love to walk you through it on a short {{durationMinutes}}-minute video call (Google Meet).

Pick a time that works best for you:
{{bookingUrl}}

Once you confirm, you'll get a calendar invite with the Google Meet link.

Note: our calls may be recorded and transcribed for notes.

If none of the times work, just reply to this email and we'll sort something out.

Best regards,
MartPoint Sales Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Thanks for your interest in MartPoint{{businessNameBlock}}. We'd love to walk you through it on a short <strong>{{durationMinutes}}-minute</strong> video call (Google Meet).
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Meeting</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{title}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:12px 0 4px;">Length</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{durationMinutes}} minutes · Google Meet</p>
                  </td>
                </tr>
              </table>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Pick a time that works best for you:
              </p>
              <p style="margin:0 0 24px; text-align:center;">
                <a href="{{bookingUrl}}" style="display:inline-block; background-color:#0057FF; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:8px; font-size:15px; font-weight:600;">Choose a time</a>
              </p>
              <p style="font-size:12px; line-height:1.6; margin:0 0 24px; color:#6b7280;">
                Or copy this link: <a href="{{bookingUrl}}" style="color:#0057FF; text-decoration:underline;">{{bookingUrl}}</a>
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 8px; color:#374151;">
                Once you confirm, you'll get a calendar invite with the Google Meet link.
              </p>
              <p style="font-size:12px; line-height:1.6; margin:0 0 8px; color:#6b7280;">
                Note: our calls may be recorded and transcribed for notes.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                If none of the times work, just reply to this email and we'll sort something out.
              </p>`,
      { eyebrow: "Sales", title: "Meeting invitation", signoff: "MartPoint Sales Team" },
    ),
  },
  {
    key: "meeting_confirmation",
    label: "Meeting Confirmation (lead)",
    description: "Sent to a lead once a meeting time is confirmed — by the lead picking a slot or by self-booking a demo.",
    variables: ["fullName", "title", "when", "durationMinutes", "joinLine", "joinBlock", "detailsUrl"],
    subject: "Confirmed: {{title}} — {{when}}",
    text: `Hi {{fullName}},

You're booked! Here are the details:

{{title}}
{{when}}
{{durationMinutes}} minutes

{{joinLine}}

Our call may be recorded and transcribed for notes.

You can revisit the details anytime at {{detailsUrl}}. Need to change the time? Just reply to this email.

Best regards,
MartPoint Sales Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                You're booked! Here are the details:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 8px;">{{title}}</p>
                    <p style="font-size:15px; color:#111827; margin:0 0 4px;">{{when}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:0;">{{durationMinutes}} minutes · Google Meet</p>
                  </td>
                </tr>
              </table>
              {{joinBlock}}
              <p style="font-size:12px; line-height:1.6; margin:0 0 16px; color:#6b7280;">
                Our call may be recorded and transcribed for notes.
              </p>
              <p style="font-size:12px; line-height:1.6; margin:0; color:#6b7280;">
                Details: <a href="{{detailsUrl}}" style="color:#0057FF; text-decoration:underline;">{{detailsUrl}}</a> — need to change the time? Just reply to this email.
              </p>`,
      { eyebrow: "Sales", title: "Meeting confirmed", signoff: "MartPoint Sales Team" },
    ),
  },
  {
    key: "meeting_summary",
    label: "Meeting Summary / Notes (lead)",
    description: "Sent to a lead when an admin shares the AI-generated summary and action items after a call.",
    variables: ["fullName", "title", "when", "summary", "summaryHtml", "actionItemsText", "actionItemsBlock", "linksText", "linksBlock"],
    subject: "Notes from our call — {{title}}",
    text: `Hi {{fullName}},

Thanks for your time on "{{title}}"{{when}}. Here's a quick recap:

{{summary}}

{{actionItemsText}}

{{linksText}}

Anything we missed or want to follow up on? Just reply to this email.

Best regards,
MartPoint Sales Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Thanks for your time on <strong>{{title}}</strong>{{when}}. Here's a quick recap of what we discussed:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 6px;">Summary</p>
                    <p style="font-size:14px; line-height:1.6; color:#111827; margin:0;">{{summaryHtml}}</p>
                  </td>
                </tr>
              </table>
              {{actionItemsBlock}}
              {{linksBlock}}
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                Anything we missed or want to follow up on? Just reply to this email.
              </p>`,
      { eyebrow: "Sales", title: "Meeting notes", signoff: "MartPoint Sales Team" },
    ),
  },
  {
    key: "career_application_received",
    label: "Careers: Application Received",
    description: "Confirmation sent to an applicant right after submitting a vacancy application.",
    variables: ["fullName", "reference", "vacancyTitle", "statusUrl", "confirmationMessage", "confirmationMessageHtml"],
    subject: "Application received — {{vacancyTitle}} ({{reference}})",
    text: `Hi {{fullName}},

{{confirmationMessage}}

Application reference: {{reference}}

You can check your application status anytime at:
{{statusUrl}}

Best regards,
MartPoint Careers Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              {{confirmationMessageHtml}}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Application reference</p>
                    <p style="font-size:17px; font-weight:700; color:#111827; margin:0; letter-spacing:0.5px;">{{reference}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{statusUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Check Application Status</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280;">
                You will need your application reference and the email you applied with.
              </p>`,
      { eyebrow: "Careers", title: "Application received", signoff: "MartPoint Careers Team" }
    ),
  },
  {
    key: "career_application_admin",
    label: "Careers: Application Received (internal)",
    description: "Internal notification to the careers team when a new application arrives.",
    variables: ["fullName", "reference", "email", "vacancyTitle"],
    subject: "New application — {{vacancyTitle}} ({{reference}})",
    text: `A new careers application was submitted.

Vacancy: {{vacancyTitle}}
Reference: {{reference}}
Applicant: {{fullName}}
Email: {{email}}

Review it in the Control Centre under Careers → Applications.`,
  },
  {
    key: "career_shortlisted",
    label: "Careers: Shortlisted",
    description: "Sent when an applicant is shortlisted for a vacancy.",
    variables: ["fullName", "reference", "vacancyTitle", "statusUrl"],
    subject: "You have been shortlisted — {{vacancyTitle}}",
    text: `Hi {{fullName}},

Good news — your application for {{vacancyTitle}} (reference {{reference}}) has been shortlisted.

Our team will contact you with next steps. You can check your status anytime at:
{{statusUrl}}

Best regards,
MartPoint Careers Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 16px; color:#374151;">
                Good news — your application for <strong>{{vacancyTitle}}</strong> ({{reference}}) has been shortlisted.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Our team will contact you with next steps.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{statusUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Check Status</a>
                  </td>
                </tr>
              </table>`,
      { eyebrow: "Careers", title: "Shortlisted", signoff: "MartPoint Careers Team" }
    ),
  },
  {
    key: "career_assessment_invite",
    label: "Careers: Assessment Invitation",
    description: "Sent when an applicant is invited to an assessment.",
    variables: ["fullName", "reference", "vacancyTitle", "assessmentName", "assessmentDetails"],
    subject: "Assessment invitation — {{vacancyTitle}}",
    text: `Hi {{fullName}},

You have been invited to complete an assessment for {{vacancyTitle}} (reference {{reference}}).

Assessment: {{assessmentName}}
{{assessmentDetails}}

Best regards,
MartPoint Careers Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                You have been invited to complete an assessment for <strong>{{vacancyTitle}}</strong> ({{reference}}).
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Assessment</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{assessmentName}}</p>
                    <p style="font-size:14px; line-height:1.6; color:#374151; margin:12px 0 0;">{{assessmentDetails}}</p>
                  </td>
                </tr>
              </table>`,
      { eyebrow: "Careers", title: "Assessment invitation", signoff: "MartPoint Careers Team" }
    ),
  },
  {
    key: "career_selected",
    label: "Careers: Selection Notification",
    description: "Sent when an applicant is selected for a role.",
    variables: ["fullName", "reference", "vacancyTitle", "nextSteps"],
    subject: "Congratulations — {{vacancyTitle}}",
    text: `Hi {{fullName}},

Congratulations — you have been selected for {{vacancyTitle}} (reference {{reference}}).

{{nextSteps}}

Best regards,
MartPoint Careers Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 16px; color:#374151;">
                Congratulations — you have been selected for <strong>{{vacancyTitle}}</strong> ({{reference}}).
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">{{nextSteps}}</p>`,
      { eyebrow: "Careers", title: "Selected", signoff: "MartPoint Careers Team" }
    ),
  },
  {
    key: "career_reserve",
    label: "Careers: Reserve List",
    description: "Sent when an applicant is placed on the reserve list.",
    variables: ["fullName", "reference", "vacancyTitle"],
    subject: "Application update — {{vacancyTitle}}",
    text: `Hi {{fullName}},

Thank you for applying for {{vacancyTitle}} (reference {{reference}}).

You have been placed on our reserve list. We may contact you if a place opens up or a similar role becomes available.

Best regards,
MartPoint Careers Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 16px; color:#374151;">
                Thank you for applying for <strong>{{vacancyTitle}}</strong> ({{reference}}).
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                You have been placed on our reserve list. We may contact you if a place opens up or a similar role becomes available.
              </p>`,
      { eyebrow: "Careers", title: "Application update", signoff: "MartPoint Careers Team" }
    ),
  },
  {
    key: "career_rejection",
    label: "Careers: Rejection / Closure",
    description: "Sent when an application is not taken forward.",
    variables: ["fullName", "reference", "vacancyTitle"],
    subject: "Application update — {{vacancyTitle}}",
    text: `Hi {{fullName}},

Thank you for your interest in {{vacancyTitle}} (reference {{reference}}) and for the time you invested in applying.

After careful review, we will not be moving forward with your application for this role. We encourage you to join our Talent Pool and apply for future openings.

Best regards,
MartPoint Careers Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 16px; color:#374151;">
                Thank you for your interest in <strong>{{vacancyTitle}}</strong> ({{reference}}) and for the time you invested in applying.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                After careful review, we will not be moving forward with your application for this role. We encourage you to join our Talent Pool and apply for future openings.
              </p>`,
      { eyebrow: "Careers", title: "Application update", signoff: "MartPoint Careers Team" }
    ),
  },
  {
    key: "career_deployment_invite",
    label: "Careers: Deployment Invitation",
    description: "Sent when a field worker is invited to a deployment.",
    variables: ["fullName", "deploymentName", "location", "dates", "details"],
    subject: "Deployment invitation — {{deploymentName}}",
    text: `Hi {{fullName}},

You have been invited to a MartPoint field deployment: {{deploymentName}}.

Location: {{location}}
Dates: {{dates}}
{{details}}

Please confirm your availability by replying to this email.

Best regards,
MartPoint Careers Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                You have been invited to a MartPoint field deployment: <strong>{{deploymentName}}</strong>.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Location</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 12px;">{{location}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Dates</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 12px;">{{dates}}</p>
                    <p style="font-size:14px; line-height:1.6; color:#374151; margin:0;">{{details}}</p>
                  </td>
                </tr>
              </table>`,
      { eyebrow: "Careers", title: "Deployment invitation", signoff: "MartPoint Careers Team" }
    ),
  },
  {
    key: "career_deployment_reminder",
    label: "Careers: Deployment Reminder",
    description: "Reminder sent before a deployment starts.",
    variables: ["fullName", "deploymentName", "location", "dates"],
    subject: "Reminder — {{deploymentName}}",
    text: `Hi {{fullName}},

This is a reminder about your upcoming deployment: {{deploymentName}}.

Location: {{location}}
Dates: {{dates}}

Best regards,
MartPoint Careers Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                This is a reminder about your upcoming deployment: <strong>{{deploymentName}}</strong>.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Location</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 12px;">{{location}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Dates</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{dates}}</p>
                  </td>
                </tr>
              </table>`,
      { eyebrow: "Careers", title: "Deployment reminder", signoff: "MartPoint Careers Team" }
    ),
  },
  {
    key: "career_talent_pool_welcome",
    label: "Careers: Talent Pool Welcome",
    description: "Sent when a candidate joins the talent pool.",
    variables: ["fullName", "reference"],
    subject: "You are in the MartPoint Talent Pool",
    text: `Hi {{fullName}},

Thank you for joining the MartPoint Talent Pool (reference {{reference}}).

We will contact you when a role matching your skills and location opens up.

Best regards,
MartPoint Careers Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 16px; color:#374151;">
                Thank you for joining the MartPoint Talent Pool.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                Your talent pool reference is <strong>{{reference}}</strong>. We will contact you when a role matching your skills and location opens up.
              </p>`,
      { eyebrow: "Careers", title: "Talent pool", signoff: "MartPoint Careers Team" }
    ),
  },
  {
    key: "career_under_review",
    label: "Careers: Under Review",
    description: "Sent when an application moves into active review.",
    variables: ["fullName", "reference", "vacancyTitle", "statusUrl"],
    subject: "Application update — {{vacancyTitle}}",
    text: `Hi {{fullName}},

Your application for {{vacancyTitle}} (reference {{reference}}) is now under active review by our hiring team.

You can check your status anytime at:
{{statusUrl}}

Best regards,
MartPoint Careers Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Your application for <strong>{{vacancyTitle}}</strong> ({{reference}}) is now under active review by our hiring team.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{statusUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Check Status</a>
                  </td>
                </tr>
              </table>`,
      { eyebrow: "Careers", title: "Application update", signoff: "MartPoint Careers Team" }
    ),
  },
  {
    key: "career_interview_invite",
    label: "Careers: Interview Invitation",
    description: "Interview invitation. Includes a join button when a video meeting link is set, or the venue when in person. An .ics calendar file is attached automatically.",
    variables: ["fullName", "reference", "vacancyTitle", "assessmentName", "interviewWhen", "durationMinutes", "joinLine", "joinBlock", "locationLine", "locationBlock", "notes", "statusUrl"],
    subject: "Interview invitation — {{vacancyTitle}}",
    text: `Hi {{fullName}},

You are invited to an interview for {{vacancyTitle}} (reference {{reference}}).

Interview: {{assessmentName}}
When: {{interviewWhen}}
Duration: {{durationMinutes}} minutes
{{joinLine}}{{locationLine}}
{{notes}}

If the time does not work for you, reply to this email and we will reschedule.

Best regards,
MartPoint Careers Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                You are invited to an interview for <strong>{{vacancyTitle}}</strong> ({{reference}}).
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Interview</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 12px;">{{assessmentName}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">When</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 12px;">{{interviewWhen}} · {{durationMinutes}} minutes</p>
                    {{locationBlock}}
                  </td>
                </tr>
              </table>
              {{joinBlock}}
              <p style="font-size:14px; line-height:1.6; color:#374151; margin:0 0 16px;">{{notes}}</p>
              <p style="font-size:13px; line-height:1.5; color:#6b7280; margin:0;">
                A calendar invite is attached to this email. If the time does not work for you, reply to this email and we will reschedule.
              </p>`,
      { eyebrow: "Careers", title: "Interview invitation", signoff: "MartPoint Careers Team" }
    ),
  },
  {
    key: "career_offer_letter",
    label: "Careers: Offer Letter",
    description: "Formal offer letter sent to a selected candidate. Sent from the application detail page with role terms.",
    variables: ["fullName", "reference", "vacancyTitle", "employmentType", "location", "compensation", "startDate", "workScheduleLine", "workScheduleRow", "benefitsLine", "benefitsBlock", "termsText", "termsBlock", "responseNote", "statusUrl"],
    subject: "Your offer — {{vacancyTitle}} at MartPoint",
    text: `Hi {{fullName}},

Following your application for {{vacancyTitle}} (reference {{reference}}), we are pleased to offer you the role at MartPoint.

ROLE DETAILS
Position: {{vacancyTitle}}
Employment type: {{employmentType}}
Location: {{location}}
Compensation: {{compensation}}
Start date: {{startDate}}
{{workScheduleLine}}{{benefitsLine}}
{{termsText}}
{{responseNote}}

To accept this offer, reply to this email. If you have any questions about the terms, we are happy to discuss them.

Congratulations — we look forward to working with you.

Best regards,
MartPoint Careers Team`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Following your application for <strong>{{vacancyTitle}}</strong> ({{reference}}), we are pleased to offer you the role at MartPoint.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; margin:0 0 12px;">Role details</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr><td style="font-size:14px; color:#6b7280; padding:2px 16px 2px 0;">Position</td><td style="font-size:14px; font-weight:600; color:#111827; padding:2px 0;">{{vacancyTitle}}</td></tr>
                      <tr><td style="font-size:14px; color:#6b7280; padding:2px 16px 2px 0;">Employment type</td><td style="font-size:14px; color:#111827; padding:2px 0;">{{employmentType}}</td></tr>
                      <tr><td style="font-size:14px; color:#6b7280; padding:2px 16px 2px 0;">Location</td><td style="font-size:14px; color:#111827; padding:2px 0;">{{location}}</td></tr>
                      <tr><td style="font-size:14px; color:#6b7280; padding:2px 16px 2px 0;">Compensation</td><td style="font-size:14px; color:#111827; padding:2px 0;">{{compensation}}</td></tr>
                      <tr><td style="font-size:14px; color:#6b7280; padding:2px 16px 2px 0;">Start date</td><td style="font-size:14px; color:#111827; padding:2px 0;">{{startDate}}</td></tr>
                      {{workScheduleRow}}
                    </table>
                    {{benefitsBlock}}
                  </td>
                </tr>
              </table>
              {{termsBlock}}
              <p style="font-size:15px; line-height:1.6; margin:0 0 8px; color:#374151;">{{responseNote}}</p>
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                Congratulations — we look forward to working with you.
              </p>`,
      { eyebrow: "Careers", title: "Offer of engagement", signoff: "MartPoint Careers Team" }
    ),
  },

  /* ───────────────────────────  Creator Network  ─────────────────────────── */

  {
    key: "creator_application_received",
    label: "Creator Application Received (applicant)",
    description: "Sent to the applicant right after they submit a Creator Network application.",
    variables: ["fullName", "reference", "statusUrl"],
    subject: "MartPoint Creator Network Application Received — {{reference}}",
    text: `Hi {{fullName}},

Thank you for applying to the MartPoint Creator Network. Your application has been received and is now being reviewed.

Application Reference: {{reference}}

You can check your application status anytime at:
{{statusUrl}}

Please note: admission to the Creator Network is subject to review, and application does not guarantee acceptance or payment.

Best regards,
MartPoint Creator Network`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Thank you for applying to the MartPoint Creator Network. Your application has been received and is now being reviewed by our team.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Application reference</p>
                    <p style="font-size:17px; font-weight:700; color:#111827; margin:0; letter-spacing:0.5px;">{{reference}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{statusUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Track Your Application</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280;">
                Admission is subject to review — applying does not guarantee acceptance or payment.
              </p>`,
      { eyebrow: "Creator Network", title: "Application received", signoff: "MartPoint Creator Network" }
    ),
  },

  {
    key: "creator_application_admin",
    label: "Creator Application Received (internal)",
    description: "Internal notification to the configured email route when a creator application arrives.",
    variables: ["fullName", "reference", "category", "state", "profilesSummary", "reviewUrl"],
    subject: "New Creator Application — {{reference}} ({{fullName}})",
    text: `New Creator Network application received.

Reference: {{reference}}
Name: {{fullName}}
Category: {{category}}
State: {{state}}
Profiles: {{profilesSummary}}

Review: {{reviewUrl}}`,
  },

  {
    key: "creator_interview_invite",
    label: "Creator Interview Invite",
    description: "Sent when an admin schedules an interview with an applicant.",
    variables: ["fullName", "reference", "interviewWhen", "durationMinutes", "joinLine", "joinBlock", "locationLine", "locationBlock", "notes", "statusUrl"],
    subject: "MartPoint Creator Network — Interview Invitation ({{reference}})",
    text: `Hi {{fullName}},

We would like to invite you to a short interview as part of your MartPoint Creator Network application ({{reference}}).

When: {{interviewWhen}}
Duration: {{durationMinutes}} minutes
{{joinLine}}{{locationLine}}
{{notes}}

An .ics calendar invite is attached to this email.

Best regards,
MartPoint Creator Network`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                We would like to invite you to a short interview as part of your Creator Network application ({{reference}}).
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">When</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 12px;">{{interviewWhen}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Duration</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 12px;">{{durationMinutes}} minutes</p>
                    {{locationBlock}}
                  </td>
                </tr>
              </table>
              {{joinBlock}}
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280;">{{notes}}</p>`,
      { eyebrow: "Creator Network", title: "Interview invitation", signoff: "MartPoint Creator Network" }
    ),
  },

  {
    key: "creator_approved",
    label: "Creator Application Approved",
    description: "Sent when an application is approved — includes creator codes and set-password link.",
    variables: ["fullName", "reference", "creatorId", "referralCode", "trackingUrl", "setPasswordUrl", "loginUrl"],
    subject: "Welcome to the MartPoint Creator Network — you're approved",
    text: `Hi {{fullName}},

Great news — your MartPoint Creator Network application ({{reference}}) has been approved.

Your Creator ID: {{creatorId}}
Your Referral Code: {{referralCode}}
Your tracking link: {{trackingUrl}}

Activate your account and set your password:
{{setPasswordUrl}}

Then sign in at: {{loginUrl}}

Best regards,
MartPoint Creator Network`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Welcome aboard, {{fullName}}!</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Your MartPoint Creator Network application ({{reference}}) has been approved. Here are your creator details:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Creator ID</p>
                    <p style="font-size:17px; font-weight:700; color:#111827; margin:0 0 12px; letter-spacing:0.5px;">{{creatorId}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Referral code</p>
                    <p style="font-size:17px; font-weight:700; color:#111827; margin:0 0 12px; letter-spacing:0.5px;">{{referralCode}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Your tracking link</p>
                    <p style="font-size:14px; font-weight:600; color:#0057FF; margin:0; word-break:break-all;">{{trackingUrl}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{setPasswordUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Activate Your Account</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0; color:#6b7280;">
                This activation link expires in 72 hours. After setting your password, sign in at {{loginUrl}} to start onboarding.
              </p>`,
      { eyebrow: "Creator Network", title: "You're approved", signoff: "MartPoint Creator Network" }
    ),
  },

  {
    key: "creator_waitlisted",
    label: "Creator Application Waitlisted",
    description: "Sent when an applicant is placed on the waitlist.",
    variables: ["fullName", "reference", "statusUrl"],
    subject: "MartPoint Creator Network — application update ({{reference}})",
    text: `Hi {{fullName}},

Thank you for your interest in the MartPoint Creator Network. Your application ({{reference}}) has been placed on our waitlist.

This means your application impressed us, but we are not able to offer you a place in the current cohort. We may reach out again as the network expands.

Check your status anytime: {{statusUrl}}

Best regards,
MartPoint Creator Network`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Your Creator Network application ({{reference}}) has been placed on our waitlist. Your application impressed us, but we are not able to offer you a place in the current cohort — we may reach out again as the network expands.
              </p>`,
      { eyebrow: "Creator Network", title: "Application update", signoff: "MartPoint Creator Network" }
    ),
  },

  {
    key: "creator_rejected",
    label: "Creator Application Rejected",
    description: "Sent when an application is not accepted.",
    variables: ["fullName", "reference"],
    subject: "MartPoint Creator Network — application update ({{reference}})",
    text: `Hi {{fullName}},

Thank you for applying to the MartPoint Creator Network ({{reference}}).

After careful review, we are unable to offer you a place in the network at this time. This does not reflect on the quality of your content — places are limited and we review many applications.

You are welcome to apply again in the future as the programme grows.

Best regards,
MartPoint Creator Network`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Thank you for applying to the MartPoint Creator Network ({{reference}}). After careful review, we are unable to offer you a place at this time.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                This does not reflect on the quality of your content — places are limited and we review many applications. You are welcome to apply again in the future.
              </p>`,
      { eyebrow: "Creator Network", title: "Application update", signoff: "MartPoint Creator Network" }
    ),
  },

  {
    key: "creator_set_password",
    label: "Creator Set Password",
    description: "Account activation / set-password link for a new creator.",
    variables: ["fullName", "setPasswordUrl"],
    subject: "Activate your MartPoint Creator account",
    text: `Hi {{fullName}},

Set your Creator Portal password using this link (valid for 72 hours):
{{setPasswordUrl}}

Best regards,
MartPoint Creator Network`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Set your Creator Portal password to activate your account. The link is valid for 72 hours.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{setPasswordUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Set Your Password</a>
                  </td>
                </tr>
              </table>`,
      { eyebrow: "Creator Network", title: "Activate your account", signoff: "MartPoint Creator Network" }
    ),
  },

  {
    key: "creator_password_reset",
    label: "Creator Password Reset",
    description: "Password reset link for an existing creator.",
    variables: ["fullName", "resetUrl"],
    subject: "Reset your MartPoint Creator password",
    text: `Hi {{fullName}},

We received a request to reset your Creator Portal password. Use this link (valid for 72 hours):
{{resetUrl}}

If you did not request this, you can ignore this email.

Best regards,
MartPoint Creator Network`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                We received a request to reset your Creator Portal password. This link is valid for 72 hours — if you did not request it, you can ignore this email.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{resetUrl}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Reset Password</a>
                  </td>
                </tr>
              </table>`,
      { eyebrow: "Creator Network", title: "Password reset", signoff: "MartPoint Creator Network" }
    ),
  },

  {
    key: "creator_onboarding_reminder",
    label: "Creator Onboarding Reminder",
    description: "Reminds an approved creator to finish onboarding.",
    variables: ["fullName", "portalUrl"],
    subject: "Finish your Creator onboarding to unlock challenges",
    text: `Hi {{fullName}},

You're approved for the MartPoint Creator Network — finish your onboarding to unlock challenges and start creating.

Continue here: {{portalUrl}}

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_onboarding_completed",
    label: "Creator Onboarding Completed",
    description: "Confirms a creator finished required onboarding and is challenge-ready.",
    variables: ["fullName", "portalUrl"],
    subject: "You're Creator Ready — challenges unlocked",
    text: `Hi {{fullName}},

You've completed the required Creator Network onboarding — you're now Creator Ready.

You can join Creator Challenges, submit content and track your results from your dashboard:
{{portalUrl}}

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_assessment_passed",
    label: "Creator Assessment Passed",
    description: "Notifies a creator they passed the onboarding assessment.",
    variables: ["fullName", "score", "portalUrl"],
    subject: "Assessment passed — {{score}}%",
    text: `Hi {{fullName}},

You passed the Creator onboarding assessment with {{score}}%. Nice work.

Keep going in your portal: {{portalUrl}}

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_assessment_retry",
    label: "Creator Assessment Retry",
    description: "Notifies a creator they did not reach the passing score and may retry.",
    variables: ["fullName", "score", "passingScore", "portalUrl"],
    subject: "Assessment result — {{score}}% (retry available)",
    text: `Hi {{fullName}},

You scored {{score}}% on the Creator onboarding assessment. The passing score is {{passingScore}}%.

Review the lessons and try again: {{portalUrl}}

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_new_lesson",
    label: "New Required Lesson",
    description: "Announces a newly published required lesson to creators.",
    variables: ["fullName", "lessonTitle", "portalUrl"],
    subject: "New lesson: {{lessonTitle}}",
    text: `Hi {{fullName}},

A new required lesson is available in your Learning Centre: {{lessonTitle}}

Continue learning: {{portalUrl}}

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_new_resource",
    label: "New Creator Resource",
    description: "Announces a new Creator Kit resource to creators.",
    variables: ["fullName", "resourceName", "kitUrl"],
    subject: "New in your Creator Kit: {{resourceName}}",
    text: `Hi {{fullName}},

A new resource was added to your Creator Kit: {{resourceName}}

Open the kit: {{kitUrl}}

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_announcement",
    label: "Creator Announcement",
    description: "Custom broadcast message from MartPoint to creators.",
    variables: ["fullName", "title", "body", "linkUrl", "portalUrl"],
    subject: "{{title}}",
    text: `Hi {{fullName}},

{{body}}

{{linkUrl}}

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_challenge_announced",
    label: "New Creator Challenge",
    description: "Announces a new challenge to creators.",
    variables: ["fullName", "challengeName", "deadline", "challengeUrl"],
    subject: "New Creator Challenge: {{challengeName}}",
    text: `Hi {{fullName}},

A new Creator Challenge is live: {{challengeName}}
Submission deadline: {{deadline}}

View the brief and join: {{challengeUrl}}

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_submission_received",
    label: "Creator Submission Received",
    description: "Confirms receipt of a challenge content submission.",
    variables: ["fullName", "challengeName", "contentUrl"],
    subject: "Submission received — {{challengeName}}",
    text: `Hi {{fullName}},

We received your submission for "{{challengeName}}":
{{contentUrl}}

Our team will review it and update the status in your portal.

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_submission_decision",
    label: "Creator Submission Decision",
    description: "Notifies a creator of a submission review outcome.",
    variables: ["fullName", "challengeName", "decisionLabel", "feedback", "portalUrl"],
    subject: "Submission update — {{challengeName}}: {{decisionLabel}}",
    text: `Hi {{fullName}},

Your submission for "{{challengeName}}" has been updated: {{decisionLabel}}.

{{feedback}}

View it in your portal: {{portalUrl}}

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_deadline_reminder",
    label: "Creator Challenge Deadline Reminder",
    description: "Deadline reminder for an active challenge.",
    variables: ["fullName", "challengeName", "deadline", "challengeUrl"],
    subject: "Deadline reminder — {{challengeName}}",
    text: `Hi {{fullName}},

Reminder: submissions for "{{challengeName}}" close on {{deadline}}.

Submit your published content: {{challengeUrl}}

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_winner",
    label: "Creator Challenge Winner",
    description: "Notifies a creator they won a challenge award.",
    variables: ["fullName", "challengeName", "awardTitle", "rewardDetail"],
    subject: "You won — {{awardTitle}} in {{challengeName}}",
    text: `Hi {{fullName}},

Congratulations! You won "{{awardTitle}}" in the {{challengeName}} challenge.

{{rewardDetail}}

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_reward_approved",
    label: "Creator Reward Approved",
    description: "Notifies a creator that a reward was approved for payment.",
    variables: ["fullName", "rewardTitle", "amount"],
    subject: "Reward approved — {{rewardTitle}}",
    text: `Hi {{fullName}},

Your reward "{{rewardTitle}}" ({{amount}}) has been approved and is being processed for payment.

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "creator_reward_paid",
    label: "Creator Reward Paid",
    description: "Notifies a creator that a reward was paid.",
    variables: ["fullName", "rewardTitle", "amount", "paymentReference"],
    subject: "Reward paid — {{rewardTitle}}",
    text: `Hi {{fullName}},

Your reward "{{rewardTitle}}" ({{amount}}) has been paid.
Payment reference: {{paymentReference}}

Best regards,
MartPoint Creator Network`,
  },

  {
    key: "payment_received",
    label: "Payment Confirmation / Receipt",
    description: "Sent to a business when a payment is confirmed, with a receipt PDF attached.",
    variables: ["contactName", "businessName", "receiptNumber", "invoiceNumber", "paymentReference", "amount", "paymentMethod", "paidAt"],
    subject: "Payment received — {{amount}} (Receipt {{receiptNumber}})",
    text: `Hi {{contactName}},

Thank you — we have received your payment for {{businessName}}.

Receipt: {{receiptNumber}}
Invoice: {{invoiceNumber}}
Payment reference: {{paymentReference}}
Amount paid: {{amount}}
Method: {{paymentMethod}}
Paid on: {{paidAt}}

A PDF copy of your receipt is attached.

If you believe this payment was recorded in error, please reply to this email.

Best regards,
MartPoint Billing`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{contactName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Thank you — we have received your payment for <strong>{{businessName}}</strong>.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin-bottom:24px;">
                <tr>
                  <td style="padding:16px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="font-size:14px; color:#6b7280; padding-bottom:4px;">Receipt</td>
                        <td align="right" style="font-size:15px; font-weight:600; color:#111827; padding-bottom:4px;">{{receiptNumber}}</td>
                      </tr>
                      <tr>
                        <td style="font-size:14px; color:#6b7280; padding-bottom:4px;">Invoice</td>
                        <td align="right" style="font-size:15px; color:#111827; padding-bottom:4px;">{{invoiceNumber}}</td>
                      </tr>
                      <tr>
                        <td style="font-size:14px; color:#6b7280; padding-bottom:4px;">Payment reference</td>
                        <td align="right" style="font-size:15px; color:#111827; padding-bottom:4px;">{{paymentReference}}</td>
                      </tr>
                    </table>
                    <div style="border-top:1px solid #e5e7eb; margin:12px 0; padding-top:12px;">
                      <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Amount paid</p>
                      <p style="font-size:22px; font-weight:700; color:#0057FF; margin:0 0 12px;">{{amount}}</p>
                      <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Method</p>
                      <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 4px;">{{paymentMethod}}</p>
                      <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Paid on</p>
                      <p style="font-size:15px; color:#111827; margin:0;">{{paidAt}}</p>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="font-size:14px; line-height:1.6; margin:0; color:#6b7280;">
                A PDF copy of your receipt is attached. If you believe this payment was recorded in error, please reply to this email.
              </p>`,
      { eyebrow: "Billing", title: "Payment received", signoff: "MartPoint Billing" }
    ),
  },

  {
    key: "invoice_sent",
    label: "Invoice",
    description: "Invoice email sent to a business when an invoice is issued or resent.",
    variables: ["contactName", "businessName", "invoiceNumber", "issueDate", "dueDate", "itemsSummary", "itemsHtml", "total", "balance", "notes"],
    subject: "Invoice {{invoiceNumber}} from MartPoint — {{businessName}}",
    text: `Hi {{contactName}},

Please find your invoice for {{businessName}} below.

Invoice: {{invoiceNumber}}
Issued: {{issueDate}}
Due: {{dueDate}}

{{itemsSummary}}

Total: {{total}}
Balance due: {{balance}}

{{notes}}

A PDF copy of this invoice is attached.

To pay by bank transfer, quote the invoice number as the payment reference and send proof of payment in reply to this email.

Best regards,
MartPoint Billing`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{contactName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Please find your invoice for <strong>{{businessName}}</strong> below.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin-bottom:24px;">
                <tr>
                  <td style="padding:16px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="font-size:14px; color:#6b7280; padding-bottom:4px;">Invoice</td>
                        <td align="right" style="font-size:15px; font-weight:600; color:#111827; padding-bottom:4px;">{{invoiceNumber}}</td>
                      </tr>
                      <tr>
                        <td style="font-size:14px; color:#6b7280; padding-bottom:4px;">Issued</td>
                        <td align="right" style="font-size:15px; color:#111827; padding-bottom:4px;">{{issueDate}}</td>
                      </tr>
                      <tr>
                        <td style="font-size:14px; color:#6b7280; padding-bottom:4px;">Due</td>
                        <td align="right" style="font-size:15px; font-weight:600; color:#111827; padding-bottom:4px;">{{dueDate}}</td>
                      </tr>
                    </table>
                    <div style="border-top:1px solid #e5e7eb; margin:8px 0; padding-top:12px; font-size:14px; line-height:1.7; color:#374151;">{{itemsHtml}}</div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e5e7eb; margin-top:8px; padding-top:12px;">
                      <tr>
                        <td style="font-size:14px; color:#6b7280; padding-top:12px;">Total</td>
                        <td align="right" style="font-size:15px; font-weight:600; color:#111827; padding-top:12px;">{{total}}</td>
                      </tr>
                      <tr>
                        <td style="font-size:14px; color:#6b7280;">Balance due</td>
                        <td align="right" style="font-size:18px; font-weight:700; color:#0057FF;">{{balance}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="font-size:14px; line-height:1.6; margin:0 0 16px; color:#374151;">{{notes}}</p>
              <p style="font-size:14px; line-height:1.6; margin:0; color:#6b7280;">
                To pay by bank transfer, quote the invoice number as the payment reference and send proof of payment in reply to this email.
              </p>`,
      { eyebrow: "Billing", title: "Invoice {{invoiceNumber}}", signoff: "MartPoint Billing" }
    ),
  },

  {
    key: "invoice_payment_reminder",
    label: "Invoice Payment Reminder",
    description: "Payment reminder sent for an unpaid invoice (manual or automated).",
    variables: ["contactName", "businessName", "invoiceNumber", "dueDate", "balance", "dueText"],
    subject: "Payment reminder — Invoice {{invoiceNumber}} ({{balance}})",
    text: `Hi {{contactName}},

This is a friendly reminder that invoice {{invoiceNumber}} for {{businessName}} is {{dueText}}.

Balance due: {{balance}}
Due date: {{dueDate}}

A PDF copy of the invoice is attached for reference.

To pay by bank transfer, quote the invoice number as the payment reference and send proof of payment in reply to this email. If you have already paid, please disregard this message.

Best regards,
MartPoint Billing`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{contactName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                This is a friendly reminder that invoice <strong>{{invoiceNumber}}</strong> for <strong>{{businessName}}</strong> is {{dueText}}.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin-bottom:24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Balance due</p>
                    <p style="font-size:22px; font-weight:700; color:#0057FF; margin:0 0 12px;">{{balance}}</p>
                    <p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Due date</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{dueDate}}</p>
                  </td>
                </tr>
              </table>
              <p style="font-size:14px; line-height:1.6; margin:0; color:#6b7280;">
                To pay by bank transfer, quote the invoice number as the payment reference and send proof of payment in reply to this email. If you have already paid, please disregard this message.
              </p>`,
      { eyebrow: "Billing", title: "Payment reminder", signoff: "MartPoint Billing" }
    ),
  },

  {
    key: "lead_questionnaire_reminder",
    label: "Questionnaire Reminder (lead)",
    description: "Automated, friendly nudge to a lead who has not finished the requirements questionnaire. Sent every 48h (max 3).",
    variables: ["fullName", "businessName", "questionnaireLink"],
    subject: "Still with us, {{fullName}}? Your MartPoint setup is 2 minutes away",
    text: `Hi {{fullName}},

Quick one — we're ready to build the right MartPoint setup for {{businessName}}, and your short questionnaire is the last piece.

It takes about two minutes, and once it's in we'll turn it into an accurate quote for you:
{{questionnaireLink}}

No rush at all — whenever you're set, the link stays here.

Talk soon,
MartPoint`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.65; margin:0 0 18px; color:#374151;">
                Quick one — we're ready to build the right MartPoint setup for <strong>{{businessName}}</strong>, and your short questionnaire is the last piece.
              </p>
              <p style="font-size:15px; line-height:1.65; margin:0 0 24px; color:#374151;">
                It takes about <strong>two minutes</strong>, and once it's in we'll turn it into an accurate quote for you.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 28px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{questionnaireLink}}" target="_blank" style="display:inline-block; padding:14px 36px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Finish my questionnaire</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:14px; line-height:1.6; margin:0; color:#6b7280;">
                No rush at all — whenever you're set, the link stays here.
              </p>`,
      { eyebrow: "Your setup", title: "Just a nudge", signoff: "MartPoint" }
    ),
  },

  {
    key: "lead_quote_reminder",
    label: "Quote Reminder (lead)",
    description: "Automated, friendly nudge to a lead who has not accepted or declined a quotation. Sent every 48h (max 3).",
    variables: ["fullName", "businessName", "quoteNumber", "title", "total", "validUntil", "quoteLink"],
    subject: "Your MartPoint quote {{quoteNumber}} is ready when you are",
    text: `Hi {{fullName}},

Just circling back on your MartPoint quote for {{businessName}} — it's ready whenever you want to take the next step.

Quote: {{quoteNumber}}{{title}}
Total: {{total}}
Valid until: {{validUntil}}

View or accept it here:
{{quoteLink}}

Any questions? Simply reply to this email — happy to help.

MartPoint`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.65; margin:0 0 20px; color:#374151;">
                Just circling back on your MartPoint quote for <strong>{{businessName}}</strong> — it's ready whenever you want to take the next step.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:13px; color:#6b7280; margin:0 0 4px;">Quotation</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 12px;">{{quoteNumber}}{{title}}</p>
                    <p style="font-size:13px; color:#6b7280; margin:0 0 4px;">Total</p>
                    <p style="font-size:22px; font-weight:700; color:#0057FF; margin:0 0 12px;">{{total}}</p>
                    <p style="font-size:13px; color:#6b7280; margin:0 0 4px;">Valid until</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">{{validUntil}}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 28px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{quoteLink}}" target="_blank" style="display:inline-block; padding:14px 36px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">View my quote</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:14px; line-height:1.6; margin:0; color:#6b7280;">
                Any questions? Simply reply to this email — happy to help.
              </p>`,
      { eyebrow: "Your quotation", title: "Ready when you are", signoff: "MartPoint Sales" }
    ),
  },

  {
    key: "lead_estimate_followup",
    label: "Estimate Follow-up (lead)",
    description: "Automated, friendly nudge to a visitor who received a cost estimate, inviting them to turn it into a proper quote. Sent every 48h (max 3).",
    variables: ["fullName", "businessName", "retailPlan", "retailRange", "erpBlock", "quoteLink", "whatsappBlock", "bookCallLink"],
    subject: "Your MartPoint estimate is ready — shall we make it official?",
    text: `Hi {{fullName}},

Thanks for using the MartPoint cost estimator for {{businessName}}. Based on what you told us, here's the fit we recommend:

{{retailPlan}} — {{retailRange}}
{{erpBlock}}

An estimate is a great starting point — but a proper quote locks in your exact plan, add-ons and pricing. It takes us no time, and there's no obligation.

Ready to move? Pick whichever suits you:
• Prepare my quote: {{quoteLink}}
• Chat on WhatsApp: we're one message away — just reply to this email
• Book a call: {{bookCallLink}}

Just reply to this email if you'd like to talk it through first — we're happy to help.

MartPoint`,
    html: brandedEmailHtml(
      `<p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{fullName}},</p>
              <p style="font-size:15px; line-height:1.65; margin:0 0 20px; color:#374151;">
                Thanks for using the MartPoint cost estimator for <strong>{{businessName}}</strong>. Based on what you told us, here's the fit we recommend:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:13px; color:#6b7280; margin:0 0 4px;">Recommended plan</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 10px;">{{retailPlan}}</p>
                    <p style="font-size:13px; color:#6b7280; margin:0 0 4px;">Estimated range</p>
                    <p style="font-size:22px; font-weight:700; color:#0057FF; margin:0;">{{retailRange}}</p>
                    {{erpBlock}}
                  </td>
                </tr>
              </table>
              <p style="font-size:15px; line-height:1.65; margin:0 0 20px; color:#374151;">
                An estimate is a great starting point — but a proper quote locks in your <strong>exact plan, add-ons and pricing</strong>. It takes us no time, and there's no obligation.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 8px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{quoteLink}}" target="_blank" style="display:inline-block; padding:14px 36px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Prepare my quote</a>
                  </td>
                </tr>
              </table>
              {{whatsappBlock}}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 28px;">
                <tr>
                  <td style="border-radius:8px; border:1px solid #d1d5db; text-align:center;">
                    <a href="{{bookCallLink}}" target="_blank" style="display:inline-block; padding:13px 32px; font-size:15px; font-weight:600; color:#111827; text-decoration:none; border-radius:8px;">Book a call</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:14px; line-height:1.6; margin:0; color:#6b7280;">
                Just reply to this email if you'd like to talk it through first — we're happy to help.
              </p>`,
      { eyebrow: "Your estimate", title: "Shall we make it official?", signoff: "MartPoint Sales" }
    ),
  },
]

const templateMap = new Map(EMAIL_TEMPLATES.map((t) => [t.key, t]))

/**
 * Render a template: admin overrides from settings.data.email.templates are
 * merged over the defaults, then {{variables}} are substituted.
 * `{{xBlock}}` is a special variable containing a pre-built block (or "").
 */
export async function renderEmailTemplate(
  key: string,
  vars: Record<string, string | number | null | undefined>
): Promise<EmailTemplate> {
  const def = templateMap.get(key)
  if (!def) throw new Error(`Unknown email template: ${key}`)

  let override: Partial<EmailTemplate> = {}
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase.from("settings").select("data").eq("id", 1).single()
      const overrides = ((data?.data as Record<string, unknown>)?.email as Record<string, unknown>)?.templates as
        | Record<string, { subject?: string; text?: string; html?: string }>
        | undefined
      override = overrides?.[key] || {}
    } catch {
      // fall back to defaults
    }
  }

  const tpl: EmailTemplate = {
    subject: override.subject || def.subject,
    text: override.text || def.text,
    html: override.html ?? def.html,
  }

  const substitute = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ""))

  return {
    subject: substitute(tpl.subject),
    text: substitute(tpl.text),
    html: tpl.html ? substitute(tpl.html) : undefined,
  }
}
