import type { User } from "./admin-types"
import { readSettings } from "./settings"
import { renderSignatureTemplate, usesSupportPhone, type SignatureTemplate } from "./email-signature"

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

export async function resolveProfileSignature(user: User | undefined): Promise<string> {
  if (!user) return ""
  if (!user.signatureTemplate && user.signatureHtml?.trim()) return user.signatureHtml
  return renderSignatureTemplate(await getProfileSignatureTemplate(user))
}
