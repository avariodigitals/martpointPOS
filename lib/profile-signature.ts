import type { User } from "./admin-types"
import { readSettings } from "./settings"
import { DEFAULT_PROFILE_SIGNATURE_HTML, renderProfileSignatureHtml, usesSupportPhone, type SignatureTemplate } from "./email-signature"
import { sanitizeSupportHtml } from "./support-html"

export async function getProfileSignatureTemplate(user: Pick<User, "name" | "username" | "email" | "role" | "phone" | "signatureTemplate">): Promise<SignatureTemplate> {
  const settings = await readSettings()
  const general = (settings?.general || {}) as Record<string, unknown>
  const template: SignatureTemplate = {
    name: user.name || user.username,
    title: user.role,
    email: user.email || "",
    phone: user.phone || "",
    company: String(general.companyName || "MartPoint Solutions"),
    extra: "",
    ...user.signatureTemplate,
  }
  // Resolve shared contact details on both preview and send, so settings changes apply immediately.
  if (usesSupportPhone(user.role)) template.phone = String(general.supportPhone || general.phone || "")
  return template
}

export async function getProfileSignatureHtmlTemplate(): Promise<string> {
  const settings = await readSettings()
  const email = (settings?.email || {}) as Record<string, unknown>
  return String(email.profileSignatureHtmlTemplate || DEFAULT_PROFILE_SIGNATURE_HTML)
}

export async function resolveProfileSignature(user: User | undefined): Promise<string> {
  if (!user) return ""
  const [fields, templateHtml] = await Promise.all([getProfileSignatureTemplate(user), getProfileSignatureHtmlTemplate()])
  return renderProfileSignatureHtml(sanitizeSupportHtml(templateHtml), fields)
}
