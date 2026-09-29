import { PartnerDocBuilder, orNA, NOT_APPLICABLE, type GeneratedPdf } from "./partner-pdf"

/* ───────────────────────────  Portal-generated document templates  ───────────────────────────
 * Controlled master content for generated partner records, following the
 * Channel & Implementation Generated Document Templates (v1.0). Every document
 * carries the global control fields: document ID, template version, source
 * record, generated timestamp and status. Optional empty fields render as
 * "Not applicable" — never invented text.
 */

export const GENERATED_DOC_TEMPLATE_VERSION = "1.0"

export interface DocControl {
  documentId: string
  templateVersion?: string
  generatedAt: string
  sourceRecordId?: string
  status?: string
}

export interface PartnerIdentity {
  partnerId: string // MP-NG-00001
  legalName: string
  displayName: string
  partnerTypeLabel: string
  status: string
  country: string
  state: string
  city: string
  partnerSince: string | null
  badgeTier: string | null
}

function fmtDate(iso?: string | null): string {
  if (!iso) return NOT_APPLICABLE
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  } catch {
    return iso
  }
}

export function fmtMoney(amount: number | string | null | undefined, currency = "NGN"): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return NOT_APPLICABLE
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: currency || "NGN" }).format(n)
}

function safeFileStem(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]/g, "_")
}

function controlTable(d: PartnerDocBuilder, c: DocControl) {
  d.fieldTable([
    ["Document ID", c.documentId],
    ["Template version", c.templateVersion || GENERATED_DOC_TEMPLATE_VERSION],
    ["Generated at", fmtDate(c.generatedAt)],
    ["Source record", orNA(c.sourceRecordId)],
    ["Status", c.status || "ISSUED"],
  ])
}

/* ─── 1. Activation Confirmation ─────────────────────────────────────────── */

export interface ActivationConfirmationInput {
  control: DocControl
  partner: PartnerIdentity
  capabilities: { label: string; expiresAt: string | null }[]
  agreementRefs: string[]
  effectiveDate: string
  nextReviewDate: string | null
  authorisedBy: { name: string; title: string; email: string }
}

