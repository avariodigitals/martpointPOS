import { describe, it, expect } from "vitest"
import {
  buildEstimatorOutput,
  estimatorCatalogItems,
  ESTIMATOR_PACKS,
} from "@/lib/internal-estimator"
import { resolveCloudPlans } from "@/lib/pricing-plans"

const plans = resolveCloudPlans(null)

describe("buildEstimatorOutput", () => {
  it("recommends the base plan when the requirement fits its included limits", () => {
    const out = buildEstimatorOutput({ branches: 1, users: 5, products: 500 }, plans)
    expect(out.planId).toBe("basic")
    expect(out.addons).toHaveLength(0)
    expect(out.total).toBe(99999)
    expect(out.items).toHaveLength(1)
    expect(out.items[0].unitPrice).toBe(99999)
  })

  it("adds branch add-ons when branches exceed the plan limit", () => {
    const out = buildEstimatorOutput({ branches: 2, users: 5, products: 500 }, plans)
    expect(out.planId).toBe("basic")
    expect(out.addons).toHaveLength(1)
    expect(out.addons[0].id).toBe("branch")
    expect(out.addons[0].quantity).toBe(1)
    expect(out.addons[0].amount).toBe(50000)
    expect(out.total).toBe(149999)
    // plan line + one add-on line
    expect(out.items).toHaveLength(2)
    expect(out.items[1].quantity).toBe(1)
    expect(out.items[1].unitPrice).toBe(50000)
  })

  it("charges by the user pack (per 5 users) when users exceed the plan limit", () => {
    const out = buildEstimatorOutput({ branches: 1, users: 6, products: 500 }, plans)
    expect(out.planId).toBe("basic")
    expect(out.addons.find((a) => a.id === "users")?.quantity).toBe(1)
    expect(out.total).toBe(99999 + 25000)
    expect(ESTIMATOR_PACKS.users).toBe(5)
  })

  it("charges product packs (per 500) when the catalogue exceeds the plan limit", () => {
    const out = buildEstimatorOutput({ branches: 1, users: 5, products: 1200 }, plans)
    expect(out.planId).toBe("basic")
    expect(out.addons.find((a) => a.id === "products")?.quantity).toBe(2) // 1200 - 500 = 700 → 2 packs
    expect(out.total).toBe(99999 + 2 * 15000)
  })

  it("adds media packs in 5 GB blocks above the plan allowance", () => {
    const out = buildEstimatorOutput({ branches: 1, users: 5, products: 500, mediaGb: 7 }, plans)
    expect(out.addons.find((a) => a.id === "media-5gb")?.quantity).toBe(1)
    expect(out.total).toBe(99999 + 10000)
  })

  it("honours admin price overrides from settings", () => {
    const overridden = resolveCloudPlans({
      pricing: { cloudPlans: [{ id: "basic", price: "₦120,000" }] },
    })
    const out = buildEstimatorOutput({ branches: 1, users: 5, products: 500 }, overridden)
    expect(out.planAnnual).toBe(120000)
    expect(out.total).toBe(120000)
  })

  it("returns warnings when add-ons are required", () => {
    const out = buildEstimatorOutput({ branches: 3, users: 5, products: 500 }, plans)
    expect(out.warnings.length).toBeGreaterThan(0)
  })
})

describe("estimatorCatalogItems", () => {
  it("returns both plans and add-ons from the pricing catalogue", () => {
    const items = estimatorCatalogItems(plans)
    expect(items.some((i) => i.type === "Plan")).toBe(true)
    expect(items.some((i) => i.type === "Add-on")).toBe(true)
    expect(items.find((i) => i.name.includes("Basic"))?.price).toBe(99999)
  })
})
