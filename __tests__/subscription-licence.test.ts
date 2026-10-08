import { describe, it, expect } from "vitest"
import { resolveLicenceFromPlan, licenceLabel } from "@/lib/finance-commercial"

describe("resolveLicenceFromPlan", () => {
  it("derives CLOUD for a recurring cloud plan", () => {
    expect(resolveLicenceFromPlan({ code: "RETAIL_CLOUD_MONTHLY", billing_type: "RECURRING" })).toBe("CLOUD")
  })

  it("derives ERP when the plan code contains ERP", () => {
    expect(resolveLicenceFromPlan({ code: "MARTpoint_ERP_ANNUAL", billing_type: "RECURRING" })).toBe("ERP")
  })

  it("derives OFFLINE for one-time (perpetual) plans", () => {
    expect(resolveLicenceFromPlan({ code: "RETAIL_ONETIME", billing_type: "ONE_TIME" })).toBe("OFFLINE")
  })

  it("prefers an explicit override over the plan-derived type", () => {
    expect(resolveLicenceFromPlan({ code: "RETAIL_CLOUD_MONTHLY", billing_type: "RECURRING" }, "CUSTOM")).toBe("CUSTOM")
  })

  it("is case-insensitive on the plan code", () => {
    expect(resolveLicenceFromPlan({ code: "erp-lite", billing_type: "RECURRING" })).toBe("ERP")
  })

  it("never returns a value influenced by services — only the plan matters", () => {
    // Two plans with identical codes yield identical licences regardless of
    // anything else on the object.
    const a = resolveLicenceFromPlan({ code: "STANDARD", billing_type: "RECURRING" })
    const b = resolveLicenceFromPlan({ code: "STANDARD", billing_type: "RECURRING" })
    expect(a).toBe(b)
    expect(a).toBe("CLOUD")
  })
})

describe("licenceLabel", () => {
  it("returns a human label for every licence type", () => {
    expect(licenceLabel("CLOUD")).toMatch(/Cloud/)
    expect(licenceLabel("ERP")).toMatch(/ERP/)
    expect(licenceLabel("OFFLINE")).toMatch(/Perpetual|Offline/)
    expect(licenceLabel("CUSTOM")).toMatch(/Custom/)
  })
})
