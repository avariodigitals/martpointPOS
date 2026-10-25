import { describe, expect, it } from "vitest"
import { callReportFilters, csvCell } from "@/lib/azera-reporting"
import { contactCentreUrl } from "@/lib/contact-centre-links"
describe("Call report filters", () => {
  it("includes whole selected WAT days without losing the final day's calls", () => {
    const filters = callReportFilters(new URLSearchParams({ from: "2026-10-01", to: "2026-10-25", page: "2" }))
    expect(filters).toMatchObject({ from: "2026-09-30T23:00:00.000Z", to: "2026-10-25T23:00:00.000Z", page: 2, pageSize: 25 })
  })
  it.each([{ from: "2026-02-31" }, { from: "tomorrow" }, { from: "2026-10-26", to: "2026-10-25" }, { type: "unsupported" }])("rejects invalid dates and filters", params => {
    expect(() => callReportFilters(new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")))).toThrow()
  })
  it("bounds page numbers and removes PostgREST expression control characters", () => {
    const result = callReportFilters(new URLSearchParams({ page: "-4", search: "Test),status.eq.active,%" }))
    expect(result.page).toBe(1); expect(result.search).not.toMatch(/[(),%]/)
  })
  it("escapes CSV cells and prevents spreadsheet formula execution", () => {
    expect(csvCell('Name, "one"')).toBe('"Name, ""one"""')
    expect(csvCell("=HYPERLINK(1)")).toBe('"\'=HYPERLINK(1)"')
  })
  it("uses a complete website URL for email links", () => {
    expect(new URL(contactCentreUrl("/admin/azera/reports?call=test")).pathname).toBe("/admin/azera/reports")
    expect(contactCentreUrl("//unexpected.example.test")).not.toContain("unexpected.example.test")
  })
})
