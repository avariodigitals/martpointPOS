import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, REPLY_TO } from "./email"
import { brandedEmailHtml, escapeHtml } from "./email-templates"

async function pushPartnerInAppNotification(input: {
  partnerId: string
  type: string
  title: string
  body: string
  link?: string | null
}): Promise<void> {
  if (!isSupabaseConfigured() || !input.partnerId) return
  try {
    const { error } = await supabase.from("partner_notifications").insert({
      partner_id: input.partnerId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link || null,
    })
    if (error) console.error("[partner-notify] in-app insert failed:", error.message)
  } catch (err) {
    console.error("[partner-notify] in-app insert failed:", err)
  }
}

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

  await pushPartnerInAppNotification({
    partnerId,
    type: "CUSTOMER_UPDATE",
    title: input.title,
    body: `${input.businessName}: ${input.body}`,
    link: input.link || "/partner/customers",
  })

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

/** Notify active partner users when MartPoint has issued a quote for them. */
export async function notifyPartnerQuoteIssued(
  partnerId: string,
  input: { quoteNumber: string; total: number; currency: string; link?: string },
): Promise<void> {
  if (!isSupabaseConfigured() || !partnerId) return

  await pushPartnerInAppNotification({
    partnerId,
    type: "QUOTE_ISSUED",
    title: "Your quote is ready",
    body: `Quote ${input.quoteNumber} is ready for review. Total: ${input.currency} ${input.total.toLocaleString()}`,
    link: input.link || "/partner/quotes",
  })

  const { data } = await supabase
    .from("partner_users")
    .select("email")
    .eq("partner_id", partnerId)
    .eq("status", "ACTIVE")
    .in("role", ["PARTNER_OWNER", "PARTNER_MANAGER", "PARTNER_SALES"])

  const recipients = Array.from(new Set(((data || []) as { email?: string | null }[]).map((row) => row.email?.trim()).filter(Boolean) as string[]))
  if (recipients.length === 0) return

  const linkBlock = input.link ? `\n\nOpen Partner Quotes: ${input.link}` : ""
  const text = `A MartPoint quotation is ready for your partner opportunity.\n\nQuote: ${input.quoteNumber}\nTotal: ${input.currency} ${input.total.toLocaleString()}${linkBlock}`
  const html = brandedEmailHtml(
    `<p style="font-size:18px;font-weight:600;margin:0 0 16px;">Your MartPoint quote is ready</p>
     <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 8px;"><strong>Quote:</strong> ${escapeHtml(input.quoteNumber)}</p>
     <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px;"><strong>Total:</strong> ${escapeHtml(input.currency)} ${input.total.toLocaleString()}</p>
     ${input.link ? `<p style="font-size:14px;line-height:1.6;margin:0;"><a href="${escapeHtml(input.link)}" style="color:#0057FF;">Open Partner Quotes</a></p>` : ""}`,
    { eyebrow: "Partner Quotes", title: "Your MartPoint quote is ready", signoff: "MartPoint Sales" },
  )
  await sendEmail({ to: recipients, subject: `MartPoint Quote ${input.quoteNumber} is ready`, text, html, replyTo: REPLY_TO.partners })
}

/** Tell the partner why a submitted payment proof was not accepted. */
export async function notifyPartnerPaymentRejected(
  partnerId: string,
  input: { paymentReference: string; amount: number; currency: string; reason: string; link?: string },
): Promise<void> {
  if (!isSupabaseConfigured() || !partnerId) return
  await pushPartnerInAppNotification({
    partnerId,
    type: "PAYMENT_REJECTED",
    title: "Payment proof needs correction",
    body: `Reference ${input.paymentReference}: ${input.reason}`,
    link: input.link || "/partner/customers",
  })
  const { data } = await supabase
    .from("partner_users")
    .select("email")
    .eq("partner_id", partnerId)
    .eq("status", "ACTIVE")
    .in("role", ["PARTNER_OWNER", "PARTNER_MANAGER", "PARTNER_SALES"])
  const recipients = Array.from(new Set(((data || []) as { email?: string | null }[]).map((row) => row.email?.trim()).filter(Boolean) as string[]))
  if (recipients.length === 0) return

  const linkBlock = input.link ? `\n\nOpen customer Finance: ${input.link}` : ""
  const text = `A payment proof was not accepted by MartPoint Finance.\n\nReference: ${input.paymentReference}\nAmount: ${input.currency} ${input.amount.toLocaleString()}\nReason: ${input.reason}${linkBlock}`
  const html = brandedEmailHtml(
    `<p style="font-size:18px;font-weight:600;margin:0 0 16px;">Payment proof needs correction</p>
     <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 8px;"><strong>Reference:</strong> ${escapeHtml(input.paymentReference)}</p>
     <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 8px;"><strong>Amount:</strong> ${escapeHtml(input.currency)} ${input.amount.toLocaleString()}</p>
     <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px;"><strong>Finance note:</strong> ${escapeHtml(input.reason)}</p>
     ${input.link ? `<p style="font-size:14px;line-height:1.6;margin:0;"><a href="${escapeHtml(input.link)}" style="color:#0057FF;">Open customer Finance</a></p>` : ""}`,
    { eyebrow: "Payment Verification", title: "Payment proof needs correction", signoff: "MartPoint Finance" },
  )
  await sendEmail({ to: recipients, subject: `Payment proof rejected — ${input.paymentReference}`, text, html, replyTo: REPLY_TO.partners })
}
