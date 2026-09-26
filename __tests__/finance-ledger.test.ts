import { describe, it, expect } from "vitest"
import {
  validateJournalLines,
  computeRunningBalance,
  lineEffect,
  isDebitNature,
} from "@/lib/finance-ledger"

describe("validateJournalLines", () => {
  it("rejects entries with fewer than two lines", () => {
    expect(validateJournalLines([])).toMatch(/at least two lines/)
    expect(validateJournalLines([{ gl_account_id: "a", debit: 100 }])).toMatch(/at least two lines/)
  })

  it("rejects unbalanced entries", () => {
    const err = validateJournalLines([
      { gl_account_id: "bank", debit: 100 },
      { gl_account_id: "income", credit: 90 },
    ])
    expect(err).toMatch(/not balanced/)
  })

  it("rejects lines with both debit and credit, or neither", () => {
    expect(
      validateJournalLines([
        { gl_account_id: "a", debit: 50, credit: 50 },
        { gl_account_id: "b", credit: 50 },
      ]),
    ).toMatch(/both debit and credit/)
    expect(
      validateJournalLines([
        { gl_account_id: "a", debit: 50 },
        { gl_account_id: "b" },
      ]),
    ).toMatch(/debit or credit/)
  })

  it("rejects missing account ids", () => {
    expect(
      validateJournalLines([
        { gl_account_id: "", debit: 50 },
        { gl_account_id: "b", credit: 50 },
      ]),
    ).toMatch(/GL account/)
  })

  it("accepts a balanced entry including multi-line splits", () => {
    expect(
      validateJournalLines([
        { gl_account_id: "ar", debit: 1075 },
        { gl_account_id: "income", credit: 1000 },
        { gl_account_id: "tax", credit: 75 },
      ]),
    ).toBeNull()
  })

  it("handles floating-point amounts without rounding errors", () => {
    expect(
      validateJournalLines([
        { gl_account_id: "a", debit: 0.1 + 0.2 },
        { gl_account_id: "b", credit: 0.3 },
      ]),
    ).toBeNull()
  })
})

describe("lineEffect / isDebitNature", () => {
  it("assets and expenses are debit-nature", () => {
    expect(isDebitNature("ASSET")).toBe(true)
    expect(isDebitNature("EXPENSE")).toBe(true)
    expect(isDebitNature("LIABILITY")).toBe(false)
    expect(isDebitNature("INCOME")).toBe(false)
    expect(isDebitNature("EQUITY")).toBe(false)
  })

  it("computes signed balance effect by account type", () => {
    // Bank debit increases an asset balance; income credit increases income.
    expect(lineEffect("ASSET", 1000, 0)).toBe(100000)
    expect(lineEffect("ASSET", 0, 400)).toBe(-40000)
    expect(lineEffect("INCOME", 0, 1000)).toBe(100000)
    expect(lineEffect("LIABILITY", 250, 0)).toBe(-25000)
    expect(lineEffect("EXPENSE", 200, 0)).toBe(20000)
  })
})

describe("computeRunningBalance", () => {
  it("accumulates debit minus credit from the opening balance", () => {
    const rows = computeRunningBalance(500, [
      { debit: 250, credit: 0 },
      { debit: 0, credit: 100 },
      { debit: 50, credit: 0 },
    ])
    expect(rows.map((r) => r.running_balance)).toEqual([750, 650, 700])
  })

  it("supports negative running balances (overdrawn)", () => {
    const rows = computeRunningBalance(0, [{ debit: 0, credit: 300 }])
    expect(rows[0].running_balance).toBe(-300)
  })
})
