import { escapeHtml } from "./email-html"

export interface SignatureTemplate {
  name: string
  title: string
  email: string
  phone: string
  company: string
  extra: string
}

export const DEFAULT_PROFILE_SIGNATURE_HTML = `<div style="max-width:1000px;padding-right:10px;border-right:3px solid #3678ff;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:15px;line-height:1.4">
  <div style="margin:0 0 4px;font-size:32px;font-weight:bold;color:#120b79">Best Regards</div>
  <div style="padding-bottom:8px;border-bottom:1px solid #4c94a0;font-size:20px;color:#3678f5">{{name}} · MartPoint {{title}} | <a href="https://martpoint.com.ng" style="color:#120b79;text-decoration:none;font-weight:bold">www.martpoint.com.ng</a></div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px"><tr>
    <td width="180" valign="middle" style="padding:0 24px 0 0"><a href="https://martpoint.com.ng" style="display:block;width:145px;height:145px;padding:12px;background-color:#204cf2;text-align:center"><img src="https://martpoint.com.ng/logo-white.png" width="140" alt="MartPoint" style="display:block;width:140px;height:auto;margin-top:50px" /></a></td>
    <td valign="middle" style="font-size:19px;line-height:1.55;color:#111827"><div><strong style="color:#3678f5">T:</strong> {{phone_link}}</div><div><strong style="color:#3678f5">M:</strong> <a href="https://wa.me/2348037978230" style="color:#111827;text-decoration:none">08037978230</a></div><div><strong style="color:#3678f5">E:</strong> {{email_link}}</div><div><strong style="color:#3678f5">A:</strong> MartPoint, Ikeja, Lagos, Nigeria</div>
      <div style="margin-top:10px;font-size:14px"><a href="https://facebook.com/usemartpoint" style="color:#3678f5">Facebook</a> &nbsp; <a href="https://www.youtube.com/@usemartpoint" style="color:#e32620">YouTube</a> &nbsp; <a href="https://www.linkedin.com/company/usemartpoint" style="color:#2875a9">LinkedIn</a> &nbsp; <a href="https://instagram.com/usemartpoint" style="color:#8751a2">Instagram</a> &nbsp; <a href="https://www.tiktok.com/@usemartpoint" style="color:#111827">TikTok</a></div></td>
  </tr></table>
  <div style="margin-top:28px"><a href="https://martpoint.com.ng" style="text-decoration:none"><img src="https://martpoint.com.ng/footerbanner.png" width="1000" alt="One Platform. Every Business." style="display:block;width:100%;max-width:1000px;height:auto" /></a></div>
  <div style="margin-top:24px;color:#929292;font-size:14px;line-height:1.25">The content of this email is confidential and intended for the recipient specified in the message only. It is strictly forbidden to share any part of this message with any third party, without a written consent from the sender. If you received this message by mistake, please reply to this message and follow with its deletion, so that we can ensure such a mistake does not occur in the future.</div>
</div>`

/** Fill the Admin-managed HTML signature using escaped profile data. */
export function renderProfileSignatureHtml(templateHtml: string, fields: SignatureTemplate): string {
  const email = fields.email.trim()
  const phone = fields.phone.trim()
  const values: Record<string, string> = {
    name: fields.name,
    title: fields.title,
    email,
    phone,
    company: fields.company,
    email_link: email ? `<a href="mailto:${escapeHtml(email)}" style="color:#3678f5">${escapeHtml(email)}</a>` : "",
    phone_link: phone ? `<a href="tel:${escapeHtml(phone.replace(/[^+\d]/g, ""))}" style="color:#111827;text-decoration:none">${escapeHtml(phone)}</a>` : "",
  }
  return templateHtml.replace(/\{\{(name|title|email|phone|company|email_link|phone_link)\}\}/gi, (_match, key: string) => {
    const value = values[key.toLowerCase()] || ""
    return ["email_link", "phone_link"].includes(key.toLowerCase()) ? value : escapeHtml(value)
  })
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