export function renderActivationConfirmation(
  input: ActivationConfirmationInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title("ACTIVATION CONFIRMATION", input.control.documentId)
  d.para(`This confirms that ${partner.legalName} (Partner ID ${partner.partnerId}) has passed the required activation gates and is an active MartPoint partner as of the effective date below.`, { gap: 12 })

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Partner identity")
  d.fieldTable([
    ["Partner ID", partner.partnerId],
    ["Legal name", partner.legalName],
    ["Trading name", orNA(partner.displayName !== partner.legalName ? partner.displayName : null)],
    ["Country", orNA(partner.country)],
    ["Status", "Active"],
  ])

  d.heading("Approved scope")
  d.fieldTable([
    ["Approved partner type(s)", partner.partnerTypeLabel],
    ["Grade", orNA(partner.badgeTier)],
    ["Effective date", fmtDate(input.effectiveDate)],
    ["Next review date", fmtDate(input.nextReviewDate)],
  ])
  d.para("Grade reflects sustained capability and performance. It does not by itself change commission rates or fees, which are controlled by the signed commercial schedule.", { gap: 10 })

  d.heading("Capabilities")
  if (input.capabilities.length === 0) {
    d.para(NOT_APPLICABLE)
  } else {
    d.table(
      ["Capability", "Expiry"],
      input.capabilities.map((c) => [c.label, c.expiresAt ? fmtDate(c.expiresAt) : "None"])
    )
  }

  d.heading("Agreement documents")
  if (input.agreementRefs.length === 0) {
    d.para(NOT_APPLICABLE)
  } else {
    input.agreementRefs.forEach((r) => d.para(`• ${r}`, { gap: 2 }))
    d.para("", { gap: 8 })
  }

  d.heading("Authorisation")
  d.para("Issued by MartPoint Partner Operations.", { gap: 6 })
  d.fieldTable([
    ["Authorised by", orNA(input.authorisedBy.name)],
    ["Title", orNA(input.authorisedBy.title)],
    ["Email", orNA(input.authorisedBy.email)],
    ["Authorised at", fmtDate(input.control.generatedAt)],
  ])

  return d.finish(`MartPoint-Activation-Confirmation-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 2. Customer Assignment ─────────────────────────────────────────────── */

export interface CustomerAssignmentInput {
  control: DocControl
  partner: PartnerIdentity
  customer: { businessName: string; location: string }
  relationshipLabel: string
  accessLevelLabel: string
  scope: string | null
  startDate: string | null
  expiryDate: string | null
  martpointOwner: { name: string; title: string; email: string }
}

export function renderCustomerAssignment(
  input: CustomerAssignmentInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title("CUSTOMER ASSIGNMENT", input.control.documentId)
  d.para("This Customer Assignment records the customer allocated to the partner, the purpose of the assignment, the permitted access and the dates in force. It is effective once issued by MartPoint and acknowledged by the partner.", { gap: 12 })

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Parties")
  d.fieldTable([
    ["Customer", input.customer.businessName],
    ["Customer location", orNA(input.customer.location)],
    ["Partner", `${partner.legalName} (${partner.partnerId})`],
    ["MartPoint owner", orNA(input.martpointOwner.name || input.martpointOwner.email)],
  ])

  d.heading("Assignment")
  d.fieldTable([
    ["Purpose", input.relationshipLabel],
    ["Scope and permitted activities", orNA(input.scope)],
    ["Access level", input.accessLevelLabel],
    ["Named users", "Partner portal team members in good standing, within the stated access level"],
    ["Start date", fmtDate(input.startDate)],
    ["Expiry date", fmtDate(input.expiryDate)],
  ])

  d.heading("Conditions")
  d.para("• Access is least-privilege and limited to the stated scope. It must not be shared outside the partner team.", { gap: 3 })
  d.para("• The partner must not access an unassigned customer or retain access after expiry or revocation.", { gap: 3 })
  d.para("• Billable implementation work additionally requires an approved Work Order before it begins.", { gap: 3 })
  d.para("• At closure or revocation, the partner completes handover duties and all customer access is revoked.", { gap: 10 })

  d.heading("Acceptance")
  d.para("MartPoint authorises this assignment on issue. The partner acknowledges scope, dates and access through the partner portal.", { gap: 6 })
  d.signatureTable([
    { side: "MartPoint", name: input.martpointOwner.name, title: input.martpointOwner.title, email: input.martpointOwner.email },
    { side: "Partner", name: "", title: "", email: "" },
  ])

  return d.finish(`MartPoint-Customer-Assignment-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 3. Commission Statement ────────────────────────────────────────────── */

export interface CommissionStatementLine {
  customer: string
  attributionType: string
  basis: string
  rate: string
  eligibleAmount: string
  amount: string
  status: string
  date: string | null
}

export interface CommissionStatementInput {
  control: DocControl
  partner: PartnerIdentity
  period: { from: string | null; to: string | null }
  currency: string
  lines: CommissionStatementLine[]
  disputeContact: string
}

export function renderCommissionStatement(
  input: CommissionStatementInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title("COMMISSION STATEMENT", input.control.documentId)
  d.para("Channel commission statement for the period below. This statement shows the calculation, status and any adjustments. It is not proof of payment.", { gap: 12 })

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Partner and period")
  d.fieldTable([
    ["Partner", `${partner.legalName} (${partner.partnerId})`],
    ["Currency", input.currency],
    ["Period from", fmtDate(input.period.from)],
    ["Period to", fmtDate(input.period.to)],
  ])

  d.heading("Line items")
  if (input.lines.length === 0) {
    d.para("No commission line items in this period.")
  } else {
    d.table(
      ["Customer", "Type", "Basis", "Rate", "Commission", "Status", "Date"],
      input.lines.map((l) => [l.customer, l.attributionType, l.basis, l.rate, l.amount, l.status, fmtDate(l.date)])
    )
    const total = input.lines.reduce((s, l) => s + (Number(String(l.amount).replace(/[^0-9.-]/g, "")) || 0), 0)
    d.fieldTable([["Net payable (subject to approval and signed schedule)", fmtMoney(total, input.currency)]])
  }

  d.heading("Adjustments and disputes")
  d.para("Refunds, credits, chargebacks and exclusions follow the signed Commercial Schedule. To dispute a line item, quote this statement and the line reference with supporting evidence within the period stated in your schedule.", { gap: 6 })
  d.fieldTable([["Dispute contact", orNA(input.disputeContact)]])

  return d.finish(`MartPoint-Commission-Statement-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 4. Payout Statement ────────────────────────────────────────────────── */

export interface PayoutStatementInput {
  control: DocControl
  partner: PartnerIdentity
  payoutReference: string
  paymentDate: string | null
  maskedDestination: string | null
  currency: string
  lines: { customer: string; amount: string; status: string }[]
  deductions: string | null
  total: number
  contact: string
}

export function renderPayoutStatement(
  input: PayoutStatementInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title("PAYOUT STATEMENT", input.control.documentId)
  d.para("Statement of a partner payout executed by MartPoint Finance.", { gap: 12 })

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Payout")
  d.fieldTable([
    ["Partner", `${partner.legalName} (${partner.partnerId})`],
    ["Payout reference", input.payoutReference],
    ["Payment date", fmtDate(input.paymentDate)],
    ["Destination", orNA(input.maskedDestination)],
    ["Currency", input.currency],
  ])

  d.heading("Included earnings")
  if (input.lines.length === 0) {
    d.para(NOT_APPLICABLE)
  } else {
    d.table(
      ["Customer", "Amount", "Status"],
      input.lines.map((l) => [l.customer, l.amount, l.status])
    )
  }

  d.heading("Total")
  d.fieldTable([
    ["Deductions and adjustments", orNA(input.deductions)],
    ["Total paid", fmtMoney(input.total, input.currency)],
  ])
  d.para(`Payment queries: ${orNA(input.contact)}. Quote the payout reference above.`, { gap: 6 })

  return d.finish(`MartPoint-Payout-Statement-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 5. Grade and Certification Confirmation ────────────────────────────── */

export interface GradeConfirmationInput {
  control: DocControl
  partner: PartnerIdentity
  previousGrade: string | null
  newGrade: string
  effectiveDate: string
  reviewPeriod: string | null
  basis: string | null
  decidedBy: { name: string; title: string; email: string }
}

export function renderGradeConfirmation(
  input: GradeConfirmationInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title("GRADE AND CERTIFICATION CONFIRMATION", input.control.documentId)
  d.para("This confirms the outcome of a MartPoint grade or certification review.", { gap: 12 })

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Decision")
  d.fieldTable([
    ["Partner", `${partner.legalName} (${partner.partnerId})`],
    ["Approved partner type(s)", partner.partnerTypeLabel],
    ["Previous grade", orNA(input.previousGrade)],
    ["Confirmed grade", input.newGrade],
    ["Effective date", fmtDate(input.effectiveDate)],
    ["Review period", orNA(input.reviewPeriod)],
    ["Basis", orNA(input.basis)],
    ["Badge permission", `Partner may display the official ${input.newGrade} verification badge while this grade remains in force`],
  ])
  d.para("Grade is separate from partner type and operating level. It does not alter commercial rates unless a signed schedule expressly says so. A grade may be reviewed or changed when performance, certification or compliance changes.", { gap: 10 })

  d.heading("Authorisation")
  d.fieldTable([
    ["Decided by", orNA(input.decidedBy.name)],
    ["Title", orNA(input.decidedBy.title)],
    ["Email", orNA(input.decidedBy.email)],
    ["Decision date", fmtDate(input.control.generatedAt)],
  ])

  return d.finish(`MartPoint-Grade-Confirmation-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 6. Suspension / Reassignment / Termination Notice ──────────────────── */

export interface FormalNoticeInput {
  control: DocControl
  partner: PartnerIdentity
  decision: "SUSPENSION" | "TERMINATION" | "REASSIGNMENT"
  effectiveDate: string
  reason: string | null
  immediateActions?: string[]
  decidedBy: { name: string; title: string; email: string }
  reviewContact: string
}

const DECISION_TITLES: Record<FormalNoticeInput["decision"], string> = {
  SUSPENSION: "SUSPENSION NOTICE",
  TERMINATION: "TERMINATION NOTICE",
  REASSIGNMENT: "REASSIGNMENT NOTICE",
}

export function renderFormalNotice(
  input: FormalNoticeInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title(DECISION_TITLES[input.decision], input.control.documentId)
  d.para(`This is a formal notice from MartPoint to ${partner.legalName} (Partner ID ${partner.partnerId}).`, { gap: 12 })

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Decision")
  d.fieldTable([
    ["Decision", DECISION_TITLES[input.decision].replace(" NOTICE", "")],
    ["Effective date", fmtDate(input.effectiveDate)],
    ["Partner organisation affected", `${partner.legalName} (${partner.partnerId})`],
    ["Reason", orNA(input.reason)],
  ])

  d.heading("Immediate actions")
  const actions = input.immediateActions?.length
    ? input.immediateActions
    : [
        "Portal access is restricted to reading notices and records.",
        "No new opportunities, customer assignments or commercial activity may be started.",
        "Customer records and access are handled per the agreement and any assigned-customer instructions.",
      ]
  actions.forEach((a) => d.para(`• ${a}`, { gap: 3 }))
  d.para("", { gap: 6 })

  d.heading("Commercial treatment")
  d.para("Eligible accepted amounts, holds, adjustments and statement timing follow the signed agreement. Amounts not yet eligible are handled per the agreement and this decision.", { gap: 10 })

  d.heading("Review route")
  d.para(`To ask a question or request a review, contact ${orNA(input.reviewContact)} quoting this document ID (${input.control.documentId}) within the response period stated in your agreement.`, { gap: 6 })
  d.fieldTable([
    ["Issued by", orNA(input.decidedBy.name)],
    ["Title", orNA(input.decidedBy.title)],
    ["Email", orNA(input.decidedBy.email)],
  ])

  return d.finish(`MartPoint-${DECISION_TITLES[input.decision].replace(/ /g, "-")}-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 7. Implementation Work Order ───────────────────────────────────────── */

export interface WorkOrderMilestoneLine {
  title: string
  dueDate: string | null
  feeAmount: string
  acceptanceCriteria: string
}

export interface WorkOrderInput {
  control: DocControl
  partner: PartnerIdentity
  workOrderRef: string
  title: string
  customer: string
  scope: string
  exclusions: string | null
  customerDuties: string | null
  accessNotes: string | null
  acceptanceCriteria: string | null
  milestones: WorkOrderMilestoneLine[]
  feeTotal: string | null
  currency: string
  startDate: string | null
  dueDate: string | null
  martpointOwner: { name: string; title: string; email: string }
  partnerSignatory: { name: string; title: string; email: string }
}

export function renderImplementationWorkOrder(
  input: WorkOrderInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title("IMPLEMENTATION WORK ORDER", input.control.documentId)
  d.para("This Work Order records the approved implementation scope, fees, milestones and acceptance criteria. No billable work may begin until this Work Order is issued by MartPoint and accepted by the partner.", { gap: 12 })

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Reference")
  d.fieldTable([
    ["Work order", input.workOrderRef],
    ["Partner", `${partner.legalName} (${partner.partnerId})`],
    ["Customer", orNA(input.customer)],
    ["MartPoint owner", orNA(input.martpointOwner.name || input.martpointOwner.email)],
    ["Start date", fmtDate(input.startDate)],
    ["Target completion", fmtDate(input.dueDate)],
  ])

  d.heading("Scope")
  d.para(input.scope, { gap: 8 })
  d.fieldTable([
    ["Exclusions", orNA(input.exclusions)],
    ["Customer duties", orNA(input.customerDuties)],
    ["Acceptance criteria", orNA(input.acceptanceCriteria)],
    ["Access and security notes", orNA(input.accessNotes)],
  ])
  d.para("Out-of-scope work requires an approved Change Order before it begins. Access is least-privilege with approved tools only; incidents must be reported immediately.", { gap: 10 })

  d.heading("Milestones and fees")
  if (input.milestones.length === 0) {
    d.para(NOT_APPLICABLE)
  } else {
    d.table(
      ["Milestone", "Due", "Fee", "Acceptance"],
      input.milestones.map((m) => [m.title, fmtDate(m.dueDate), m.feeAmount, m.acceptanceCriteria])
    )
  }
  d.fieldTable([["Work order fee total", orNA(input.feeTotal ? `${input.feeTotal} ${input.currency}` : null)]])
  d.para("Fees are earned only on named milestone acceptance. Time spent or evidence uploaded does not by itself create an amount payable.", { gap: 10 })

  d.heading("Signatures")
  d.signatureTable([
    { side: "MartPoint", ...input.martpointOwner },
    { side: "Partner", ...input.partnerSignatory },
  ])

  return d.finish(`MartPoint-Work-Order-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 8. Change Order ────────────────────────────────────────────────────── */

export interface ChangeOrderInput {
  control: DocControl
  partner: PartnerIdentity
  workOrderRef: string
  requestedBy: string
  description: string
  reason: string | null
  impactScope: string | null
  impactFee: string | null
  impactSchedule: string | null
  decision: "APPROVED" | "REJECTED" | "DEFERRED"
  decisionReason: string | null
  decidedBy: { name: string; title: string; email: string }
}

export function renderChangeOrder(
  input: ChangeOrderInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title("CHANGE ORDER", input.control.documentId)
  d.para("This Change Order records an approved change to an existing Work Order.", { gap: 12 })

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Baseline and request")
  d.fieldTable([
    ["Work order", input.workOrderRef],
    ["Partner", `${partner.legalName} (${partner.partnerId})`],
    ["Requested by", orNA(input.requestedBy)],
    ["Requested change", input.description],
    ["Reason", orNA(input.reason)],
  ])

  d.heading("Impact")
  d.fieldTable([
    ["Scope impact", orNA(input.impactScope)],
    ["Fee impact", orNA(input.impactFee)],
    ["Schedule impact", orNA(input.impactSchedule)],
  ])

  d.heading("Decision")
  d.fieldTable([
    ["Decision", input.decision],
    ["Decision reason", orNA(input.decisionReason)],
    ["Decided by", orNA(input.decidedBy.name)],
    ["Decided at", fmtDate(input.control.generatedAt)],
  ])

  return d.finish(`MartPoint-Change-Order-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 9. Data Processing Addendum ────────────────────────────────────────── */

export interface DpaInput {
  control: DocControl
  partner: PartnerIdentity
  partnerAddress: string | null
  martpoint: { legalName: string; registrationNo: string; registeredAddress: string }
  effectiveDate: string
}

export function renderDataProcessingAddendum(
  input: DpaInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title("DATA PROCESSING ADDENDUM", input.control.documentId)

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Parties")
  d.fieldTable([
    ["Controller", `${orNA(input.martpoint.legalName)} (${orNA(input.martpoint.registrationNo)}), ${orNA(input.martpoint.registeredAddress)}`],
    ["Processor", `${partner.legalName} (${partner.partnerId}), ${orNA(input.partnerAddress)}`],
    ["Effective date", fmtDate(input.effectiveDate)],
  ])

  d.heading("1. Roles and purpose")
  d.para("The partner processes personal data only on documented instructions from MartPoint or the assigned customer, solely to perform the approved partner activities under the Partner Agreement. The partner acts as processor; MartPoint or the customer remains controller as applicable.")
  d.heading("2. Data details")
  d.para("Processing covers customer business and user records needed for the approved scope, for the duration of the assignment or agreement, on approved MartPoint systems.")
  d.heading("3. Security")
  d.para("The partner maintains appropriate technical and organisational measures: least-privilege access, confidentiality commitments, approved tools, logging where applicable, and awareness training for its personnel.")
  d.heading("4. Subprocessors")
  d.para("The partner must not engage subprocessors for personal data without prior written approval and equivalent obligations flowing down.")
  d.heading("5. Incidents")
  d.para("Actual or suspected security or privacy incidents must be reported immediately through the designated MartPoint contact, with reasonable cooperation in investigation and notification.")
  d.heading("6. Rights, deletion and audit")
  d.para("The partner assists with data-subject requests, returns or deletes personal data on instruction or at termination within the retention rules, and permits reasonable audit of compliance.")
  d.heading("7. Transfers")
  d.para("Personal data may only be transferred to approved locations under the applicable transfer mechanism stated in the Partner Agreement.")

  return d.finish(`MartPoint-DPA-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 10. Training Attendance and Completion Record ──────────────────────── */

export interface TrainingRecordInput {
  control: DocControl
  partner: PartnerIdentity
  customer: string
  module: string
  trainer: string
  sessionDate: string | null
  deliveryMode: string | null
  attendees: { name: string; role: string; attended: string; completed: string }[]
  coverage: string | null
  openItems: string | null
}

export function renderTrainingRecord(
  input: TrainingRecordInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title("TRAINING ATTENDANCE AND COMPLETION RECORD", input.control.documentId)

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Session")
  d.fieldTable([
    ["Customer", input.customer],
    ["Module", input.module],
    ["Trainer", orNA(input.trainer)],
    ["Date", fmtDate(input.sessionDate)],
    ["Delivery mode", orNA(input.deliveryMode)],
    ["Delivered by partner", `${partner.legalName} (${partner.partnerId})`],
  ])

  d.heading("Attendees")
  if (input.attendees.length === 0) {
    d.para(NOT_APPLICABLE)
  } else {
    d.table(
      ["Name", "Role", "Attended", "Completed"],
      input.attendees.map((a) => [a.name, a.role, a.attended, a.completed])
    )
  }

  d.heading("Coverage and open items")
  d.fieldTable([
    ["Topics covered", orNA(input.coverage)],
    ["Open items and follow-up", orNA(input.openItems)],
  ])

  return d.finish(`MartPoint-Training-Record-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 11. UAT and Acceptance Record ──────────────────────────────────────── */

export interface UatRecordInput {
  control: DocControl
  partner: PartnerIdentity
  customer: string
  systemVersion: string | null
  testDates: string | null
  scenarios: { testCase: string; expected: string; actual: string; result: string }[]
  defects: { description: string; severity: string; owner: string; disposition: string }[]
  decision: "ACCEPTED" | "CONDITIONALLY_ACCEPTED" | "REJECTED"
  decisionNotes: string | null
  customerApprover: { name: string; email: string }
}

export function renderUatRecord(
  input: UatRecordInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title("UAT AND ACCEPTANCE RECORD", input.control.documentId)

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Environment")
  d.fieldTable([
    ["Customer", input.customer],
    ["System version", orNA(input.systemVersion)],
    ["Test dates", orNA(input.testDates)],
    ["Testing coordinated by", `${partner.legalName} (${partner.partnerId})`],
  ])

  d.heading("Scenarios")
  if (input.scenarios.length === 0) {
    d.para(NOT_APPLICABLE)
  } else {
    d.table(
      ["Test case", "Expected", "Actual", "Result"],
      input.scenarios.map((s) => [s.testCase, s.expected, s.actual, s.result])
    )
  }

  d.heading("Defects")
  if (input.defects.length === 0) {
    d.para("No defects recorded.")
  } else {
    d.table(
      ["Defect", "Severity", "Owner", "Disposition"],
      input.defects.map((x) => [x.description, x.severity, x.owner, x.disposition])
    )
  }

  d.heading("Decision")
  d.fieldTable([
    ["Decision", input.decision.replace(/_/g, " ")],
    ["Notes and conditions", orNA(input.decisionNotes)],
    ["Customer approver", orNA(input.customerApprover.name || input.customerApprover.email)],
  ])

  return d.finish(`MartPoint-UAT-Record-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 12. Completion and Handover Record ─────────────────────────────────── */

export interface CompletionHandoverInput {
  control: DocControl
  partner: PartnerIdentity
  customer: string
  workOrderRef: string | null
  deliverables: string[]
  outstandingItems: { item: string; owner: string; dueDate: string | null }[]
  handoverNotes: string | null
  accessRevoked: string | null
  supportRoute: string | null
  acceptedBy: { name: string; email: string }
}

export function renderCompletionHandover(
  input: CompletionHandoverInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title("COMPLETION AND HANDOVER RECORD", input.control.documentId)

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Reference")
  d.fieldTable([
    ["Customer", input.customer],
    ["Partner", `${partner.legalName} (${partner.partnerId})`],
    ["Work order", orNA(input.workOrderRef)],
  ])

  d.heading("Deliverables")
  if (input.deliverables.length === 0) {
    d.para(NOT_APPLICABLE)
  } else {
    input.deliverables.forEach((x) => d.para(`• ${x}`, { gap: 3 }))
    d.para("", { gap: 6 })
  }

  d.heading("Outstanding items")
  if (input.outstandingItems.length === 0) {
    d.para("None recorded.")
  } else {
    d.table(
      ["Item", "Owner", "Due"],
      input.outstandingItems.map((i) => [i.item, i.owner, fmtDate(i.dueDate)])
    )
  }

  d.heading("Handover and access")
  d.fieldTable([
    ["Handover notes", orNA(input.handoverNotes)],
    ["Support route", orNA(input.supportRoute)],
    ["Access revoked", orNA(input.accessRevoked)],
    ["Accepted by", orNA(input.acceptedBy.name || input.acceptedBy.email)],
    ["Accepted at", fmtDate(input.control.generatedAt)],
  ])

  return d.finish(`MartPoint-Completion-Handover-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 13. Go Live Recommendation and Decision ────────────────────────────── */

export interface GoLiveDecisionInput {
  control: DocControl
  partner: PartnerIdentity | null
  customer: string
  readinessSummary: string | null
  partnerRecommendation: string | null
  decision: "APPROVED" | "DEFERRED" | "DECLINED"
  conditions: string | null
  deploymentWindow: string | null
  decidedBy: { name: string; title: string; email: string }
}

export function renderGoLiveDecision(
  input: GoLiveDecisionInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const d = new PartnerDocBuilder({
    logoDataUrl: opts?.logoDataUrl,
    footerRef: `${input.control.documentId} — ${input.customer}`,
  })

  d.title("GO LIVE DECISION", input.control.documentId)
  d.para("MartPoint gives the final deployment or go-live decision. A partner recommendation does not constitute approval.", { gap: 12 })

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Readiness")
  d.fieldTable([
    ["Customer", input.customer],
    ["Implementation partner", input.partner ? `${input.partner.legalName} (${input.partner.partnerId})` : NOT_APPLICABLE],
    ["Readiness summary", orNA(input.readinessSummary)],
    ["Partner recommendation", orNA(input.partnerRecommendation)],
  ])

  d.heading("MartPoint decision")
  d.fieldTable([
    ["Decision", input.decision],
    ["Conditions", orNA(input.conditions)],
    ["Deployment window", orNA(input.deploymentWindow)],
    ["Decided by", orNA(input.decidedBy.name)],
    ["Title", orNA(input.decidedBy.title)],
    ["Decision date", fmtDate(input.control.generatedAt)],
  ])

  return d.finish(`MartPoint-Go-Live-Decision-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 14. Implementation Fee Statement ───────────────────────────────────── */

export interface ImplementationFeeLine {
  workOrderRef: string
  milestone: string
  submitted: string | null
  decided: string | null
  acceptedValue: string
  status: string
}

export interface ImplementationFeeStatementInput {
  control: DocControl
  partner: PartnerIdentity
  currency: string
  lines: ImplementationFeeLine[]
  expenses: string | null
  adjustments: string | null
  total: number
}

export function renderImplementationFeeStatement(
  input: ImplementationFeeStatementInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${partner.legalName}` })

  d.title("IMPLEMENTATION FEE STATEMENT", input.control.documentId)
  d.para("Implementation fees are earned only on accepted milestones per the approved Work Order. This statement is not proof of payment.", { gap: 12 })

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Partner")
  d.fieldTable([
    ["Partner", `${partner.legalName} (${partner.partnerId})`],
    ["Currency", input.currency],
  ])

  d.heading("Milestones")
  if (input.lines.length === 0) {
    d.para("No milestone fees in this period.")
  } else {
    d.table(
      ["Work order", "Milestone", "Submitted", "Decided", "Accepted value", "Status"],
      input.lines.map((l) => [l.workOrderRef, l.milestone, fmtDate(l.submitted), fmtDate(l.decided), l.acceptedValue, l.status])
    )
  }

  d.heading("Totals")
  d.fieldTable([
    ["Approved expenses", orNA(input.expenses)],
    ["Adjustments and holds", orNA(input.adjustments)],
    ["Net eligible", fmtMoney(input.total, input.currency)],
  ])

  return d.finish(`MartPoint-Fee-Statement-${safeFileStem(input.control.documentId)}.pdf`)
}
