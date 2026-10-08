import { describe, it, expect } from "vitest"
import {
  STORE_SETUP_COMMON,
  STORE_SETUP_TEMPLATES,
  cloneStoreSetupFields,
  generateSetupQuestions,
  getStoreSetupFields,
  getStoreSetupTemplate,
  resolveStoreSetupTemplateKey,
} from "@/lib/store-setup-templates"

describe("STORE_SETUP_TEMPLATES", () => {
  it("exposes unique keys with labels and descriptions", () => {
    const keys = STORE_SETUP_TEMPLATES.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const t of STORE_SETUP_TEMPLATES) {
      expect(t.label.trim()).not.toBe("")
      expect(t.description.trim()).not.toBe("")
    }
  })

  it("includes a skincare template seeded for the skincare client", () => {
    const skincare = STORE_SETUP_TEMPLATES.find((t) => t.key === "skincare")
    expect(skincare).toBeDefined()
    expect(skincare?.label).toBe("Skincare & Cosmetics")
    expect(skincare?.industry?.length ?? 0).toBeGreaterThan(0)
  })
})

describe("resolveStoreSetupTemplateKey", () => {
  it("resolves skincare aliases to the skincare template", () => {
    for (const alias of [
      "skincare",
      "Skincare",
      "  SKINCARE  ",
      "skincare & organic cosmetics",
      "cosmetics stores",
      "beauty & salons",
      "makeup studios",
    ]) {
      expect(resolveStoreSetupTemplateKey(alias)).toBe("skincare")
    }
  })

  it("resolves other business types", () => {
    expect(resolveStoreSetupTemplateKey("Supermarket")).toBe("supermarket")
    expect(resolveStoreSetupTemplateKey("Fast Food")).toBe("restaurant")
    expect(resolveStoreSetupTemplateKey("Boutiques")).toBe("fashion")
    expect(resolveStoreSetupTemplateKey("Pharmacies")).toBe("pharmacy")
    expect(resolveStoreSetupTemplateKey("Printing")).toBe("printing")
    expect(resolveStoreSetupTemplateKey("Wholesalers")).toBe("distribution")
    expect(resolveStoreSetupTemplateKey("Laundry")).toBe("services")
    expect(resolveStoreSetupTemplateKey("Phone Shops")).toBe("retail")
  })

  it("falls back to general retail for unknown or empty input", () => {
    expect(resolveStoreSetupTemplateKey("")).toBe("retail")
    expect(resolveStoreSetupTemplateKey(null)).toBe("retail")
    expect(resolveStoreSetupTemplateKey(undefined)).toBe("retail")
    expect(resolveStoreSetupTemplateKey("Underwater Basket Weaving")).toBe("retail")
  })

  it("honours an existing template key passed directly", () => {
    expect(resolveStoreSetupTemplateKey("skincare")).toBe("skincare")
    expect(resolveStoreSetupTemplateKey("erp")).toBe("erp")
  })
})

describe("getStoreSetupFields", () => {
  it("always includes the common core", () => {
    const fields = getStoreSetupFields("skincare")
    for (const f of STORE_SETUP_COMMON) {
      expect(fields.map((x) => x.key)).toContain(f.key)
    }
  })

  it("appends the skincare industry layer after the common core", () => {
    const common = getStoreSetupFields("retail")
    const skincare = getStoreSetupFields("skincare")
    expect(skincare.length).toBeGreaterThan(common.length)
    expect(skincare.slice(0, STORE_SETUP_COMMON.length).map((f) => f.key)).toEqual(common.map((f) => f.key))
    expect(skincare.map((f) => f.key)).toContain("skinVariants")
    expect(common.map((f) => f.key)).not.toContain("skinVariants")
  })

  it("keeps field keys unique so answers cannot collide", () => {
    for (const template of STORE_SETUP_TEMPLATES) {
      const keys = getStoreSetupFields(template.key).map((f) => f.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it("preserves the legacy onboarding keys existing submissions rely on", () => {
    const keys = STORE_SETUP_COMMON.map((f) => f.key)
    for (const legacy of [
      "brandName",
      "receiptFooter",
      "legalName",
      "storePhone",
      "storeEmail",
      "address",
      "city",
      "state",
      "country",
      "adminName",
      "adminEmail",
      "adminPhone",
      "additionalUsers",
      "branchList",
      "bankName",
      "accountName",
      "accountNumber",
      "paymentVendor",
      "shippingArrangement",
      "goLiveDate",
      "specialRequests",
    ]) {
      expect(keys).toContain(legacy)
    }
  })

  it("asks for the immediate build inputs the ops team flagged", () => {
    const fields = getStoreSetupFields("skincare")
    const byKey = new Map(fields.map((f) => [f.key, f]))
    expect(byKey.get("whatsappNumber")).toBeDefined()
    expect(byKey.get("orderEmail")).toBeDefined()
    expect(byKey.get("aboutUs")).toBeDefined()
    expect(byKey.get("announcementBar")).toBeDefined()
    expect(byKey.get("productExcel")?.type).toBe("file")
    expect(byKey.get("productImages")?.type).toBe("file")
    expect(byKey.get("productionSheet")?.type).toBe("file")
    expect(byKey.get("onlineCheckout")?.options).toEqual(["Yes", "No"])
    expect(byKey.get("payOnDelivery")?.options).toEqual(["Yes", "No"])
  })

  it("never asks for the business name (already known post-conversion)", () => {
    const fields = getStoreSetupFields("skincare")
    // brandName is the STORE display name; there must be no business-name field.
    expect(fields.some((f) => /business name/i.test(f.label))).toBe(false)
  })
})

describe("cloneStoreSetupFields", () => {
  it("deep-copies fields so form edits do not mutate the registry", () => {
    const source = getStoreSetupFields("skincare")
    const clone = cloneStoreSetupFields(source)
    expect(clone).toEqual(source)
    expect(clone[0]).not.toBe(source[0])

    const withOptions = source.find((f) => f.options?.length)
    if (withOptions) {
      const cloneWithOptions = clone.find((f) => f.key === withOptions.key)
      expect(cloneWithOptions?.options).not.toBe(withOptions.options)
    }
  })
})

describe("generateSetupQuestions", () => {
  it("renders section headers and numbered questions", () => {
    const text = generateSetupQuestions("skincare")
    expect(text).toContain("— Branding —")
    expect(text).toContain("1. Brand / store display name")
    expect(text).toContain("Skincare & Cosmetics")
  })

  it("marks optional questions and omits section numbering", () => {
    const text = generateSetupQuestions("retail")
    expect(text).toContain("(optional)")
    expect(text).not.toMatch(/^\d+\. — /m)
  })

  it("reflects the business type so email and form cannot drift", () => {
    expect(generateSetupQuestions("skincare")).toContain("Variants you sell")
    expect(generateSetupQuestions("supermarket")).toContain("expiry dates and batches")
    expect(generateSetupQuestions("skincare")).not.toBe(generateSetupQuestions("supermarket"))
  })
})
