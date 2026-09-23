import { describe, expect, it } from "vitest"
import { recalculateQuote } from "../lib/quotations"

describe("recalculateQuote", () => {
  it("computes percentage tax on the discounted line amount", () => {
    const t = recalculateQuote([
      { description: "Item", quantity: 2, unitPrice: 10000, discount: 2000, taxRate: 7.5 },
    ])
    // taxable = 20000 - 2000 = 18000; tax = 1350
    expect(t.items[0].tax).toBeCloseTo(1350)
    expect(t.items[0].lineTotal).toBeCloseTo(19350)
    expect(t.taxAmount).toBeCloseTo(1350)
    expect(t.total).toBeCloseTo(19350)
  })

  it("applies zero tax when taxRate is 0 even if a stale tax amount is present (edited quotes)", () => {
    const t = recalculateQuote([
      // Simulates an edited item: previously saved with VAT (tax 1500), now switched to "No tax".
      { description: "Item", quantity: 1, unitPrice: 20000, discount: 0, taxRate: 0, tax: 1500 },
    ])
    expect(t.items[0].tax).toBe(0)
    expect(t.items[0].lineTotal).toBe(20000)
    expect(t.taxAmount).toBe(0)
    expect(t.total).toBe(20000)
  })

  it("uses the fixed tax amount only when taxRate is null/undefined", () => {
    const t = recalculateQuote([
      { description: "Item", quantity: 1, unitPrice: 10000, discount: 0, taxRate: null, tax: 800 },
      { description: "Other", quantity: 1, unitPrice: 5000, discount: 0, tax: 300 },
    ])
    expect(t.items[0].tax).toBe(800)
    expect(t.items[1].tax).toBe(300)
    expect(t.taxAmount).toBe(1100)
    expect(t.total).toBe(16100)
  })

  it("caps a line discount at the line subtotal", () => {
    const t = recalculateQuote([
      { description: "Item", quantity: 1, unitPrice: 5000, discount: 99999, taxRate: 0 },
    ])
    expect(t.items[0].discount).toBe(5000)
    expect(t.items[0].lineTotal).toBe(0)
    expect(t.total).toBe(0)
  })

  it("applies a percent quote-level discount and reduces tax proportionally", () => {
    const t = recalculateQuote(
      [{ description: "Item", quantity: 1, unitPrice: 100000, discount: 0, taxRate: 10 }],
      { type: "percent", value: 10 }
    )
    // quote discount = 10% of 100000 = 10000; tax on effective 90000 = 9000
    expect(t.quoteDiscountAmount).toBeCloseTo(10000)
    expect(t.items[0].tax).toBeCloseTo(9000)
    expect(t.items[0].lineTotal).toBeCloseTo(99000)
    expect(t.discountAmount).toBeCloseTo(10000)
    expect(t.total).toBeCloseTo(99000)
  })

  it("applies a fixed quote-level discount capped at the net amount", () => {
    const t = recalculateQuote(
      [{ description: "Item", quantity: 1, unitPrice: 50000, discount: 5000, taxRate: 0 }],
      { type: "fixed", value: 60000 }
    )
    // net = 45000; fixed discount capped at 45000
    expect(t.quoteDiscountAmount).toBeCloseTo(45000)
    expect(t.discountAmount).toBeCloseTo(50000)
    expect(t.total).toBe(0)
  })

  it("sums line discounts into discountAmount", () => {
    const t = recalculateQuote([
      { description: "A", quantity: 1, unitPrice: 10000, discount: 1000, taxRate: 0 },
      { description: "B", quantity: 2, unitPrice: 5000, discount: 500, taxRate: 0 },
    ])
    expect(t.subtotal).toBe(20000)
    expect(t.lineDiscountAmount).toBe(1500)
    expect(t.discountAmount).toBe(1500)
    expect(t.total).toBe(18500)
  })
})
