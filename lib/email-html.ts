/* ─────────────  Email HTML helpers (pure — client & server safe)  ─────────────
 * Shared by the lead email sender, marketing campaigns and the admin settings
 * UI. No imports — safe to use from client components.
 */

export const EMAIL_FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

/** Convert HTML to a readable plain-text fallback. */
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

/** Convert plain text (e.g. a legacy signature) to minimal HTML for editors. */
export function textToHtml(text: string): string {
  const esc = escapeHtml(text.trim())
  if (!esc) return ""
  return `<p>${esc.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>`
}

/** Wrap a plain-text body in the standard email font container. */
export function bodyTextToHtml(text: string): string {
  return `<div style="font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#111827;white-space:pre-wrap;">${escapeHtml(text)}</div>`
}

/**
 * Build the signature block appended to HTML emails — the conventional "-- "
 * separator followed by the signature. Uses the HTML signature when present,
 * otherwise renders the plain-text one.
 */
export function buildSignatureHtml(signatureHtml: string, signatureText: string): string {
  const content = signatureHtml.trim()
    ? signatureHtml
    : `<div style="white-space:pre-wrap;">${escapeHtml(signatureText)}</div>`
  return `<div style="margin-top:24px;font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#111827;"><div style="color:#9ca3af;">-- </div>${content}</div>`
}

/**
 * Append the signature block to an HTML email. When the HTML is a full
 * document (branded templates), the signature is inserted before </body> so it
 * lands at the end of the message like a normal signature.
 */
export function appendSignatureToHtml(html: string, signatureBlock: string): string {
  if (!signatureBlock) return html
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${signatureBlock}</body>`)
  return `${html}${signatureBlock}`
}
