import { describe, it, expect } from "vitest"
import {
  buildLeadEmailTemplate,
  LEAD_EMAIL_STAGES,
  LEAD_EMAIL_STAGE_KEYS,
} from "@/lib/lead-email-templates"
import { industryOptions, businessTypeOptions } from "@/lib/industries"

const vars = { firstName: "Ade", fullName: "Adeola Bello", businessName: "FreshMart" }

describe("lead email templates", () => {
  it("packages the four relationship stages", () => {
    expect(LEAD_EMAIL_STAGES.map((s) => s.key)).toEqual([
      "introduction",
      "follow_up",
      "nurture",
      "thank_you",
    ])
    expect(LEAD_EMAIL_STAGE_KEYS).toEqual(LEAD_EMAIL_STAGES.map((s) => s.key))
  })

  it("resolves every stage for every industry with no unresolved placeholders", () => {
    for (const key of LEAD_EMAIL_STAGE_KEYS) {
      for (const industry of industryOptions) {
        const tpl = buildLeadEmailTemplate(key, industry, vars)
        expect(tpl.subject.length, `${key}/${industry} subject`).toBeGreaterThan(10)
        expect(tpl.text.length, `${key}/${industry} text`).toBeGreaterThan(100)
        expect(tpl.bodyHtml, `${key}/${industry} html`).toContain("<p")
        expect(`${tpl.subject}\n${tpl.text}\n${tpl.bodyHtml}`).not.toContain("{{")
        expect(tpl.text).toContain("Ade")
        expect(tpl.industry).toBe(industry)
      }
    }
  })

  it("tailors the introduction copy to the industry's own language", () => {
    const intro = buildLeadEmailTemplate("introduction", "Supermarkets", vars)
    expect(intro.subject).toContain("Supermarkets")
    expect(intro.bodyHtml).toContain("/industries/supermarkets")
    // Supermarket solutions speak of stock tracking, not the generic fallback set.
    expect(intro.text).toContain("Real-Time Stock Tracking")
    expect(intro.text).not.toContain("Daily Reports & Insights")

    const pharmacy = buildLeadEmailTemplate("introduction", "Pharmacies", vars)
    expect(pharmacy.text).not.toBe(intro.text)
  })

  it("resolves business-type form labels to the industry copy", () => {
    expect(buildLeadEmailTemplate("introduction", "Supermarket", vars).industry).toBe("Supermarkets")
    expect(buildLeadEmailTemplate("introduction", "pharmacy", vars).industry).toBe("Pharmacies")
  })

  it("leads the follow-up with the industry's top pain point", () => {
    const tpl = buildLeadEmailTemplate("follow_up", "Supermarkets", vars)
    expect(tpl.subject).toContain("FreshMart")
    expect(tpl.text).toContain("Stockouts During Peak Hours")
  })

  it("keeps the nurture email value-first with numbered ideas", () => {
    const tpl = buildLeadEmailTemplate("nurture", "Restaurants", vars)
    expect(tpl.text).toContain("No pitch today")
    expect(tpl.text).toMatch(/1\. .+\n2\. .+\n3\. /)
  })

  it("uses the category's onboarding language in the thank-you email", () => {
    const restaurants = buildLeadEmailTemplate("thank_you", "Restaurants", vars)
    expect(restaurants.text).toContain("your menu;")
    expect(restaurants.text).toContain("20 sample products")

    const auto = buildLeadEmailTemplate("thank_you", "Auto Parts", vars)
    expect(auto.text).toContain("your parts catalogue;")
  })

  it("falls back to generic copy for unknown industries and missing names", () => {
    const unknown = buildLeadEmailTemplate("introduction", "Bespoke Widget Maker", vars)
    expect(unknown.industry).toBe("")
    expect(unknown.subject).toContain("Growing Businesses")
    expect(unknown.text).toContain("Real-Time Inventory")

    const empty = buildLeadEmailTemplate("introduction", null, {})
    expect(empty.text).toContain("Hi there,")
    expect(empty.text).toContain("your business")
  })

  it("escapes lead details in the HTML body but keeps the text twin readable", () => {
    const tpl = buildLeadEmailTemplate("introduction", "Supermarkets", {
      firstName: "<b>Ade</b>",
      businessName: "Fresh & Mart",
    })
    expect(tpl.bodyHtml).toContain("Fresh &amp; Mart")
    expect(tpl.bodyHtml).not.toContain("<b>Ade</b>")
    expect(tpl.text).toContain("Fresh & Mart")
    expect(tpl.text).toContain("<b>Ade</b>")
  })

  it("points every CTA at the demo page", () => {
    for (const key of LEAD_EMAIL_STAGE_KEYS) {
      const tpl = buildLeadEmailTemplate(key, "Supermarkets", vars)
      expect(tpl.bodyHtml).toContain("/book-demo")
    }
  })

  it("covers every business-type option without throwing", () => {
    for (const businessType of businessTypeOptions) {
      for (const key of LEAD_EMAIL_STAGE_KEYS) {
        expect(() => buildLeadEmailTemplate(key, businessType, vars)).not.toThrow()
      }
    }
  })
})
