import { escapeHtml } from "./email-html"

export interface SignatureTemplate {
  name: string
  title: string
  email: string
  phone: string
  company: string
  extra: string
}

export function usesSupportPhone(role: string): boolean {
  return ["Customer Care", "Tech"].includes(role)
}

/** Plain fields become email-safe HTML; users never need to edit markup. */
export function renderSignatureTemplate(template: SignatureTemplate): string {
  const lines = [
    template.name.trim() ? `<strong>${escapeHtml(template.name.trim())}</strong>` : "",
    escapeHtml(template.title.trim()),
    escapeHtml(template.company.trim()),
    template.phone.trim() ? `<a href="tel:${escapeHtml(template.phone.replace(/[^+\d]/g, ""))}">${escapeHtml(template.phone.trim())}</a>` : "",
    template.email.trim() ? `<a href="mailto:${escapeHtml(template.email.trim())}">${escapeHtml(template.email.trim())}</a>` : "",
    ...template.extra.split(/\r?\n/).map((line) => escapeHtml(line.trim())),
  ].filter(Boolean)
  return lines.length ? `<p>${lines.join("<br>")}</p>` : ""
}
