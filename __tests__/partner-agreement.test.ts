import { describe, it, expect } from "vitest"
import { generatePartnerAgreementPdf, type AgreementInput } from "@/lib/partner-agreement"

function baseInput(partnerType: string): AgreementInput {
  return {
    agreementId: "AGR-MPA-2026-00001",
    effectiveDate: "2026-09-22",
    initialTermMonths: "12",
    renewalRule: "",
    noticeDays: "30",
    disputeDays: "30",
    securityNoticeHours: "4",
    referralProtectionDays: "90",
    liabilityFloor: "NGN 5,000,000",
    partnerType,
    martpoint: {
      legalName: "MartPoint Technologies Ltd",
      registrationNo: "RC123456",
      registeredAddress: "1 Marina Road, Lagos",
      noticeEmail: "legal@martpoint.com.ng",
      signatoryName: "Admin One",
      signatoryTitle: "Director",
      signatoryEmail: "admin@martpoint.com.ng",
    },
    partner: {
      legalName: "Acme Retail Ltd",
      registrationNo: "RC654321",
      registeredAddress: "10 Broad Street, Lagos",
      email: "acme@example.com",
      noticeEmail: "acme@example.com",
      operationsContactName: "Jane Doe",
      operationsContactEmail: "jane@example.com",
      signatoryName: "Jane Doe",
      signatoryTitle: "CEO",
      signatoryEmail: "jane@example.com",
    },
    appointment: {
      levelByType: "Standard",
      gradeByType: "Silver",
      territory: "Nigeria",
      permittedActivities: "Register opportunities",
      additionalProhibitions: "None",
      insurance: "None required",
      martpointOwnerName: "PM",
      martpointOwnerEmail: "pm@martpoint.com.ng",
    },
    technology: partnerType === "TECHNOLOGY" ? { solutionName: "AcmePOS Bridge", solutionVersion: "v2", approvedUseCase: "Fiscalisation" } : undefined,
    commercials: [
      {
        earningCategory: "Referral commission",
        partnerTypeLabel: "Referral Partner",
        eligibleItems: "Software licences",
        rateOrFee: "10% of Eligible Revenue",
        eligibleRevenueDefinition: "As defined in clause 2",
        exclusions: "Hardware, taxes",
        attributionRule: "Registered and accepted lead",
        trigger: "Cleared payment + activation",
        holdingDays: "30",
        holdingStartEvent: "licence activation",
        renewalRule: "First renewal only",
        reversalRule: "Clawed back on refund",
        statementCycle: "Monthly",
        payoutTiming: "15 days after statement",
        currencyAndTaxRule: "NGN, exclusive of VAT",
        splitRule: "No stacking",
        financeApprover: "Finance Lead",
        managementApprover: "MD",
      },
    ],
  }
}

const FORBIDDEN = [
  "AUTOMATION MASTER",
  "Template generation rules",
  "Generation safeguards",
  "INCLUDE IF",
  "Automation implementation specification",
  "Legal review checklist",
  "Agreement state machine",
  "{{",
  "[[",
]

function pdfText(bytes: Buffer): string {
  // jsPDF emits uncompressed text streams by default; good enough for a smoke check.
  return bytes.toString("latin1")
}

describe("generatePartnerAgreementPdf", () => {
  it("includes only the referral schedule for a REFERRAL partner", () => {
    const out = generatePartnerAgreementPdf(baseInput("REFERRAL"))
    expect(out.includedSchedules).toEqual([
      "Schedule One — Appointment Summary",
      "Schedule Two — Referral Partner Terms",
      "Schedule Three — Commercial Terms",
      "Signature Page",
    ])
    const text = pdfText(out.bytes)
    expect(text).toContain("Referral Partner Terms")
    expect(text).not.toContain("Channel Sales and Support Terms")
    expect(text).not.toContain("Implementation Partner Terms")
    expect(text).not.toContain("Technology Partner Terms")
    expect(text).not.toContain("Payment Provider Terms")
    for (const f of FORBIDDEN) expect(text).not.toContain(f)
  })

  it("includes channel + implementation schedules for CHANNEL_IMPLEMENTATION", () => {
    const out = generatePartnerAgreementPdf(baseInput("CHANNEL_IMPLEMENTATION"))
    expect(out.includedSchedules).toEqual([
      "Schedule One — Appointment Summary",
      "Schedule Two — Channel Sales and Support Terms",
      "Schedule Three — Implementation Partner Terms",
      "Schedule Four — Commercial Terms",
      "Signature Page",
    ])
    const text = pdfText(out.bytes)
    // Cross-references are renumbered — Commercial Terms is Schedule Four here.
    expect(text).toContain("Schedule Four")
    expect(text).not.toContain("Schedule Seven")
    expect(text).not.toContain("Referral Partner Terms")
  })

  it("includes the technology schedule and embeds solution details", () => {
    const out = generatePartnerAgreementPdf(baseInput("TECHNOLOGY"))
    const text = pdfText(out.bytes)
    expect(text).toContain("Technology Partner Terms")
    expect(text).toContain("AcmePOS Bridge")
    for (const f of FORBIDDEN) expect(text).not.toContain(f)
  })

  it("rejects an unknown partner type", () => {
    expect(() => generatePartnerAgreementPdf(baseInput("WHOLESALE"))).toThrow()
  })
})
