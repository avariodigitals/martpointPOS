import { appendSignatureToHtml, bodyTextToHtml, htmlToText } from "@/lib/email-html"
import { ensureBrandedHtml, type EmailFooterOptions } from "@/lib/email-templates"
import { getEmailFooterSettings } from "@/lib/settings"

/** Ordinary creator emails: readable HTML body plus the sender's signature.
 * The shared email sender adds the standard MartPoint header and footer banner. */
export function buildCreatorEmailContent(body: string, signatureHtml: string): { text: string; html: string } {
  const signatureText = htmlToText(signatureHtml)
  const text = signatureText ? `${body}\n\n-- \n${signatureText}` : body
  const signature = signatureHtml.trim()
    ? `<div style="margin-top:24px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827"><div style="color:#9ca3af">-- </div>${signatureHtml}</div>`
    : ""
  return { text, html: appendSignatureToHtml(bodyTextToHtml(body), signature) }
}

/** Exact full document shared by Preview and Send: simple body, configured
 * sender signature, standard MartPoint header/footer and the banner image. */
export async function renderCreatorEmail(body: string, signatureHtml: string) {
  const content = buildCreatorEmailContent(body, signatureHtml)
  const configuredFooter = await getEmailFooterSettings()
  const footer: EmailFooterOptions = {
    social: configuredFooter.social, contactEmail: configuredFooter.contactEmail,
    phone: configuredFooter.phone, whatsappNumber: configuredFooter.whatsappNumber,
    companyName: configuredFooter.companyName, website: configuredFooter.website,
  }
  return {
    text: content.text,
    html: ensureBrandedHtml(content.html, {
      text: content.text, eyebrow: "Creator Network", title: "Message from MartPoint",
      signoff: "MartPoint Creator Team", footer,
    }),
  }
}
