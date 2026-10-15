import { describe, it, expect } from "vitest"
import {
  incomeCategoryForLine,
  buildInvoiceIncomeBuckets,
  INCOME_CATEGORY_ORDER,
  type InvoiceIncomeLine,
} from "@/lib/invoice-income"

const line = (over: Partial<InvoiceIncomeLine>): InvoiceIncomeLine => ({
  item_type: "CUSTOM",
  reference_id: null,
  description: "x",
  quantity: 1,
  unit_price: 0,
  discount: 0,
  tax: 0,
  line_total: 0,
  ...over,
})

describe("incomeCategoryForLine", () => {
  it("splits plans by billing type", () => {
    expect(incomeCategoryForLine(line({ item_type: "PLAN" }), "RECURRING")).toBe("Subscription Revenue")
    expect(incomeCategoryForLine(line({ item_type: "PLAN" }), "ONE_TIME")).toBe("One-Time License")
    expect(incomeCategoryForLine(line({ item_type: "PLAN" }), null)).toBe("Other Income")
  })

  it("maps add-ons, products and services", () => {
    expect(incomeCategoryForLine(line({ item_type: "ADDON" }))).toBe("Add-On Revenue")
    expect(incomeCategoryForLine(line({ item_type: "PRODUCT" }))).toBe("Product Sales")
    expect(incomeCategoryForLine(line({ item_type: "SERVICE" }), null, "logistics")).toBe("Logistics & Delivery")
    expect(incomeCategoryForLine(line({ item_type: "SERVICE" }), null, "training")).toBe("Training Revenue")
    expect(incomeCategoryForLine(line({ item_type: "SERVICE" }), null, null)).toBe("Other Income")
    expect(incomeCategoryForLine(line({ item_type: "CUSTOM" }))).toBe("Other Income")
  })
})

describe("buildInvoiceIncomeBuckets", () => {
  it("aggregates lines per category and keeps tax apart", async () => {
    const buckets = await buildInvoiceIncomeBuckets([
      line({ item_type: "PRODUCT", description: "Receipt printer", unit_price: 45000, tax: 3375, line_total: 48375 }),
      line({ item_type: "PRODUCT", description: "Cash drawer", unit_price: 35000, tax: 2625, line_total: 37625 }),
      line({ item_type: "CUSTOM", description: "Misc", unit_price: 10000, line_total: 10000 }),
      line({ item_type: "SERVICE", description: "Logistics", unit_price: 5000, line_total: 5000 }),
    ])
    const byCat = Object.fromEntries(buckets.map((b) => [b.category, b]))
    expect(byCat["Product Sales"].amount).toBeCloseTo(86000)
    expect(byCat["Product Sales"].tax).toBeCloseTo(6000)
    expect(byCat["Other Income"].amount).toBeCloseTo(15000)
    expect(byCat["Other Income"].descriptions).toContain("Logistics")
  })

  it("drops zero-value lines and orders by the canonical category list", async () => {
    const buckets = await buildInvoiceIncomeBuckets([
      line({ item_type: "CUSTOM", unit_price: 100, line_total: 100 }),
      line({ item_type: "ADDON", unit_price: 0, line_total: 0 }),
      line({ item_type: "PRODUCT", unit_price: 200, line_total: 200 }),
    ])
    expect(buckets.map((b) => b.category)).toEqual(["Product Sales", "Other Income"])
    for (const b of buckets) {
      expect(INCOME_CATEGORY_ORDER.indexOf(b.category)).toBeGreaterThanOrEqual(0)
    }
  })
})
