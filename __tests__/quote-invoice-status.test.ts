import { describe, expect, it } from "vitest"
import {
  isQuoteExpired,
  resolveQuoteStatus,
  quoteStatusLabel,
  quoteStatusClass,
} from "../lib/quotations"
import {
  isInvoiceOverdue,
  resolveInvoiceStatus,
  type InvoiceStatus,
} from "../lib/finance-commercial"

/* These helpers are presentation-only derivations: they must never change what
 * is stored, only what is shown. The tests pin the exact boundaries (the day of
 * expiry is not yet expired) because an off-by-one here would silently flip
 * every quote sent with a same-day validity. */

const NOW = new Date("2026-10-08T12:00:00.000Z")

describe("resolveQuoteStatus", () => {
  it("promotes a SENT quote to EXPIRED once valid_until has passed", () => {
    expect(resolveQuoteStatus({ status: "SENT", valid_until: "2026-10-01" }, NOW)).toBe("EXPIRED")
  })

  it("keeps SENT while the validity window is still open", () => {
    expect(resolveQuoteStatus({ status: "SENT", valid_until: "2026-11-01" }, NOW)).toBe("SENT")
  })

  it("does not expire a quote that is due today", () => {
    // Boundary: valid_until midnight today is still within the day.
    expect(resolveQuoteStatus({ status: "SENT", valid_until: "2026-10-08T23:59:59.000Z" }, NOW)).toBe("SENT")
  })

  it("leaves SENT alone when no validity date was set", () => {
    expect(resolveQuoteStatus({ status: "SENT", valid_until: null }, NOW)).toBe("SENT")
  })

  it("never overrides a closed deal", () => {
    // A stale valid_until must not rewrite history on accepted/converted quotes.
    expect(resolveQuoteStatus({ status: "ACCEPTED", valid_until: "2026-01-01" }, NOW)).toBe("ACCEPTED")
    expect(resolveQuoteStatus({ status: "CONVERTED", valid_until: "2026-01-01" }, NOW)).toBe("CONVERTED")
  })

  it("keeps DECLINED more informative than EXPIRED", () => {
    expect(resolveQuoteStatus({ status: "DECLINED", valid_until: "2026-01-01" }, NOW)).toBe("DECLINED")
  })

  it("does not expire a DRAFT that was never sent", () => {
    expect(resolveQuoteStatus({ status: "DRAFT", valid_until: "2026-01-01" }, NOW)).toBe("DRAFT")
  })

  it("expires quotes that are mid-negotiation", () => {
    // A change request / counter offer is still awaiting a decision, so the
    // validity window applies to it too.
    expect(resolveQuoteStatus({ status: "CHANGE_REQUESTED", valid_until: "2026-09-01" }, NOW)).toBe("EXPIRED")
    expect(resolveQuoteStatus({ status: "COUNTER_OFFERED", valid_until: "2026-09-01" }, NOW)).toBe("EXPIRED")
    expect(resolveQuoteStatus({ status: "REVISED", valid_until: "2026-09-01" }, NOW)).toBe("EXPIRED")
  })

  it("ignores an unparseable valid_until instead of throwing", () => {
    expect(resolveQuoteStatus({ status: "SENT", valid_until: "not-a-date" }, NOW)).toBe("SENT")
  })

  it("treats a stored EXPIRED status as expired regardless of date", () => {
    expect(resolveQuoteStatus({ status: "EXPIRED", valid_until: "2026-11-01" }, NOW)).toBe("EXPIRED")
  })
})

describe("isQuoteExpired", () => {
  it("reports true only for expirable statuses past their date", () => {
    expect(isQuoteExpired({ status: "SENT", valid_until: "2026-10-01" }, NOW)).toBe(true)
    expect(isQuoteExpired({ status: "ACCEPTED", valid_until: "2026-10-01" }, NOW)).toBe(false)
    expect(isQuoteExpired({ status: "SENT", valid_until: null }, NOW)).toBe(false)
  })
})

