import { describe, expect, it } from "vitest"
import { renderPartnerGradingPolicyPdf } from "@/lib/partner-grading-policy-pdf.mjs"

describe("partner grading policy PDF", () => {
  it("renders the proposed criteria and type-specific tracks in a two-page review PDF", () => {
    const bytes = renderPartnerGradingPolicyPdf({ status: "DRAFT", version: "2.0", criteria: { partnerTypes: ["REFERRAL", "CHANNEL", "IMPLEMENTATION", "TECHNOLOGY", "PAYMENT"], trackCriteria: { CHANNEL: { silverOutcomes: 7, goldOutcomes: 10, platinumOutcomes: 25, silverMinDays: 90, goldMinDays: 183, platinumMinDays: 365, assessmentWindowDays: 240 } } } })
    const pdf = new TextDecoder().decode(bytes)
    expect(pdf).toContain("PROPOSED")
    expect(pdf).toContain("1 / 90 days")
    expect(pdf).toContain("7 / 90 days")
    expect(pdf).toContain("240 days")
    expect(pdf).toContain("Referral Partner")
    expect(pdf).toContain("Technology Partner")
    expect(pdf).toContain("Payment Partner")
    expect(pdf).toContain("8. Approval, effective date and acknowledgement")
    expect(pdf).toContain("/Count 2")
  })

  it("records the actual approval officer, timestamp and effective date in approved output", () => {
    const bytes = renderPartnerGradingPolicyPdf({
      status: "APPROVED",
      version: "1.0",
      approved_by_name: "Management Approver",
      approved_at: "2026-11-26T10:30:00.000Z",
      effective_at: "2026-11-27T00:00:00.000Z",
      silver_outcomes: 1,
      gold_outcomes: 10,
      platinum_outcomes: 25,
      silver_min_days: 90,
      gold_min_days: 183,
      platinum_min_days: 365,
      criteria: { partnerTypes: ["REFERRAL", "CHANNEL", "IMPLEMENTATION", "TECHNOLOGY", "PAYMENT"] },
    })
    const pdf = new TextDecoder().decode(bytes)
    expect(pdf).toContain("APPROVED")
    expect(pdf).toContain("Management Approver")
    expect(pdf).toContain("26 Nov 2026")
    expect(pdf).toContain("27 November 2026")
    expect(pdf).not.toContain("PROPOSED · Not effective")
  })
})
