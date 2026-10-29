import { appendSignatureToHtml, bodyTextToHtml, htmlToText } from "@/lib/email-html"
import { renderCorrespondenceHtml } from "@/lib/email-correspondence"
import type { EmailLayout } from "@/lib/email-layout"
import { sanitizeSupportHtml } from "@/lib/support-html"

/** Ordinary creator emails: readable HTML body plus the sender's signature.
 * The shared email sender adds the standard MartPoint header and footer banner. */
export function buildCreatorEmailContent(body: string, signatureHtml: string, bodyHtml?: string): { text: string; html: string } {
  signatureHtml = sanitizeSupportHtml(signatureHtml)
  const richBody = bodyHtml !== undefined ? sanitizeSupportHtml(bodyHtml) : undefined
  if (richBody !== undefined) body = htmlToText(richBody)
  const signatureText = htmlToText(signatureHtml)
  const text = signatureText ? `${body}\n\n-- \n${signatureText}` : body
  const signature = signatureHtml.trim()
    ? `<div style="margin-top:24px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827"><div style="color:#9ca3af">-- </div>${signatureHtml}</div>`
    : ""
  return { text, html: appendSignatureToHtml(richBody ?? bodyTextToHtml(body), signature) }
}

/** Exact full document shared by Preview and Send: simple body, configured
 * sender signature, standard MartPoint header/footer and the banner image. */
export async function renderCreatorEmail(body: string, signatureHtml: string, layout: EmailLayout = "branded", bodyHtml?: string) {
  const content = buildCreatorEmailContent(body, signatureHtml, bodyHtml)
  return {
    text: content.text,
    html: await renderCorrespondenceHtml(content.html, content.text, layout, {
      eyebrow: "Creator Network", title: "Message from MartPoint",
      signoff: "MartPoint Creator Team",
    }),
  }
}