describe("quoteStatusLabel / quoteStatusClass", () => {
  it("humanises snake_case statuses", () => {
    expect(quoteStatusLabel("CHANGE_REQUESTED")).toBe("Change requested")
    expect(quoteStatusLabel("SENT")).toBe("Sent")
    expect(quoteStatusLabel("EXPIRED")).toBe("Expired")
  })

  it("gives EXPIRED a visually distinct class from SENT", () => {
    // The whole point of the change: an expired quote must not look like a live one.
    expect(quoteStatusClass("EXPIRED")).not.toBe(quoteStatusClass("SENT"))
  })

  it("falls back to a default class for unknown statuses", () => {
    expect(quoteStatusClass("SOMETHING_NEW")).toContain("bg-")
  })
})

/* ── invoices ── */

const invoice = (
  status: InvoiceStatus,
  due_date: string,
  balance_due: number
) => ({ status, due_date, balance_due })

describe("resolveInvoiceStatus", () => {
  it("promotes an unpaid ISSUED invoice to OVERDUE after the due date", () => {
    expect(resolveInvoiceStatus(invoice("ISSUED", "2026-10-01", 5000), NOW)).toBe("OVERDUE")
  })

  it("keeps ISSUED while the due date is in the future", () => {
    expect(resolveInvoiceStatus(invoice("ISSUED", "2026-11-01", 5000), NOW)).toBe("ISSUED")
  })

  it("does not flag an invoice that is due today", () => {
    // Boundary: an invoice due today still has the rest of the day to be paid.
    expect(resolveInvoiceStatus(invoice("ISSUED", "2026-10-08", 5000), NOW)).toBe("ISSUED")
  })

  it("promotes a partially paid overdue invoice too", () => {
    expect(resolveInvoiceStatus(invoice("PARTIALLY_PAID", "2026-10-01", 2500), NOW)).toBe("OVERDUE")
  })

  it("never marks a fully settled invoice overdue", () => {
    expect(resolveInvoiceStatus(invoice("PAID", "2026-10-01", 0), NOW)).toBe("PAID")
    expect(resolveInvoiceStatus(invoice("VOID", "2026-10-01", 5000), NOW)).toBe("VOID")
    expect(resolveInvoiceStatus(invoice("CANCELLED", "2026-10-01", 5000), NOW)).toBe("CANCELLED")
    expect(resolveInvoiceStatus(invoice("WAIVED", "2026-10-01", 5000), NOW)).toBe("WAIVED")
  })

  it("never marks a DRAFT overdue", () => {
    expect(resolveInvoiceStatus(invoice("DRAFT", "2026-01-01", 5000), NOW)).toBe("DRAFT")
  })

  it("does not flag overdue when nothing is owed even if the date passed", () => {
    // A zero-balance ISSUED row (e.g. fully paid but not yet recalculated) is
    // not a debt, so it must not be reported as overdue.
    expect(resolveInvoiceStatus(invoice("ISSUED", "2026-01-01", 0), NOW)).toBe("ISSUED")
  })

  it("ignores an unparseable due_date instead of throwing", () => {
    expect(resolveInvoiceStatus(invoice("ISSUED", "nonsense", 5000), NOW)).toBe("ISSUED")
  })

  it("keeps a stored OVERDUE status as overdue", () => {
    expect(resolveInvoiceStatus(invoice("OVERDUE", "2026-11-01", 5000), NOW)).toBe("OVERDUE")
  })
})

describe("isInvoiceOverdue", () => {
  it("requires an outstanding balance", () => {
    expect(isInvoiceOverdue(invoice("ISSUED", "2026-10-01", 100), NOW)).toBe(true)
    expect(isInvoiceOverdue(invoice("ISSUED", "2026-10-01", 0), NOW)).toBe(false)
  })

  it("does not throw on a missing due date", () => {
    expect(isInvoiceOverdue(invoice("ISSUED", "", 100), NOW)).toBe(false)
  })
})
