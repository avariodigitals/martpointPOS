import { describe, it, expect } from "vitest"
import {
  renderReferralAgreement,
  renderReferralCommissionSchedule,
  renderReferralAcceptanceNotice,
  renderReferralDecisionNotice,
  renderReferralCommissionStatement,
  GENERATED_DOC_TEMPLATE_VERSION,
  type DocControl,
  type PartnerIdentity,
  type ReferralScheduleSummary,
} from "@/lib/partner-doc-templates"

const control: DocControl = {
  documentId: "MPD-2026-00042",
  templateVersion: GENERATED_DOC_TEMPLATE_VERSION,
  generatedAt: "2026-10-13T10:00:00.000Z",
  sourceRecordId: "REF-1",
  status: "ISSUED",
}

const partner: PartnerIdentity = {
  partnerId: "MP-NG-00007",
  legalName: "Iya Salau Ventures",
  displayName: "Iya Salau",
  partnerTypeLabel: "Referral Partner",
  status: "ACTIVE",
  country: "Nigeria",
  state: "Lagos",
  city: "Ikeja",
  partnerSince: "2026-09-01T00:00:00.000Z",
  badgeTier: "SILVER",
}

const schedule: ReferralScheduleSummary = {
  reference: "MCS-2026-00004",
  version: 2,
  status: "EXECUTED",
  firstYearRatePercent: 10,
  firstRenewalRatePercent: 5,
  protectionDays: 90,
  holdingDays: 30,
  payoutDaysAfterMonthEnd: 14,
  effectiveFrom: "2026-10-01",
}

const signatory = { name: "A. MartPoint", title: "Head of Partner Operations", email: "partners@martpoint.com.ng" }

function isPdf(bytes: Buffer) {
  return bytes.length > 500 && bytes.subarray(0, 5).toString("ascii") === "%PDF-"
}

describe("referral controlled documents", () => {
  it("renders the Referral Partner Agreement from the signed schedule", () => {
    const pdf = renderReferralAgreement({
      control,
      partner,
      reference: "AGR-2026-00009",
      effectiveDate: "2026-10-01T00:00:00.000Z",
      schedule,
      eligibleItems: "MartPoint software licence and subscription lines",
      exclusions: "VAT and other taxes, refunds, credits, chargebacks, hardware",
      martpointSignatory: signatory,
      partnerSignatory: { name: "B. Partner", title: "Director", email: "partner@example.com" },
      approvedBy: "A. MartPoint",
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Referral-Agreement")
  })

  it("states no rate when no Commission Schedule is in force", () => {
    const pdf = renderReferralAgreement({
      control,
      partner,
      reference: "AGR-2026-00010",
      effectiveDate: null,
      schedule: null,
      eligibleItems: null,
      exclusions: null,
      martpointSignatory: signatory,
      partnerSignatory: signatory,
      approvedBy: null,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    // 10% must not appear in the body of a schedule-less agreement.
    const text = pdf.bytes.toString("latin1")
    expect(text).not.toContain("10% of")
  })

  it("renders the Commission Schedule with the signed terms", () => {
    const pdf = renderReferralCommissionSchedule({
      control,
      partner,
      reference: schedule.reference,
      version: schedule.version,
      agreementReference: "AGR-2026-00009",
      effectiveFrom: "2026-10-01",
      effectiveTo: null,
      terms: schedule,
      revenueBasis: "ELIGIBLE_COLLECTED_SOFTWARE_REVENUE",
      eligibleItems: "MartPoint software licence and subscription lines",
      exclusions: "VAT, refunds, credits, chargebacks, hardware, implementation, training",
      renewalRule: "FIRST_COLLECTED_RENEWAL_ONLY",
      statementCycle: "MONTHLY",
      approvedSplit: null,
      recordedApprover: signatory,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Referral-Commission-Schedule")
  })

  it("renders an acceptance notice with the protection period", () => {
    const pdf = renderReferralAcceptanceNotice({
      control,
      partner,
      referralReference: "MPR-2026-00031",
      prospectName: "Buka Mama Put",
      submittedAt: "2026-10-01T08:00:00.000Z",
      acceptedAt: "2026-10-02T08:00:00.000Z",
      reviewer: "Sales Lead",
      protectionStart: "2026-10-02T08:00:00.000Z",
      protectionExpiry: "2026-12-31T08:00:00.000Z",
      protectionDays: 90,
      protectionSource: "Signed Commission Schedule MCS-2026-00004",
      martpointOwner: "Sales Lead",
      partnerNextStep: null,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Referral-Acceptance")
  })

  it.each([
    ["INFORMATION REQUIRED", "Provide the prospect's consent record"],
    ["DUPLICATE", "Prospect already recorded with MartPoint"],
    ["REJECTED", "Outside the approved referral scope"],
    ["CLOSED", "Protection expired without conversion"],
  ])("renders a %s decision notice", (decisionLabel, reason) => {
    const pdf = renderReferralDecisionNotice({
      control,
      partner,
      referralReference: "MPR-2026-00032",
      prospectName: "Pharmacy Five Star",
      decisionLabel,
      effectiveDate: "2026-10-05T08:00:00.000Z",
      reason,
      requiredAction: "No action required",
      responseDue: "2026-10-19T08:00:00.000Z",
      attributionEffect: "No new attribution is recorded.",
      commissionEffect: "No commission arises.",
      reviewContact: "partners@martpoint.com.ng",
      decidedBy: "Sales Lead",
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Referral-Decision")
  })

  it("renders a commission statement with lines, adjustments and totals", () => {
    const pdf = renderReferralCommissionStatement({
      control,
      partner,
      currency: "NGN",
      period: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" },
      scheduleReference: schedule.reference,
      lines: [
        {
          referralReference: "MPR-2026-00031",
          customer: "Buka Mama Put",
          invoiceNumber: "INV-2026-00088",
          clearedAt: "2026-09-10T00:00:00.000Z",
          activatedAt: "2026-09-11T00:00:00.000Z",
          eligibleBase: "₦90,000.00",
          rate: "10%",
          amount: "₦9,000.00",
          status: "APPROVED",
          holdingCompletedAt: "2026-10-11T00:00:00.000Z",
          approvedBy: "MartPoint Finance",
          payoutReference: "PAY-2026-00003",
        },
      ],
      adjustments: [
        { date: "2026-09-20T00:00:00.000Z", description: "REFUND against referral MPR-2026-00031", amount: "-₦1,000.00" },
      ],
      totals: { eligible: 9000, approved: 9000, held: 0, reversed: -1000, netPayable: 8000 },
      disputeContact: "partners@martpoint.com.ng",
      disputeDeadline: null,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Referral-Commission-Statement")
  })

  it("renders an empty-period statement without inventing lines", () => {
    const pdf = renderReferralCommissionStatement({
      control,
      partner,
      currency: "NGN",
      period: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" },
      scheduleReference: null,
      lines: [],
      adjustments: [],
      totals: { eligible: 0, approved: 0, held: 0, reversed: 0, netPayable: 0 },
      disputeContact: "partners@martpoint.com.ng",
      disputeDeadline: null,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.pageCount).toBeGreaterThan(0)
  })
})
