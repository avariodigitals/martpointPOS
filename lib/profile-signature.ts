import type { User } from "./admin-types"
import { readSettings } from "./settings"
import { DEFAULT_PROFILE_SIGNATURE_HTML, OFFICIAL_SIGNATURE_PHONE, prepareProfileSignatureHtml, renderProfileSignatureHtml, type SignatureTemplate } from "./email-signature"
import { normalizeCompanySignatureContacts } from "./email-html"
import { sanitizeSupportHtml } from "./support-html"

export async function getProfileSignatureTemplate(user: Pick<User, "name" | "username" | "email" | "role" | "phone" | "signatureTemplate">): Promise<SignatureTemplate> {
  const settings = await readSettings()
  const general = (settings?.general || {}) as Record<string, unknown>
  const template: SignatureTemplate = {
    name: user.name || user.username,
    title: user.role,
    email: user.email || "",
    company: String(general.companyName || "MartPoint Solutions"),
    extra: "",
    ...user.signatureTemplate,
    phone: OFFICIAL_SIGNATURE_PHONE,
    mobile: OFFICIAL_SIGNATURE_PHONE,
  }
  // Generated signatures always use the approved company contact number;
  // staff profile phone values are never exposed in outbound signatures.
  return template
}

export async function getProfileSignatureHtmlTemplate(): Promise<string> {
  const settings = await readSettings()
  const email = (settings?.email || {}) as Record<string, unknown>
  return normalizeCompanySignatureContacts(prepareProfileSignatureHtml(String(email.profileSignatureHtmlTemplate || DEFAULT_PROFILE_SIGNATURE_HTML), email.profileSignatureScale))
}

export async function resolveProfileSignature(user: User | undefined): Promise<string> {
  if (!user) return ""
  const [fields, templateHtml] = await Promise.all([getProfileSignatureTemplate(user), getProfileSignatureHtmlTemplate()])
  return renderProfileSignatureHtml(sanitizeSupportHtml(templateHtml), fields)
}
