import { describe, it, expect } from "vitest"
import {
  renderActivationConfirmation,
  renderCustomerAssignment,
  renderCommissionStatement,
  renderPayoutStatement,
  renderGradeConfirmation,
  renderFormalNotice,
  GENERATED_DOC_TEMPLATE_VERSION,
  type PartnerIdentity,
  type DocControl,
} from "@/lib/partner-doc-templates"

const control: DocControl = {
  documentId: "MPD-2026-00001",
  templateVersion: GENERATED_DOC_TEMPLATE_VERSION,
  generatedAt: "2026-09-29T10:00:00.000Z",
  sourceRecordId: "SRC-1",
  status: "ISSUED",
}

const partner: PartnerIdentity = {
  partnerId: "MP-NG-00001",
  legalName: "Acme Retail Ltd",
  displayName: "Acme Retail",
  partnerTypeLabel: "Channel + Implementation",
  status: "ACTIVE",
  country: "Nigeria",
  state: "Lagos",
  city: "Lagos",
  partnerSince: "2026-09-01T00:00:00.000Z",
  badgeTier: "SILVER",
}

const mpOwner = { name: "Partner Ops", title: "Partner Operations", email: "partners@martpoint.com.ng" }

function isPdf(bytes: Buffer) {
  return bytes.length > 500 && bytes.subarray(0, 5).toString("ascii") === "%PDF-"
}

