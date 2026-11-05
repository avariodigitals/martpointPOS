export const SUPPORT_RECOVERY_NOTICE_TITLE = "Support, updates, backups and recovery"

export const SUPPORT_RECOVERY_NOTICE_PARAGRAPHS = [
  "Standard software support is available Monday–Friday, 9 am–5 pm WAT, through WhatsApp, email and the in-app support channel.",
  "This covers guidance on using MartPoint, investigation of reported software problems and escalation of technical issues. Custom development, ongoing data entry, hardware repairs and local network troubleshooting are separately scoped and on request.",
  "MartPoint maintains daily backups, retained for a rolling period of 30 days, to support recovery where required. If your licence expires, your business data will be retained for up to 90 days to allow renewal or a data export request.",
  "After this period, the inactive account and its data may be permanently deleted following prior notice. Any remaining backup copies will expire within the normal 30-day backup cycle.",
  "Daily backups and standard backup retention are included in your annual cloud subscription at no additional charge. Recovery following a MartPoint system failure is also included.",
  "Customer-requested restoration following accidental deletion or incorrect data changes may attract a service fee, which will be communicated for approval before work begins.",
] as const

export const SUPPORT_RECOVERY_NOTICE_TEXT = SUPPORT_RECOVERY_NOTICE_PARAGRAPHS.join("\n\n")

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;")
}

export function supportRecoveryNoticeHtml(): string {
  const paragraphs = SUPPORT_RECOVERY_NOTICE_PARAGRAPHS
    .map((paragraph) => `<p style="margin:0 0 10px;">${escapeHtml(paragraph)}</p>`)
    .join("")
  return `<section style="margin:28px 0 0;padding:20px;border:1px solid #dbe3f0;border-radius:10px;background:#f8fafc;color:#374151;font-size:13px;line-height:1.65;"><h2 style="margin:0 0 12px;color:#111827;font-size:15px;line-height:1.4;">${SUPPORT_RECOVERY_NOTICE_TITLE}</h2>${paragraphs}</section>`
}

/** Inserts a notice row into MartPoint's branded email shell, with a safe fallback for custom HTML. */
export function appendSupportRecoveryNoticeToEmail(html: string): string {
  const noticeRow = `<tr><td style="padding:0 40px 32px;">${supportRecoveryNoticeHtml()}</td></tr>`
  const outerTableEnd = html.lastIndexOf("</table>")
  if (outerTableEnd >= 0) return `${html.slice(0, outerTableEnd)}${noticeRow}${html.slice(outerTableEnd)}`
  const bodyEnd = html.toLowerCase().lastIndexOf("</body>")
  if (bodyEnd >= 0) return `${html.slice(0, bodyEnd)}${supportRecoveryNoticeHtml()}${html.slice(bodyEnd)}`
  return `${html}${supportRecoveryNoticeHtml()}`
}
