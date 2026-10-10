import { describe, it, expect } from "vitest"
import { resolveIndustryName, resolveIndustrySlug, industryOptions, businessTypeOptions } from "@/lib/industries"
import {
  resolveQuoteTemplate,
  quoteTemplateOptions,
  DEFAULT_QUOTE_TEMPLATE,
} from "@/lib/quote-templates"

describe("resolveIndustryName", () => {
  it("maps a business-type form label to the canonical industry name", () => {
    expect(resolveIndustryName("Supermarket")).toBe("Supermarkets")
    expect(resolveIndustryName("Pharmacy")).toBe("Pharmacies")
    expect(resolveIndustryName("Restaurant")).toBe("Restaurants")
  })

  it("registers Processing Plant across business and industry options", () => {
    expect(businessTypeOptions).toContain("Processing Plant")
    expect(industryOptions).toContain("Processing Plant")
    expect(resolveIndustryName("processing-plant")).toBe("Processing Plant")
    expect(resolveIndustrySlug("Processing Plant")).toBe("processing-plant")
    expect(quoteTemplateOptions().some((option) => option.value === "Processing Plant" && option.group === "Enterprise")).toBe(true)
  })

  it("accepts canonical names and slugs", () => {
    expect(resolveIndustryName("Supermarkets")).toBe("Supermarkets")
    expect(resolveIndustryName("supermarkets")).toBe("Supermarkets")
    expect(resolveIndustryName("electronics-stores")).toBe("Electronics Stores")
  })

  it("returns an empty string for empty input and preserves free text", () => {
    expect(resolveIndustryName("")).toBe("")
    expect(resolveIndustryName(null)).toBe("")
    expect(resolveIndustryName("Bespoke Widget Maker")).toBe("Bespoke Widget Maker")
  })

  it("resolves slugs for canonical names", () => {
    expect(resolveIndustrySlug("Supermarket")).toBe("supermarkets")
    expect(resolveIndustrySlug("Pharmacies")).toBe("pharmacies")
  })

  it("does not let a substring hijack a short generic value", () => {
    // Regression: plain `includes()` matched "Other" inside "Physi(other)apy",
    // which applied physiotherapy's 70% payment terms to every "Other" lead and
    // split the dashboard's industry counts.
    expect(resolveIndustryName("Other")).toBe("Other")
    expect(resolveIndustryName("other")).toBe("other")
    expect(resolveIndustryName("Physiotherapy")).toBe("Physiotherapy & Rehabilitation")
  })

  it("merges legacy free-text variants into one canonical industry", () => {
    // Regression: these all resolved to themselves, so one real industry
    // showed up as several and the "industries deployed" count over-reported.
    expect(resolveIndustryName("Fashion Retailer")).toBe("Fashion Stores")
    expect(resolveIndustryName("Skin Care")).toBe("Skincare & Organic Cosmetics")
    expect(resolveIndustryName("skincare")).toBe("Skincare & Organic Cosmetics")
    expect(resolveIndustryName("Mini Mart")).toBe("Mini Marts")
    expect(resolveIndustryName("Frozen Foods (Cow, Pig, Chicken, Fish)")).toBe("Frozen Foods")
  })

  it("still preserves genuinely unknown free text", () => {
    expect(resolveIndustryName("Bespoke Widget Maker")).toBe("Bespoke Widget Maker")
    expect(resolveIndustryName("Zzzz")).toBe("Zzzz")
  })

  it("exposes a non-empty, unique industry option list", () => {
    expect(industryOptions.length).toBeGreaterThan(10)
    expect(new Set(industryOptions).size).toBe(industryOptions.length)
    expect(industryOptions).toContain("Supermarkets")
  })
})

describe("resolveQuoteTemplate", () => {
  it("falls back to the default template", () => {
    expect(resolveQuoteTemplate("")).toEqual(DEFAULT_QUOTE_TEMPLATE)
  })

  it("resolves the supermarkets override (60% deposit)", () => {
    const tpl = resolveQuoteTemplate("Supermarkets")
    expect(tpl.paymentTerms).toContain("60% deposit")
  })

  it("resolves the pharmacies override from a form label (70%)", () => {
    const tpl = resolveQuoteTemplate("Pharmacy")
    expect(tpl.paymentTerms).toContain("70% on acceptance")
  })

  it("resolves the restaurants override (50% / 50%)", () => {
    const tpl = resolveQuoteTemplate("Restaurant")
    expect(tpl.paymentTerms).toContain("50% deposit on acceptance; 50% before go-live")
  })

  it("falls back to the category template for industries without an override", () => {
    const tpl = resolveQuoteTemplate("Grocery Stores")
    expect(tpl.paymentTerms).toContain("60% deposit")
    expect(tpl.publicNotes).not.toBe(DEFAULT_QUOTE_TEMPLATE.publicNotes)
  })

  it("always returns both public notes and payment terms", () => {
    for (const name of industryOptions) {
      const tpl = resolveQuoteTemplate(name)
      expect(tpl.publicNotes.length).toBeGreaterThan(20)
      expect(tpl.paymentTerms.length).toBeGreaterThan(20)
    }
  })
})

describe("quoteTemplateOptions", () => {
  it("includes a General default and industry entries", () => {
    const options = quoteTemplateOptions()
    expect(options[0]).toEqual({ label: "General (default)", value: "", group: "General" })
    expect(options.some((o) => o.value === "Supermarkets")).toBe(true)
  })
})
