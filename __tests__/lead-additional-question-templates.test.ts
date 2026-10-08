import { describe, it, expect } from "vitest"
import {
  LEAD_ADDITIONAL_QUESTION_TEMPLATES,
  STORE_SETUP_FIELDS,
  getLeadAdditionalQuestionTemplate,
  cloneTemplateFields,
} from "@/lib/lead-additional-question-templates"

describe("LEAD_ADDITIONAL_QUESTION_TEMPLATES", () => {
  it("exposes a template per industry with unique names and questions", () => {
    expect(LEAD_ADDITIONAL_QUESTION_TEMPLATES.length).toBeGreaterThanOrEqual(8)

    const industries = LEAD_ADDITIONAL_QUESTION_TEMPLATES.map((t) => t.industry)
    expect(new Set(industries).size).toBe(industries.length)

    for (const template of LEAD_ADDITIONAL_QUESTION_TEMPLATES) {
      expect(template.label.trim()).not.toBe("")
      expect(template.fields.length).toBeGreaterThan(0)

      const names = template.fields.map((f) => f.name)
      expect(new Set(names).size).toBe(names.length)
      for (const field of template.fields) {
        expect(field.name.trim()).not.toBe("")
        expect(field.label.trim()).not.toBe("")
      }
    }
  })

  it("splits migration into separate lettered sample, scope and upload questions", () => {
    for (const template of LEAD_ADDITIONAL_QUESTION_TEMPLATES) {
      const prefixes = new Set(
        template.fields
          .map((f) => f.name.match(/^(.*)_migration_(samples|scope|uploads)$/)?.[1])
          .filter((p): p is string => Boolean(p))
      )

      // Exactly one migration prefix per template, with all three parts present.
      expect(prefixes.size).toBe(1)
      const [prefix] = [...prefixes]

      expect(template.fields.map((f) => f.name)).toEqual(
        expect.arrayContaining([`${prefix}_migration_samples`, `${prefix}_migration_scope`, `${prefix}_migration_uploads`])
      )

      const uploads = template.fields.find((f) => f.name === `${prefix}_migration_uploads`)
      expect(uploads?.type).toBe("text")
      expect(uploads?.helpText?.toLowerCase()).toContain("link")

      const labels = template.fields.filter((f) => f.name.startsWith(`${prefix}_migration_`)).map((f) => f.label)
      expect(labels.some((l) => l.includes("(a)"))).toBe(true)
      expect(labels.some((l) => l.includes("(b)"))).toBe(true)
      expect(labels.some((l) => l.includes("(c)"))).toBe(true)
    }
  })

  it("appends the shared Store Setup block to every industry template", () => {
    for (const template of LEAD_ADDITIONAL_QUESTION_TEMPLATES) {
      const names = template.fields.map((f) => f.name)
      for (const field of STORE_SETUP_FIELDS) {
        expect(names).toContain(field.name)
      }

      // The block opens with a single "section" divider titled Store Setup.
      const sections = template.fields.filter((f) => f.type === "section")
      expect(sections).toHaveLength(1)
      expect(sections[0].label).toBe("Store Setup")
      expect(sections[0].name).toBe("store_setup_intro")

      // It sits at the end of the template, after the industry questions.
      expect(names[names.length - STORE_SETUP_FIELDS.length]).toBe("store_setup_intro")
      expect(names[names.length - 1]).toBe(STORE_SETUP_FIELDS[STORE_SETUP_FIELDS.length - 1].name)
    }
  })

  it("collects the immediate build inputs and never asks for the business name", () => {
    const names = STORE_SETUP_FIELDS.map((f) => f.name)
    expect(names).toEqual([
      "store_setup_intro",
      "store_setup_address",
      "store_setup_phone_whatsapp",
      "store_setup_store_email",
      "store_setup_order_email",
      "store_setup_receipt_footer",
      "store_setup_about_us",
      "store_setup_announcement_bar",
      "store_setup_social_handles",
      "store_setup_online_checkout",
      "store_setup_pay_on_delivery",
      "store_setup_delivery_fees",
      "store_setup_bank_details",
      "store_setup_products",
      "store_setup_product_images",
      "store_setup_product_excel",
      "store_setup_production_sheet",
      "store_setup_user_list",
    ])

    // Business name is already known once a lead has been converted.
    expect(names.some((n) => n === "store_setup_business_name" || /business name/i.test(n))).toBe(false)
    expect(STORE_SETUP_FIELDS.some((f) => /business name/i.test(f.label))).toBe(false)

    const yesNo = STORE_SETUP_FIELDS.filter((f) => f.type === "select")
    expect(yesNo.map((f) => f.name)).toEqual(["store_setup_online_checkout", "store_setup_pay_on_delivery"])
    for (const field of yesNo) expect(field.options).toEqual(["Yes", "No"])

    // Uploads must tell the client to paste a shareable link.
    for (const name of ["store_setup_product_images", "store_setup_product_excel"]) {
      const field = STORE_SETUP_FIELDS.find((f) => f.name === name)
      expect(field?.type).toBe("text")
      expect(field?.helpText?.toLowerCase()).toContain("link")
    }
  })
})

describe("getLeadAdditionalQuestionTemplate", () => {
  it("resolves the printing template by its exact industry name", () => {
    expect(getLeadAdditionalQuestionTemplate("Printing")?.industry).toBe("Printing")
  })

  it("is case- and whitespace-insensitive", () => {
    expect(getLeadAdditionalQuestionTemplate("  printing  ")?.industry).toBe("Printing")
  })

  it("resolves business-type aliases to a canonical template", () => {
    expect(getLeadAdditionalQuestionTemplate("Supermarket")?.industry).toBe("Supermarkets")
    expect(getLeadAdditionalQuestionTemplate("Fast Food")?.industry).toBe("Restaurants")
    expect(getLeadAdditionalQuestionTemplate("Boutiques")?.industry).toBe("Fashion Stores")
    expect(getLeadAdditionalQuestionTemplate("Phone Shops")?.industry).toBe("Electronics Stores")
    expect(getLeadAdditionalQuestionTemplate("Wholesalers")?.industry).toBe("Distributors")
    expect(getLeadAdditionalQuestionTemplate("Laundry")?.industry).toBe("Service Businesses")
  })

  it("returns undefined for an unknown industry", () => {
    expect(getLeadAdditionalQuestionTemplate("Underwater Basket Weaving")).toBeUndefined()
    expect(getLeadAdditionalQuestionTemplate("")).toBeUndefined()
  })
})

describe("cloneTemplateFields", () => {
  it("deep-copies fields so edits do not mutate the template", () => {
    const template = LEAD_ADDITIONAL_QUESTION_TEMPLATES[0]
    const clone = cloneTemplateFields(template)

    expect(clone).toEqual(template.fields)
    expect(clone).not.toBe(template.fields)
    expect(clone[0]).not.toBe(template.fields[0])
  })

  it("keeps Store Setup fields independent between templates", () => {
    const [first, second] = LEAD_ADDITIONAL_QUESTION_TEMPLATES
    const cloneA = cloneTemplateFields(first)
    const cloneB = cloneTemplateFields(second)

    const fieldA = cloneA.find((f) => f.name === "store_setup_receipt_footer")!
    const fieldB = cloneB.find((f) => f.name === "store_setup_receipt_footer")!
    expect(fieldA).not.toBe(fieldB)
  })
})
