/* ───────────────────────────  Invoice status derivation (pure, client-safe)  ───────────────────────────
 * Extracted from `finance-commercial.ts` so client components can use these
 * helpers without pulling the server-only finance module (fs/crypto imports)
 * into the browser bundle.
 */

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID" | "CANCELLED" | "WAIVED"
// WAIVED = granted without billing (comped / bundled / internal). Still counts as
// a licence sold in finance reporting, but nothing is owed.

/* ───────────────────────────  Status derivation  ───────────────────────────
 * `invoices.status` is only recomputed by `recalculateInvoice()` — on item
 * edits, payments and allocation. Nothing sweeps invoices on a schedule, so an
 * unpaid invoice whose due_date has passed keeps reading as ISSUED until
 * something happens to touch it.
 *
 * `resolveInvoiceStatus()` derives the true display status from the row so the
 * list shows OVERDUE the day it becomes overdue, without a background job.
 * The stored column is left untouched: it stays the source of truth for
 * anything that recomputes it, and this is presentation-only.
 */
const SETTLED_INVOICE_STATUSES: readonly InvoiceStatus[] = ["PAID", "VOID", "CANCELLED", "WAIVED", "DRAFT"]

/** The minimum an invoice must expose for the status helpers to work. `status`
 *  is a plain string so list rows typed loosely (e.g. from a JSON payload) can
 *  be passed straight in without a cast. */
export type InvoiceStatusInput = {
  status: string
  due_date: string
  balance_due: number
}

/** True when an invoice is issued, still owed, and past its due date. */
export function isInvoiceOverdue(invoice: InvoiceStatusInput, now: Date = new Date()): boolean {
  if (SETTLED_INVOICE_STATUSES.includes(invoice.status as InvoiceStatus)) return false
  if (Number(invoice.balance_due) <= 0) return false
  if (!invoice.due_date) return false
  const due = new Date(invoice.due_date)
  if (Number.isNaN(due.getTime())) return false
  // Compare whole days: an invoice due today is not yet overdue.
  const dueEnd = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999)
  return dueEnd < now
}

/**
 * The status to show for an invoice. Returns the stored status, promoted to
 * OVERDUE when the balance is outstanding and the due date has passed.
 */
export function resolveInvoiceStatus(invoice: InvoiceStatusInput, now: Date = new Date()): InvoiceStatus {
  return isInvoiceOverdue(invoice, now) ? "OVERDUE" : (invoice.status as InvoiceStatus)
}

/**
 * Status a cancelled invoice returns to when reopened. Only issued invoices are
 * billable, so a draft that was never issued (and has no money against it) must
 * not silently become issuable — it goes back to DRAFT for review. Anything else
 * returns to ISSUED, which `recalculateInvoice()` then promotes to
 * PARTIALLY_PAID / PAID / OVERDUE from the payments still on the invoice.
 */
export function reopenInvoiceStatus(invoice: { issued_by?: string | null; amount_paid?: number }): InvoiceStatus {
  return invoice.issued_by || Number(invoice.amount_paid || 0) > 0 ? "ISSUED" : "DRAFT"
}
