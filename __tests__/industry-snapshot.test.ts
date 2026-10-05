import { describe, it, expect } from "vitest"
import {
  summarizeIndustries,
  type IndustryBusinessRow,
  type IndustryDeploymentRow,
  type IndustryLeadRow,
} from "@/lib/control-centre"

/** Builds a deployed (ACTIVE) business row. */
function biz(
  id: string,
  industry: string | null,
  businessType: string | null,
  status = "ACTIVE"
): IndustryBusinessRow {
  return { id, industry, business_type: businessType, status }
}

function lead(industry: string | null, businessType: string | null): IndustryLeadRow {
  return { industry, business_type: businessType }
}

const noDeployments: IndustryDeploymentRow[] = []

describe("summarizeIndustries — dashboard counts", () => {
  it("counts distinct industries, not businesses", () => {
    // The user's requirement: "if skincare is two businesses then it reports 2"
    // — i.e. 1 industry (2 businesses), NOT 2 industries.
    const snapshot = summarizeIndustries(
      [],
      [
        biz("a", "Skincare & Organic Cosmetics", "Skincare & Organic Cosmetics"),
        biz("b", "Skincare & Organic Cosmetics", "Skincare & Organic Cosmetics"),
      ],
      noDeployments
    )

    expect(snapshot.industriesDeployed).toBe(1)
    expect(snapshot.totalDeployed).toBe(2)
    expect(snapshot.deployedByIndustry).toEqual([
      { name: "Skincare & Organic Cosmetics", count: 2, canonical: true },
    ])
  })

  it("folds legacy free-text values into the exact industry", () => {
    // Regression: a stored value that is not already canonical used to be taken
    // verbatim, so one real industry appeared as several.
    const snapshot = summarizeIndustries(
      [],
      [
        biz("a", "Fashion Stores", "Fashion Stores"),
        biz("b", "Fashion Retailer", "Fashion Retailer"),
        biz("c", "", "Fashion Retailer"),
        biz("d", null, "Fashion"),
      ],
      noDeployments
    )

    expect(snapshot.deployedByIndustry).toEqual([
      { name: "Fashion Stores", count: 4, canonical: true },
    ])
    expect(snapshot.industriesDeployed).toBe(1)
  })

  it("excludes non-canonical buckets from the industry count", () => {
    const snapshot = summarizeIndustries(
      [],
      [
        biz("a", "Supermarkets", "Supermarkets"),
        biz("b", "Other", "Other"),
        biz("c", "", ""),
        biz("d", "Bespoke Widget Maker", "Bespoke Widget Maker"),
      ],
      noDeployments
    )

    expect(snapshot.industriesDeployed).toBe(1)
    expect(snapshot.totalDeployed).toBe(4)
    expect(snapshot.unresolvedDeployed).toBe(3)

    // Canonical bucket first; the unresolved ones are still listed, just marked.
    expect(snapshot.deployedByIndustry[0]).toEqual({
      name: "Supermarkets",
      count: 1,
      canonical: true,
    })
    expect(snapshot.deployedByIndustry.filter((r) => !r.canonical).map((r) => r.name).sort()).toEqual([
      "Bespoke Widget Maker",
      "Other",
      "Unspecified",
    ])
  })

  it("never reports a blank record as an industry", () => {
    const snapshot = summarizeIndustries([], [biz("a", null, null)], noDeployments)
    expect(snapshot.industriesDeployed).toBe(0)
    expect(snapshot.unresolvedDeployed).toBe(1)
    expect(snapshot.deployedByIndustry).toEqual([
      { name: "Unspecified", count: 1, canonical: false },
    ])
  })

  it("counts a business once even across business and deployment statuses", () => {
    const snapshot = summarizeIndustries(
      [],
      [biz("a", "Pharmacies", "Pharmacy")],
      [
        { business_id: "a", status: "LIVE" },
        { business_id: "a", status: "PROVISIONED" },
      ]
    )
    expect(snapshot.totalDeployed).toBe(1)
    expect(snapshot.industriesDeployed).toBe(1)
  })

  it("counts deployments for businesses that are not ACTIVE", () => {
    const snapshot = summarizeIndustries(
      [],
      [biz("a", "Restaurants", "Restaurant", "ONBOARDING")],
      [{ business_id: "a", status: "LIVE" }]
    )
    expect(snapshot.totalDeployed).toBe(1)
    expect(snapshot.deployedByIndustry).toEqual([
      { name: "Restaurants", count: 1, canonical: true },
    ])
  })

  it("ignores non-deployed businesses and unknown deployment rows", () => {
    const snapshot = summarizeIndustries(
      [],
      [
        biz("a", "Restaurants", "Restaurant", "CHURNED"),
        biz("b", "Restaurants", "Restaurant", "ONBOARDING"),
      ],
      [{ business_id: "ghost", status: "LIVE" }]
    )
    expect(snapshot.totalDeployed).toBe(0)
    expect(snapshot.industriesDeployed).toBe(0)
  })

  it("groups leads by resolved industry and totals them", () => {
    const snapshot = summarizeIndustries(
      [
        lead(null, "Perfume Shops"),
        lead(null, "Beauty & Salons"),
        lead(null, "Mini Mart"), // singular → "Mini Marts"
        lead(null, "Mini Marts"),
        lead(null, "Other"),
        lead(null, "Physiotherapy & Rehabilitation"),
      ],
      [],
      noDeployments
    )

    expect(snapshot.totalLeads).toBe(6)
    const byName = Object.fromEntries(snapshot.leadsByIndustry.map((r) => [r.name, r.count]))
    expect(byName["Mini Marts"]).toBe(2)
    // Regression: "Other" must stay "Other", never "Physiotherapy & Rehabilitation".
    expect(byName["Other"]).toBe(1)
    expect(byName["Physiotherapy & Rehabilitation"]).toBe(1)
  })

  it("returns empty totals for empty input", () => {
    const snapshot = summarizeIndustries([], [], [])
    expect(snapshot).toEqual({
      leadsByIndustry: [],
      deployedByIndustry: [],
      totalLeads: 0,
      totalDeployed: 0,
      industriesDeployed: 0,
      unresolvedDeployed: 0,
    })
  })
})
