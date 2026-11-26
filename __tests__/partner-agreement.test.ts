import { describe, it, expect } from "vitest"
import { generatePartnerAgreementPdf, type AgreementInput } from "@/lib/partner-agreement"
import { validateAgreementInput } from "@/lib/partner-agreement-validation"
import {
  agreementTypeKeys,
  earningBasesFor,
  CHANNEL_ACQUISITION_COMMISSION_RATE,
  CHANNEL_RENEWAL_COMMISSION_DURATION,
  CHANNEL_RENEWAL_COMMISSION_RATE,
  CHANNEL_RENEWAL_COMMISSION_RULE,
  commercialFieldDefaults,
  defaultTrigger,
} from "@/lib/partner-agreement-content"

function baseInput(partnerType: string): AgreementInput {
  return {
    agreementId: "AGR-MPA-2026-00001",
    effectiveDate: "2026-09-22",
    initialTermMonths: "3",
    renewalRule: "Initial 3-month term; renewal only by mutual written agreement",
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
      gradeByType: "Ungraded — subject to verified business delivery and performance assessment",
      publicDirectoryStatus: "Not yet eligible — subject to successful business delivery and MartPoint approval",
      territory: "Nigeria",
      permittedActivities: "Register opportunities",
      additionalProhibitions: "None",
      insurance: "None required",
      martpointOwnerName: "PM",
      martpointOwnerEmail: "pm@martpoint.com.ng",
    },
    technology: partnerType === "TECHNOLOGY" ? { solutionName: "AcmePOS Bridge", solutionVersion: "v2", approvedUseCase: "Fiscalisation" } : undefined,
    commercials: earningBasesFor(partnerType).map((basis) => {
      const channelCommission = basis.partnerTypeLabel === "Channel Partner" && basis.earningCategory.toLowerCase().includes("commission")
      const implementationFee = basis.earningCategory.toLowerCase().includes("implementation")
      const defaults = commercialFieldDefaults(basis.earningCategory, basis.partnerTypeLabel)
      return ({
        ...defaults,
        earningCategory: basis.earningCategory,
        partnerTypeLabel: basis.partnerTypeLabel,
        trigger: defaultTrigger(basis.earningCategory),
        rateOrFee: channelCommission ? CHANNEL_ACQUISITION_COMMISSION_RATE : implementationFee ? "Agreed per approved Work Order" : "10% of Eligible Revenue",
        rateUnit: channelCommission || !implementationFee ? "PERCENTAGE" : "WORK_ORDER",
        eligibleItems: defaults.eligibleItems || "Software licences",
        eligibleRevenueDefinition: defaults.eligibleRevenueDefinition || "Eligible Revenue as defined in the Agreement.",
        exclusions: defaults.exclusions || "Taxes, refunds and excluded services.",
        attributionRule: defaults.attributionRule || "Written assignment under the applicable Schedule.",
        holdingDays: defaults.holdingDays || "0",
        holdingStartEvent: defaults.holdingStartEvent || "Applicable earning event.",
        renewalRule: defaults.renewalRule || (channelCommission ? CHANNEL_RENEWAL_COMMISSION_RULE : "No automatic renewal commission."),
        renewalRate: channelCommission ? CHANNEL_RENEWAL_COMMISSION_RATE : defaults.renewalRate || "Not applicable",
        renewalDuration: channelCommission ? CHANNEL_RENEWAL_COMMISSION_DURATION : defaults.renewalDuration || "Not applicable",
        reversalRule: defaults.reversalRule || "Refunded or reversed amounts are excluded or clawed back.",
        statementCycle: defaults.statementCycle || "Monthly",
        payoutTiming: defaults.payoutTiming || "Within 15 days of applicable statement issuance, subject to approved conditions.",
        minimumPayoutThreshold: basis.earningCategory.toLowerCase().includes("commission")
          ? "No minimum payout threshold."
          : defaults.minimumPayoutThreshold || "Not applicable",
        currencyAndTaxRule: defaults.currencyAndTaxRule || "NGN unless otherwise agreed in writing; taxes apply as required by law.",
        splitRule: defaults.splitRule || "No duplicate earnings on the same revenue component.",
        financeApprover: "Finance Lead",
        managementApprover: "MD",
      })
    }),
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
  it.each(["REFERRAL", "CHANNEL", "IMPLEMENTATION", "CHANNEL_IMPLEMENTATION", "TECHNOLOGY", "PAYMENT"])(
    "validates complete appointment and commercial sections for %s",
    (partnerType) => {
      const input = baseInput(partnerType)
      expect(validateAgreementInput(input)).toEqual([])
      expect(agreementTypeKeys(partnerType).length).toBeGreaterThan(0)
    }
  )

  it.each([
    ["REFERRAL", ["Referral Partner Terms"]],
    ["CHANNEL", ["Channel Sales and Support Terms"]],
    ["IMPLEMENTATION", ["Implementation Partner Terms"]],
    ["CHANNEL_IMPLEMENTATION", ["Channel Sales and Support Terms", "Implementation Partner Terms"]],
    ["TECHNOLOGY", ["Technology Partner Terms"]],
    ["PAYMENT", ["Payment Provider Terms"]],
  ] as const)("includes only the selected Partner Type schedules for %s", (partnerType, expectedSchedules) => {
    const out = generatePartnerAgreementPdf(baseInput(partnerType))
    const text = pdfText(out.bytes)
    const allTypeSchedules = [
      "Referral Partner Terms",
      "Channel Sales and Support Terms",
      "Implementation Partner Terms",
      "Technology Partner Terms",
      "Payment Provider Terms",
    ]
    const expected = new Set<string>(expectedSchedules)

    for (const schedule of expectedSchedules) {
      expect(out.includedSchedules.some((included) => included.endsWith(schedule))).toBe(true)
      expect(text).toContain(schedule)
    }
    for (const schedule of allTypeSchedules.filter((item) => !expected.has(item))) {
      expect(out.includedSchedules.some((included) => included.endsWith(schedule))).toBe(false)
      expect(text).not.toContain(schedule)
    }
  })

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

  it("keeps Agreement term renewal separate from customer subscription renewal commission", () => {
    const input = baseInput("CHANNEL")
    input.renewalRule = "renews automatically for successive twelve (12) month periods unless either Party gives written notice of non-renewal at least 30 days before expiry"
    const text = pdfText(generatePartnerAgreementPdf(input).bytes)
    expect(text).toContain("successive twelve")
    expect(text).toContain("maximum of two subsequent annual subscription renewals")
    expect(validateAgreementInput({ ...input, renewalRule: "5% commission on renewal subscriptions" })).toContain(
      "The Partner Agreement term clause must contain term-renewal wording only; subscription renewal commissions belong in the relevant Commercial Terms schedule."
    )
  })

  it("uses Work Order fee terms and no software licence revenue basis for Implementation", () => {
    const input = baseInput("CHANNEL_IMPLEMENTATION")
    const implementation = input.commercials.find((c) => c.partnerTypeLabel === "Implementation Partner")!
    expect(implementation.holdingDays).toBe("0")
    expect(implementation.rateUnit).toBe("WORK_ORDER")
    expect(implementation.eligibleRevenueDefinition).toMatch(/Not applicable to implementation fees/)
    expect(implementation.payoutTiming).toMatch(/formal acceptance/)
    expect(implementation.splitRule).toMatch(/distinct implementation services/)
    expect(validateAgreementInput(input)).toEqual([])
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
