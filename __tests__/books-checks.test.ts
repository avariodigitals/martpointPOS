import { describe, it, expect } from "vitest"
import {
  checkUnbalancedEntries,
  checkUnpostedInvoices,
  checkUnpostedPayments,
  checkVatAnomalies,
  checkDuplicatePayments,
  checkNegativeCash,
  checkArReconciliation,
  computeHealth,
  type EntryInput,
  type InvoiceInput,
  type PaymentInput,
} from "../lib/books-checks"

const invoice = (over: Partial<InvoiceInput>): InvoiceInput => ({
  id: crypto.randomUUID(),
  invoice_number: "INV-001",
  status: "PAID",
  subtotal: 100000,
  discount_amount: 0,
  tax_amount: 7500,
  total_amount: 107500,
  posted_ok: true,
  ...over,
})

const payment = (over: Partial<PaymentInput>): PaymentInput => ({
  id: crypto.randomUUID(),
  payment_reference: "PAY-001",
  invoice_id: "inv-1",
  amount: 107500,
  status: "CONFIRMED",
  date: "2026-10-01",
  posted_ok: true,
  ...over,
})

describe("checkUnbalancedEntries", () => {
  it("passes balanced POSTED entries", () => {
    const entries: EntryInput[] = [
      { id: "1", entry_number: "MJE-2026-00001", status: "POSTED", lines: [{ debit: 100, credit: 0 }, { debit: 0, credit: 100 }] },
    ]
    expect(checkUnbalancedEntries(entries)).toBeNull()
  })

  it("flags entries where debits ≠ credits", () => {
    const entries: EntryInput[] = [
      { id: "1", entry_number: "MJE-2026-00002", status: "POSTED", lines: [{ debit: 100, credit: 0 }, { debit: 0, credit: 90 }] },
    ]
    const f = checkUnbalancedEntries(entries)
    expect(f?.code).toBe("UNBALANCED_ENTRIES")
    expect(f?.severity).toBe("critical")
    expect(f?.samples).toContain("MJE-2026-00002")
  })

  it("ignores VOID entries", () => {
    const entries: EntryInput[] = [
      { id: "1", entry_number: "MJE-2026-00003", status: "VOID", lines: [{ debit: 100, credit: 0 }] },
    ]
    expect(checkUnbalancedEntries(entries)).toBeNull()
  })
})

describe("checkUnpostedInvoices", () => {
  it("flags recognised invoices without a balanced posting", () => {
    const f = checkUnpostedInvoices([invoice({ posted_ok: false })])
    expect(f?.code).toBe("INVOICE_NOT_IN_LEDGER")
    expect(f?.count).toBe(1)
  })

  it("ignores drafts, voids and zero-total invoices", () => {
    expect(checkUnpostedInvoices([invoice({ status: "DRAFT", posted_ok: false })])).toBeNull()
    expect(checkUnpostedInvoices([invoice({ status: "VOID", posted_ok: false })])).toBeNull()
    expect(checkUnpostedInvoices([invoice({ total_amount: 0, posted_ok: false })])).toBeNull()
  })
})

describe("checkUnpostedPayments", () => {
  it("flags confirmed payments missing from the ledger", () => {
    expect(checkUnpostedPayments([payment({ posted_ok: false })])?.code).toBe("PAYMENT_NOT_IN_LEDGER")
  })

  it("ignores pending/failed payments", () => {
    expect(checkUnpostedPayments([payment({ status: "PENDING", posted_ok: false })])).toBeNull()
    expect(checkUnpostedPayments([payment({ status: "FAILED", posted_ok: false })])).toBeNull()
  })
})

describe("checkVatAnomalies", () => {
  it("passes invoices with correct 7.5% VAT", () => {
    expect(checkVatAnomalies([invoice({})], 7.5)).toBeNull()
  })

  it("applies VAT to the discounted base", () => {
    const inv = invoice({ discount_amount: 10000, tax_amount: 6750 }) // (100000-10000)*7.5%
    expect(checkVatAnomalies([inv], 7.5)).toBeNull()
  })

  it("flags wrong non-zero VAT as critical", () => {
    const f = checkVatAnomalies([invoice({ tax_amount: 5000 })], 7.5)
    expect(f?.code).toBe("VAT_ANOMALY")
    expect(f?.severity).toBe("critical")
  })

  it("flags zero VAT on a taxable base as warning, not critical", () => {
    const f = checkVatAnomalies([invoice({ tax_amount: 0 })], 7.5)
    expect(f?.code).toBe("VAT_ANOMALY")
    expect(f?.severity).toBe("warning")
  })

  it("tolerates one-naira rounding", () => {
    expect(checkVatAnomalies([invoice({ tax_amount: 7500.5 })], 7.5)).toBeNull()
  })
})

describe("checkDuplicatePayments", () => {
  it("flags same invoice, same amount, same day", () => {
    const f = checkDuplicatePayments([payment({ payment_reference: "A" }), payment({ payment_reference: "B" })])
    expect(f?.code).toBe("DUPLICATE_PAYMENTS")
    expect(f?.severity).toBe("critical")
  })

  it("allows partial allocations with different amounts", () => {
    const f = checkDuplicatePayments([
      payment({ amount: 50000 }),
      payment({ amount: 57500 }),
    ])
    expect(f).toBeNull()
  })

  it("allows the same amount on different days", () => {
    const f = checkDuplicatePayments([
      payment({ date: "2026-10-01" }),
      payment({ date: "2026-10-02" }),
    ])
    expect(f).toBeNull()
  })
})

describe("checkNegativeCash", () => {
  it("flags negative account balances", () => {
    const f = checkNegativeCash([{ name: "Primary Bank", balance: -250 }])
    expect(f?.code).toBe("NEGATIVE_CASH")
    expect(f?.samples).toContain("Primary Bank")
  })

  it("passes healthy balances", () => {
    expect(checkNegativeCash([{ name: "Cash", balance: 0 }, { name: "Bank", balance: 10 }])).toBeNull()
  })
})

describe("checkArReconciliation", () => {
  it("passes when invoice balances match the ledger", () => {
    expect(checkArReconciliation([{ balance_due: 1000, status: "ISSUED" }], 1000)).toBeNull()
  })

  it("flags a material gap", () => {
    const f = checkArReconciliation([{ balance_due: 1000, status: "ISSUED" }], 700)
    expect(f?.code).toBe("AR_MISMATCH")
    expect(f?.severity).toBe("warning")
  })

  it("ignores settled/non-owed statuses", () => {
    expect(checkArReconciliation([{ balance_due: 500, status: "VOID" }], 0)).toBeNull()
  })
})

describe("computeHealth", () => {
  it("scores 100 with no findings", () => {
    expect(computeHealth([])).toEqual({ health_score: 100, verdict: "HEALTHY" })
  })

  it("deducts 15 per critical and 5 per warning", () => {
    const { health_score } = computeHealth([
      { code: "a", severity: "critical", title: "", detail: "", count: 1 },
      { code: "b", severity: "warning", title: "", detail: "", count: 1 },
    ])
    expect(health_score).toBe(80)
  })

  it("drops to ATTENTION under 60", () => {
    const criticals = Array.from({ length: 3 }, (_, i) => ({
      code: `c${i}`, severity: "critical" as const, title: "", detail: "", count: 1,
    }))
    const warnings = Array.from({ length: 3 }, (_, i) => ({
      code: `w${i}`, severity: "warning" as const, title: "", detail: "", count: 1,
    }))
    expect(computeHealth([...criticals, ...warnings]).verdict).toBe("ATTENTION")
  })
})
