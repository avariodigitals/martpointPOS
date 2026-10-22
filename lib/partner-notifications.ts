import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, REPLY_TO } from "./email"
import { brandedEmailHtml, escapeHtml } from "./email-templates"

/** Notify the partner team when MartPoint changes a customer's onboarding access. */
export async function notifyPartnerCustomerEvent(
  partnerId: string,
  input: {
    subject: string
    title: string
    businessName: string
    body: string
    link?: string
  }
): Promise<void> {
  if (!isSupabaseConfigured() || !partnerId) return

  const { data } = await supabase
    .from("partner_users")
    .select("email")
    .eq("partner_id", partnerId)
    .eq("status", "ACTIVE")
    .in("role", ["PARTNER_OWNER", "PARTNER_MANAGER", "PARTNER_IMPLEMENTATION"])

  const recipients = Array.from(new Set(((data || []) as { email?: string | null }[]).map((row) => row.email?.trim()).filter(Boolean) as string[]))
  if (recipients.length === 0) return

  const linkBlock = input.link
    ? `\n\nOpen the partner portal: ${input.link}`
    : ""
  const text = `${input.title}\n\nCustomer: ${input.businessName}\n\n${input.body}${linkBlock}`
  const html = brandedEmailHtml(
    `<p style="font-size:18px;font-weight:600;margin:0 0 16px;">${escapeHtml(input.title)}</p>
     <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 8px;"><strong>Customer:</strong> ${escapeHtml(input.businessName)}</p>
     <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px;">${escapeHtml(input.body).replace(/\n/g, "<br />")}</p>
     ${input.link ? `<p style="font-size:14px;line-height:1.6;margin:0;"><a href="${escapeHtml(input.link)}" style="color:#0057FF;">Open the partner portal</a></p>` : ""}`,
    { eyebrow: "Partner Operations", title: input.title, signoff: "MartPoint Partner Operations" }
  )

  await sendEmail({ to: recipients, subject: input.subject, text, html, replyTo: REPLY_TO.partners })
}
