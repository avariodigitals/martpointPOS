/* ───────────────────────────  Payment confirmation emails  ───────────────────────────
 * Sends a payment confirmation / receipt email to a business's primary contact.
 * Triggered automatically when a payment is confirmed and manually via the
 * "Resend receipt" action in the admin finance UI.
 *
 * Never pass a `route` to sendEmail here — routes fan out to internal
 * notification addresses; these are customer-facing emails only.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, REPLY_TO } from "./email"
import { renderEmailTemplate } from "./email-templates"
import { formatMoney } from "./money-format"
import { generateReceiptPdf } from "./receipt-pdf"
import { createReceipt, logFinanceAudit } from "./finance-commercial"

export interface SendPaymentConfirmationResult {
  ok: boolean
  error?: string
  sentTo?: string
}

/**
 * Sends a payment confirmation email with a receipt PDF attached.
 * - Ensures a receipt exists for the payment (creates one if missing).
 * - Only sends for CONFIRMED payments.
 */
export async function sendPaymentConfirmationEmail(
  paymentId: string,
  actor: { type: "ADMIN" | "SYSTEM"; id?: string } = { type: "SYSTEM" }
): Promise<SendPaymentConfirmationResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" }

  const { data: payment, error } = await supabase
    .from("payments")
    .select("*, businesses:business_id (business_name, primary_contact_name, primary_email)")
    .eq("id", paymentId)
    .single()

  if (error || !payment) return { ok: false, error: error?.message || "Payment not found" }
  if (payment.status !== "CONFIRMED") {
    return { ok: false, error: "Cannot email a receipt for an unconfirmed payment" }
  }

  const biz = payment.businesses as { business_name?: string; primary_contact_name?: string; primary_email?: string } | null
  const to = biz?.primary_email?.trim()
  if (!to) return { ok: false, error: `${biz?.business_name || "Business"} has no email address` }

  // Find a linked invoice number (if any), and an existing receipt.
  let invoiceNumber = ""
  if (payment.invoice_id) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("id", payment.invoice_id)
      .maybeSingle()
    invoiceNumber = (inv as { invoice_number?: string } | null)?.invoice_number || ""
  }

  // Ensure a receipt exists so the email has a stable receipt number.
  let receiptNumber = ""
  const { data: existingReceipt } = await supabase
    .from("receipts")
    .select("receipt_number")
    .eq("payment_id", paymentId)
    .maybeSingle()

  if (existingReceipt) {
    receiptNumber = (existingReceipt as { receipt_number: string }).receipt_number
  } else {
    try {
      const created = await createReceipt(paymentId, actor.id || "")
      receiptNumber = (created as { receipt_number: string }).receipt_number
    } catch (e) {
      console.error("[payment-emails] receipt creation failed:", e)
    }
  }
  if (!receiptNumber) {
    receiptNumber = (payment as { receipt_number?: string }).receipt_number || payment.payment_reference
  }

  const currency = (payment.currency as string) || "NGN"

  const vars = {
    contactName: biz?.primary_contact_name || biz?.business_name || "there",
    businessName: biz?.business_name || "",
    receiptNumber,
    invoiceNumber: invoiceNumber || "—",
    paymentReference: payment.payment_reference,
    amount: formatMoney(payment.amount, currency),
    paymentMethod: String(payment.payment_method || "").replace(/_/g, " "),
    paidAt: payment.paid_at
      ? new Date(payment.paid_at).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })
      : "",
  }

  const tpl = await renderEmailTemplate("payment_received", vars)

  let attachments: { filename: string; content: string }[] | undefined
  try {
    const pdf = generateReceiptPdf({
      receipt_number: receiptNumber,
      invoice_number: invoiceNumber,
      payment_reference: payment.payment_reference,
      amount: payment.amount,
      currency,
      payment_method: payment.payment_method,
      paid_at: payment.paid_at,
      business: biz || {},
    })
    attachments = [{ filename: `MartPoint-Receipt-${receiptNumber}.pdf`, content: pdf.toString("base64") }]
  } catch (e) {
    console.error("[payment-emails] receipt PDF generation failed — sending without attachment:", e)
  }

  const sent = await sendEmail({ to, subject: tpl.subject, text: tpl.text, html: tpl.html, replyTo: REPLY_TO.sales, attachments })
  if (!sent) return { ok: false, error: "Email send failed — check email settings/logs" }

  await logFinanceAudit(
    actor.type,
    actor.id,
    "RECEIPT_ISSUED",
    "RECEIPT",
    paymentId,
    { to, receipt_number: receiptNumber, payment_reference: payment.payment_reference }
  )

  return { ok: true, sentTo: to }
}
