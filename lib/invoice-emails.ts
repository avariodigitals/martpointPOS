/* ───────────────────────────  Invoice emails  ───────────────────────────
 * Sends the invoice email and payment reminders to a business's primary
 * contact. Used by the commercial invoices API (issue / resend / manual
 * reminder) and the daily cron sweep (runInvoiceReminderSweep).
 *
 * Never pass a `route` to sendEmail here — routes fan out to internal
 * notification addresses; these are customer-facing emails only.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, REPLY_TO } from "./email"
import { renderEmailTemplate, escapeHtml } from "./email-templates"
import { formatMoney } from "./money-format"
import { generateInvoicePdf } from "./invoice-pdf"
import { logFinanceAudit } from "./finance-commercial"
import { resolveQuoteTemplate } from "./quote-templates"
import { getPublicSiteSettings } from "./settings"
import { enqueueInvoiceUnpaid } from "./communication-events"
import { appendSupportRecoveryNoticeToEmail, SUPPORT_RECOVERY_NOTICE_TEXT } from "./support-recovery-notice"

const EMAILABLE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "OVERDUE", "PAID"]

/** Automated cadence: first reminder when due in ≤3 days (or already overdue),
 *  then at most one reminder every N days, capped. */
const REMINDER_GAP_MS = 5 * 24 * 60 * 60 * 1000
const MAX_REMINDERS = 6

export interface SendInvoiceEmailResult {
  ok: boolean
  error?: string
  sentTo?: string
}

interface InvoiceItemRow {
  description: string
  quantity: number
  unit_price: number
  discount: number
  tax: number
  line_total: number
}

export async function sendInvoiceEmail(
  invoiceId: string,
  kind: "invoice" | "reminder",
  actor: { type: "ADMIN" | "SYSTEM"; id?: string } = { type: "SYSTEM" }
): Promise<SendInvoiceEmailResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" }

  const { data: inv, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), businesses:business_id (business_name, primary_contact_name, primary_email, industry)")
    .eq("id", invoiceId)
    .single()

  if (error || !inv) return { ok: false, error: error?.message || "Invoice not found" }
  if (!EMAILABLE_STATUSES.includes(inv.status)) {
    return { ok: false, error: `Cannot email a ${String(inv.status).toLowerCase()} invoice` }
  }

  const biz = inv.businesses as { business_name?: string; primary_contact_name?: string; primary_email?: string; industry?: string | null } | null
  const to = biz?.primary_email?.trim()
  if (!to) return { ok: false, error: `${biz?.business_name || "Business"} has no email address` }

  const currency = (inv.currency as string) || "NGN"
  const items = (inv.invoice_items || []) as InvoiceItemRow[]
  const itemsSummary = items.length
    ? items.map((it) => `• ${it.description} — ${it.quantity} × ${formatMoney(it.unit_price, currency)} = ${formatMoney(it.line_total, currency)}`).join("\n")
    : `Invoice total: ${formatMoney(inv.total_amount, currency)}`
  const itemsHtml = items.length
    ? items.map((it) => `${escapeHtml(it.description)} — ${it.quantity} × ${escapeHtml(formatMoney(it.unit_price, currency))} = <strong>${escapeHtml(formatMoney(it.line_total, currency))}</strong>`).join("<br/>")
    : escapeHtml(formatMoney(inv.total_amount, currency))

  const dueDate = new Date(`${inv.due_date}T00:00:00`)
  const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (24 * 60 * 60 * 1000))
  const dueText = daysOverdue > 0
    ? `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`
    : daysOverdue === 0 ? "due today" : `due on ${inv.due_date}`

  const template = resolveQuoteTemplate((inv.template_industry as string | null) || biz?.industry || null)
  const paymentTerms = (inv.payment_terms as string | null) || template.paymentTerms
  const siteSettings = await getPublicSiteSettings()
  const bankDetails = siteSettings.accountNumber.trim() || (inv.bank_details as string | null) || ""
  const paymentUrl = `${(process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng").replace(/\/$/, "")}/pay/invoice/${encodeURIComponent(invoiceId)}`

  const vars = {
    contactName: biz?.primary_contact_name || biz?.business_name || "there",
    businessName: biz?.business_name || "",
    invoiceNumber: inv.invoice_number,
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    itemsSummary,
    itemsHtml,
    total: formatMoney(inv.total_amount, currency),
    balance: formatMoney(inv.balance_due, currency),
    notes: inv.notes_public || "",
    paymentTerms,
    bankDetails,
    dueText,
  }

  const tpl = await renderEmailTemplate(kind === "reminder" ? "invoice_payment_reminder" : "invoice_sent", vars)
  const emailText = `${tpl.text.trimEnd()}\n\nPay online: ${paymentUrl}\n${bankDetails ? `Bank transfer details:\n${bankDetails}\n` : ""}\n${SUPPORT_RECOVERY_NOTICE_TEXT}`
  const paymentBlock = `<p style="margin:24px 0"><a href="${escapeHtml(paymentUrl)}" style="display:inline-block;background:#1769e0;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Pay invoice online</a></p>${bankDetails ? `<p><strong>Bank transfer details</strong><br/>${escapeHtml(bankDetails).replace(/\r?\n/g, "<br/>")}</p>` : ""}`
  const htmlWithPayment = tpl.html ? (/<\/body>/i.test(tpl.html) ? tpl.html.replace(/<\/body>/i, `${paymentBlock}</body>`) : `${tpl.html}${paymentBlock}`) : undefined
  const emailHtml = htmlWithPayment ? appendSupportRecoveryNoticeToEmail(htmlWithPayment) : undefined

  let attachments: { filename: string; content: string }[] | undefined
  try {
    const pdf = generateInvoicePdf({
      invoice_number: inv.invoice_number,
      currency,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      status: inv.status,
      subtotal: inv.subtotal,
      discount_amount: inv.discount_amount,
      tax_amount: inv.tax_amount,
      total_amount: inv.total_amount,
      amount_paid: inv.amount_paid,
      balance_due: inv.balance_due,
      notes_public: inv.notes_public,
      payment_terms: paymentTerms,
      bank_details: bankDetails,
      payment_link: paymentUrl,
      template_industry: inv.template_industry,
      items,
      business: biz || {},
    })
    attachments = [{ filename: `MartPoint-Invoice-${inv.invoice_number}.pdf`, content: pdf.toString("base64") }]
  } catch (e) {
    console.error("[invoice-pdf] generation failed — sending without attachment:", e)
  }

  const sent = await sendEmail({ to, subject: tpl.subject, text: emailText, html: emailHtml, replyTo: REPLY_TO.sales, attachments })
  if (!sent) return { ok: false, error: "Email send failed — check email settings/logs" }

  const update =
    kind === "reminder"
      ? { last_reminder_at: new Date().toISOString(), reminder_count: (inv.reminder_count || 0) + 1, updated_at: new Date().toISOString() }
      : { invoice_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  await supabase.from("invoices").update(update).eq("id", invoiceId)

  await logFinanceAudit(
    actor.type,
    actor.id,
    kind === "reminder" ? "INVOICE_REMINDER_SENT" : "INVOICE_EMAIL_SENT",
    "INVOICE",
    invoiceId,
    { to, invoice_number: inv.invoice_number }
  )

  return { ok: true, sentTo: to }
}

