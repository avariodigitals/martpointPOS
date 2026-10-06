import { describe, it, expect } from "vitest"
import {
  LEAD_ADDITIONAL_QUESTION_TEMPLATES,
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
})