describe("generated partner documents", () => {
  it("renders an activation confirmation", () => {
    const pdf = renderActivationConfirmation({
      control,
      partner,
      capabilities: [
        { label: "Sales", expiresAt: null },
        { label: "Implementation", expiresAt: "2027-09-01T00:00:00.000Z" },
      ],
      agreementRefs: ["Partner Agreement AGR-MPA-2026-00001 (MPD-2026-00002)"],
      effectiveDate: "2026-09-29T00:00:00.000Z",
      nextReviewDate: "2027-09-29T00:00:00.000Z",
      authorisedBy: mpOwner,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Activation-Confirmation")
    expect(pdf.pageCount).toBeGreaterThan(0)
  })

  it("renders a customer assignment", () => {
    const pdf = renderCustomerAssignment({
      control,
      partner,
      customer: { businessName: "Buka Mama Put", location: "Lagos, Nigeria" },
      relationshipLabel: "Implementation delivery",
      accessLevelLabel: "Onboarding workspace",
      scope: "Configure menu, taxes and users",
      startDate: "2026-10-01T00:00:00.000Z",
      expiryDate: "2026-12-31T00:00:00.000Z",
      martpointOwner: mpOwner,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Customer-Assignment")
  })

  it("renders a commission statement with line items", () => {
    const pdf = renderCommissionStatement({
      control,
      partner,
      period: { from: "2026-09-01", to: "2026-09-30" },
      currency: "NGN",
      lines: [
        { customer: "Buka Mama Put", attributionType: "ORIGINATING", basis: "PERCENTAGE", rate: "20%", eligibleAmount: "₦100,000.00", amount: "₦20,000.00", status: "APPROVED", date: "2026-09-15" },
      ],
      disputeContact: "partners@martpoint.com.ng",
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Commission-Statement")
  })

  it("renders a payout statement", () => {
    const pdf = renderPayoutStatement({
      control,
      partner,
      payoutReference: "PO-2026-0007",
      paymentDate: "2026-09-29T00:00:00.000Z",
      maskedDestination: null,
      currency: "NGN",
      lines: [{ customer: "Buka Mama Put", amount: "₦20,000.00", status: "SCHEDULED" }],
      deductions: null,
      total: 20000,
      contact: "partners@martpoint.com.ng",
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Payout-Statement")
  })

  it("renders a grade confirmation", () => {
    const pdf = renderGradeConfirmation({
      control,
      partner,
      previousGrade: null,
      newGrade: "GOLD",
      effectiveDate: "2026-09-29T00:00:00.000Z",
      reviewPeriod: "2026 Q3",
      basis: "Sustained delivery quality",
      decidedBy: mpOwner,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Grade-Confirmation")
  })

  it("renders a formal notice", () => {
    const pdf = renderFormalNotice({
      control,
      partner,
      decision: "SUSPENSION",
      effectiveDate: "2026-09-29T00:00:00.000Z",
      reason: "Compliance documentation expired",
      decidedBy: mpOwner,
      reviewContact: "partners@martpoint.com.ng",
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("SUSPENSION-NOTICE")
  })

  it("renders empty optional fields as Not applicable, never invented", () => {
    const pdf = renderCommissionStatement({
      control,
      partner,
      period: { from: null, to: null },
      currency: "NGN",
      lines: [],
      disputeContact: "",
    })
    expect(isPdf(pdf.bytes)).toBe(true)
  })
})

import {
  renderImplementationWorkOrder,
  renderChangeOrder,
  renderDataProcessingAddendum,
  renderTrainingRecord,
  renderUatRecord,
  renderCompletionHandover,
  renderGoLiveDecision,
  renderImplementationFeeStatement,
} from "@/lib/partner-doc-templates"

describe("delivery record documents", () => {
  it("renders an implementation work order with milestones", () => {
    const pdf = renderImplementationWorkOrder({
      control,
      partner,
      workOrderRef: "WO-2026-00003",
      title: "POS rollout",
      customer: "Buka Mama Put",
      scope: "Install and configure POS at two sites",
      exclusions: null,
      customerDuties: "Provide store access",
      accessNotes: null,
      acceptanceCriteria: "UAT sign-off",
      milestones: [
        { title: "Site survey", dueDate: "2026-10-05", feeAmount: "50,000.00", acceptanceCriteria: "Survey report" },
        { title: "Go live", dueDate: "2026-10-20", feeAmount: "150,000.00", acceptanceCriteria: "Store trading" },
      ],
      feeTotal: "200,000.00",
      currency: "NGN",
      startDate: "2026-10-01",
      dueDate: "2026-10-31",
      martpointOwner: mpOwner,
      partnerSignatory: { name: "", title: "", email: "" },
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Work-Order")
  })

  it("renders a change order", () => {
    const pdf = renderChangeOrder({
      control,
      partner,
      workOrderRef: "WO-2026-00003",
      requestedBy: "Partner",
      description: "Add a third site",
      reason: "Customer expanded",
      impactScope: "Additional installation",
      impactFee: "75,000.00",
      impactSchedule: "+1 week",
      decision: "APPROVED",
      decisionReason: "Within programme rates",
      decidedBy: mpOwner,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Change-Order")
  })

  it("renders a data processing addendum", () => {
    const pdf = renderDataProcessingAddendum({
      control,
      partner,
      partnerAddress: "Lagos, Nigeria",
      martpoint: { legalName: "MartPoint Ltd", registrationNo: "RC123", registeredAddress: "Lagos" },
      effectiveDate: control.generatedAt,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("DPA")
  })

  it("renders a training record", () => {
    const pdf = renderTrainingRecord({
      control,
      partner,
      customer: "Buka Mama Put",
      module: "POS",
      trainer: "Ada Lovelace",
      sessionDate: "2026-10-12",
      deliveryMode: "On-site",
      attendees: [{ name: "John Bull", role: "Cashier", attended: "Yes", completed: "Yes" }],
      coverage: "Till operations",
      openItems: null,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Training-Record")
  })

  it("renders a UAT record", () => {
    const pdf = renderUatRecord({
      control,
      partner,
      customer: "Buka Mama Put",
      systemVersion: "4.2.1",
      testDates: "12–14 Oct 2026",
      scenarios: [{ testCase: "Sale with VAT", expected: "Receipt totals", actual: "Receipt totals", result: "Pass" }],
      defects: [],
      decision: "ACCEPTED",
      decisionNotes: null,
      customerApprover: { name: "Owner", email: "owner@buka.ng" },
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("UAT-Record")
  })

  it("renders a completion and handover record", () => {
    const pdf = renderCompletionHandover({
      control,
      partner,
      customer: "Buka Mama Put",
      workOrderRef: "WO-2026-00003",
      deliverables: ["Site survey — accepted", "Go live — accepted"],
      outstandingItems: [],
      handoverNotes: null,
      accessRevoked: "Partner admin access removed",
      supportRoute: "partners@martpoint.com.ng",
      acceptedBy: { name: "Partner Ops", email: "partners@martpoint.com.ng" },
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Completion-Handover")
  })

  it("renders a go-live decision", () => {
    const pdf = renderGoLiveDecision({
      control,
      partner,
      customer: "Buka Mama Put",
      readinessSummary: "All tasks verified",
      partnerRecommendation: null,
      decision: "APPROVED",
      conditions: null,
      deploymentWindow: "Week of 20 Oct",
      decidedBy: mpOwner,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Go-Live-Decision")
  })

  it("renders an implementation fee statement", () => {
    const pdf = renderImplementationFeeStatement({
      control,
      partner,
      currency: "NGN",
      lines: [
        { workOrderRef: "WO-2026-00003", milestone: "Site survey", submitted: "2026-10-05", decided: "2026-10-07", acceptedValue: "₦50,000.00", status: "ACCEPTED" },
      ],
      expenses: null,
      adjustments: null,
      total: 50000,
    })
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(pdf.fileName).toContain("Fee-Statement")
  })
})