/* ─── Automated reminder sweep (called by /api/cron/invoice-reminders) ─── */

export async function runInvoiceReminderSweep(): Promise<{ sent: number; failed: number; skipped: number; markedOverdue: number }> {
  if (!isSupabaseConfigured()) return { sent: 0, failed: 0, skipped: 0, markedOverdue: 0 }

  const today = new Date().toISOString().slice(0, 10)

  // Invoice status only moves to OVERDUE inside recalculateInvoice, which runs
  // on payment/edit events — a never-touched invoice would stay ISSUED forever.
  // Flip unpaid ISSUED invoices past their due date here (matches recalc logic,
  // which keeps PARTIALLY_PAID as-is).
  const { data: overdueRows } = await supabase
    .from("invoices")
    .update({ status: "OVERDUE", updated_at: new Date().toISOString() })
    .eq("status", "ISSUED")
    .lt("due_date", today)
    .gt("balance_due", 0)
    .select("id,business_id")
  const markedOverdue = overdueRows?.length ?? 0
  const horizon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const workflowInvoices = await supabase.from("invoices").select("id")
    .in("status", ["ISSUED", "PARTIALLY_PAID", "OVERDUE"]).eq("reminders_paused", false)
    .gt("balance_due", 0).lte("due_date", horizon).limit(1000)
  if (workflowInvoices.error) console.error("[invoice-reminders] could not load invoices for workflow triggers:", workflowInvoices.error.message)
  else await enqueueInvoiceUnpaid((workflowInvoices.data || []).map((row) => row.id))
    .catch((eventError) => console.error("[invoice-reminders] invoice workflow enqueue failed:", eventError))

  // An enabled invoice workflow owns the reminder sequence for eligible
  // invoices. Running the legacy daily email sweep alongside it would send a
  // second email before the workflow's configured delay/review step.
  const invoiceWorkflow = await supabase.from("communication_workflows").select("id")
    .eq("trigger", "invoice_unpaid").eq("enabled", true).limit(1).maybeSingle()
  if (invoiceWorkflow.error) console.error("[invoice-reminders] could not verify invoice workflow ownership:", invoiceWorkflow.error.message)
  else if (invoiceWorkflow.data) return { sent: 0, failed: 0, skipped: workflowInvoices.data?.length || 0, markedOverdue }

  const { data: rows, error } = await supabase
    .from("invoices")
    .select("id, due_date, last_reminder_at, reminder_count")
    .in("status", ["ISSUED", "PARTIALLY_PAID", "OVERDUE"])
    .eq("reminders_paused", false)
    .gt("balance_due", 0)
    .lte("due_date", horizon)
    .order("due_date", { ascending: true })
    .limit(100)

  if (error) {
    console.error("[invoice-reminders] query failed:", error.message)
    return { sent: 0, failed: 0, skipped: 0, markedOverdue }
  }

  let sent = 0
  let failed = 0
  let skipped = 0
  for (const r of (rows || []) as { id: string; last_reminder_at: string | null; reminder_count: number | null }[]) {
    if ((r.reminder_count ?? 0) >= MAX_REMINDERS) {
      skipped++
      continue
    }
    if (r.last_reminder_at && Date.now() - new Date(r.last_reminder_at).getTime() < REMINDER_GAP_MS) {
      skipped++
      continue
    }
    const res = await sendInvoiceEmail(r.id, "reminder")
    if (res.ok) sent++
    else failed++
  }
  return { sent, failed, skipped, markedOverdue }
}
