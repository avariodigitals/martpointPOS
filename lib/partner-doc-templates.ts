import { PartnerDocBuilder, orNA, NOT_APPLICABLE, type GeneratedPdf } from "./partner-pdf"

/* ───────────────────────────  Portal-generated document templates  ───────────────────────────
 * Controlled master content for generated partner records, following the
 * Channel & Implementation Generated Document Templates (v1.0). Every document
 * carries the global control fields: document ID, template version, source
 * record, generated timestamp and status. Optional empty fields render as
 * "Not applicable" — never invented text.
 */

export const GENERATED_DOC_TEMPLATE_VERSION = "1.1"

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
  partnerType?: string
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
  partnerType?: string
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
    ["Graded partner type", input.partnerType || partner.partnerTypeLabel],
    ["Previous grade", orNA(input.previousGrade)],
    ["Confirmed grade", input.newGrade],
    ["Effective date", fmtDate(input.effectiveDate)],
    ["Review period", orNA(input.reviewPeriod)],
    ["Basis", orNA(input.basis)],
    ["Badge permission", input.newGrade === "UNGRADED" ? "No graded Partner Type badge is authorised" : `Partner may display the official ${input.newGrade} ${input.partnerType || partner.partnerTypeLabel} verification badge while this grade remains in force`],
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
  customerLocation?: string | null
  scope: string
  exclusions: string | null
  customerDuties: string | null
  martpointResponsibilities?: string | null
  partnerResponsibilities?: string | null
  accessNotes: string | null
  approvedAccessPermissions?: string | null
  acceptanceCriteria: string | null
  completionEvidence?: string | null
  acceptanceReviewBusinessDays?: number | null
  defectCorrectionPeriod?: string | null
  paymentConditions?: string | null
  approvedExpenses?: string | null
  taxTreatment?: string | null
  dataProtectionRequirements?: string | null
  insuranceRequirement?: string | null
  changeRequestProcedure?: string | null
  acceptanceAuthority?: string | null
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
    ["Customer location", orNA(input.customerLocation)],
    ["MartPoint owner", orNA(input.martpointOwner.name || input.martpointOwner.email)],
    ["Start date", fmtDate(input.startDate)],
    ["Target completion", fmtDate(input.dueDate)],
  ])

  d.heading(input.title || "Scope")
  d.para(input.scope, { gap: 8 })
  d.fieldTable([
    ["Exclusions", orNA(input.exclusions)],
    ["Customer duties", orNA(input.customerDuties)],
    ["MartPoint responsibilities", orNA(input.martpointResponsibilities)],
    ["Partner responsibilities", orNA(input.partnerResponsibilities)],
    ["Acceptance criteria", orNA(input.acceptanceCriteria)],
    ["Completion evidence", orNA(input.completionEvidence)],
    ["Approved access permissions", orNA(input.approvedAccessPermissions || input.accessNotes)],
    ["Data protection requirements", orNA(input.dataProtectionRequirements)],
    ["Project-specific insurance", orNA(input.insuranceRequirement)],
    ["Change request procedure", orNA(input.changeRequestProcedure)],
  ])
  d.heading("Review, defects and payment")
  d.fieldTable([
    ["Acceptance review period", input.acceptanceReviewBusinessDays ? `${input.acceptanceReviewBusinessDays} business days` : NOT_APPLICABLE],
    ["Acceptance authority", orNA(input.acceptanceAuthority || input.martpointOwner.name)],
    ["Defect correction period", orNA(input.defectCorrectionPeriod)],
    ["Payment conditions", orNA(input.paymentConditions)],
    ["Approved expenses", orNA(input.approvedExpenses)],
    ["Tax treatment", orNA(input.taxTreatment || "Must be completed and agreed in this Work Order; no tax treatment assumed")],
  ])
  d.para("MartPoint shall, within the stated review period, issue written acceptance or identify outstanding deliverables against the agreed acceptance criteria. Silence, elapsed time or evidence submission does not constitute acceptance. Out-of-scope work requires an approved Change Order before it begins. Access is least-privilege and time-limited. Suspected security or privacy incidents must be reported within four hours of discovery.", { gap: 10 })

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
  d.para("No fee, expense or other financial commitment exists unless expressly completed in this Work Order and accepted by both Parties before work starts. The Parties must complete and agree the tax treatment above; no tax treatment is assumed by this template.", { gap: 6 })
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
  processingRelationship?: string
  responsibleController?: string
  purpose?: string
  duration?: string
  dataSubjects?: string
  personalDataCategories?: string
  processingOperations?: string
  documentedInstructions?: string
  approvedLocations?: string
  approvedSubprocessors?: string
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

  d.heading("Parties and processing roles")
  d.fieldTable([
    ["MartPoint", `${orNA(input.martpoint.legalName)} (${orNA(input.martpoint.registrationNo)}), ${orNA(input.martpoint.registeredAddress)}`],
    ["Partner", `${partner.legalName} (${partner.partnerId}), ${orNA(input.partnerAddress)}`],
    ["Processing relationship", orNA(input.processingRelationship)],
    ["Party determining purpose and means (controller)", orNA(input.responsibleController)],
    ["Effective date", fmtDate(input.effectiveDate)],
  ])
  d.para("The Parties shall determine and record their actual roles for each processing activity before access begins. This Addendum does not presume that MartPoint is controller in every engagement. Where a Party acts as an independent controller, it is responsible for its own lawful basis, transparency, data-subject rights and statutory duties. Processor obligations below apply only to the Party that processes personal data on documented instructions for a controller.", { gap: 10 })

  d.heading("1. Processing details")
  d.fieldTable([
    ["Purpose", orNA(input.purpose)],
    ["Duration", orNA(input.duration)],
    ["Data subjects", orNA(input.dataSubjects)],
    ["Personal data categories", orNA(input.personalDataCategories)],
    ["Processing operations", orNA(input.processingOperations)],
    ["Documented instructions", orNA(input.documentedInstructions)],
    ["Approved locations", orNA(input.approvedLocations)],
    ["Approved subprocessors", orNA(input.approvedSubprocessors)],
  ])
  d.para("Processing details must be completed in the applicable Work Order, Customer Assignment or written processing instruction before personal data is accessed. This Addendum may apply to authorised Channel Partner support as well as implementation work. No personal-data processing is authorised merely by appointment to the Partner Network.", { gap: 8 })
  d.heading("2. Instructions and purpose limitation")
  d.para("A processor shall process personal data only on documented instructions from the applicable controller, including as to transfers, and only for the specified purpose and duration. If an instruction appears to violate applicable data-protection law, the processor shall notify the controller promptly and pause the affected processing unless legally prohibited from doing so. A Party acting as an independent controller determines and documents its own lawful purposes and means.")
  d.heading("3. Confidentiality, access and personnel")
  d.para("Each Party shall ensure that personnel authorised to process personal data are bound by confidentiality, receive appropriate training and have access only on a least-privilege, individual-account basis. Credentials shall not be shared. Access must be limited to approved systems, locations and duration and revoked promptly when no longer required.")
  d.heading("4. Security safeguards")
  d.para("Each Party shall implement and maintain technical and organisational safeguards proportionate to the nature, scope, context and purposes of processing and the risks to data subjects. Safeguards include access controls, authentication, secure configuration, encryption where appropriate, secure transmission, logging and monitoring, backup and recovery, vulnerability and incident management, personnel controls and periodic review. The processor shall provide reasonable information needed to demonstrate compliance and cooperate with proportionate security assessments.")
  d.heading("5. Suspected incidents")
  d.para("A Party discovering a suspected or actual personal-data or security incident affecting processing under this Addendum shall notify the other affected Party without undue delay and in any event within four hours of discovery, using the designated incident contact. Notice shall include known facts, affected data and individuals, likely consequences, containment measures and a contact for updates. The notifying Party shall preserve evidence, contain the incident, provide updates and cooperate with investigation and legally required notifications. The four-hour contractual notice supports, and does not replace or extend, any shorter or statutory notification duty.")
  d.heading("6. Subprocessors")
  d.para("A processor shall not appoint a subprocessor or permit another person to access personal data without the controller's prior written approval. The processor shall impose equivalent written data-protection and security duties on an approved subprocessor, remain responsible for its performance and promptly notify the controller of proposed changes so an objection can be raised before access is given.")
  d.heading("7. Data-subject requests and regulatory cooperation")
  d.para("A processor shall promptly forward data-subject requests, complaints and regulatory inquiries to the applicable controller and provide reasonable assistance, without responding except on documented instructions or as required by law. Each Party shall reasonably assist the other with compliance, impact assessments, consultations, investigations and records relevant to the processing relationship.")
  d.heading("8. Retention, return and deletion")
  d.para("At the end of the approved purpose or on written instruction, the processor shall stop processing and, at the controller's choice, return or securely delete personal data and copies, unless applicable law requires retention. Any retained data remains protected and is deleted when the legal retention period ends. The processor shall confirm completion on request.")
  d.heading("9. International and onward transfers")
  d.para("Personal data shall not be transferred or made accessible outside an approved location, or onward to another recipient, without prior documented approval and a lawful transfer mechanism and safeguards required by applicable law. The Parties shall record the destination and mechanism before transfer.")
  d.heading("10. Audit, records and assistance")
  d.para("A processor shall maintain records reasonably necessary to demonstrate its processing and safeguards, provide information needed for compliance and permit proportionate audits by the controller or its appointed auditor on reasonable notice. Immediate audit or preservation measures may follow a material incident, regulator request or credible evidence of non-compliance. Audits shall protect unrelated confidential information.")
  d.heading("11. Applicable law and order of precedence")
  d.para("The Parties shall comply with the Nigeria Data Protection Act 2023, applicable Nigeria Data Protection Commission directives and other binding data-protection requirements. This Addendum supplements the Partner Agreement for the engagement-specific processing scope. If a term conflicts on security or personal-data protection, the term providing greater protection or requiring earlier notice applies. Nothing in this Addendum or a Work Order may weaken or extend the Agreement's four-hour incident reporting duty, a stricter signed protection or a statutory deadline. For other processing details, this Addendum controls; a Work Order may add detail but may not reduce the protections stated here.")
  d.heading("12. Term and signatures")
  d.para("This Addendum applies only for its stated processing scope and becomes effective when signed by both Parties. It must be executed before any processing or customer-environment access to which it applies. It ends when the applicable processing ends, subject to continuing confidentiality, security, deletion and legal duties.")
  d.signatureTable([
    { side: "MartPoint", name: "", title: "", email: "" },
    { side: "Partner", name: "", title: "", email: "" },
  ])

  return d.finish(`MartPoint-DPA-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── 9A. Technology Schedule ────────────────────────────────────────────── */

export interface TechnologyScheduleInput {
  control: DocControl
  partner: PartnerIdentity
  martpointEntity: string
  effectiveDate: string
  scope: string
  approvedSolution: string
  useCase: string
  workOrderRef: string | null
  preExistingIp: string | null
  deliverableIp: string | null
  apiAccess: string | null
  securityResponsibilities: string | null
  testingAndProductionApproval: string | null
  acceptanceCriteria: string | null
  maintenanceResponsibilities: string | null
  revocationAndHandover: string | null
  status: "APPLICABLE" | "NOT_APPLICABLE" | "DRAFT"
}

export function renderTechnologySchedule(input: TechnologyScheduleInput, opts?: { logoDataUrl?: string }): GeneratedPdf {
  const d = new PartnerDocBuilder({ logoDataUrl: opts?.logoDataUrl, footerRef: `${input.control.documentId} — ${input.partner.legalName}` })
  d.title("TECHNOLOGY SCHEDULE", input.control.documentId)
  d.heading("Document control")
  controlTable(d, input.control)
  if (input.status === "NOT_APPLICABLE") {
    d.heading("Applicability")
    d.para("NOT APPLICABLE. The Partner is not approved for Technology Partner activities under the current appointment. This Schedule grants no API, integration, development, production or customer-environment access.")
    return d.finish(`MartPoint-Technology-Schedule-${safeFileStem(input.control.documentId)}.pdf`)
  }
  d.para("This Schedule applies only to the approved technology activities stated below and only after the Parties sign it and any required Work Order or Production Approval. It grants no broader access or authority.", { gap: 10 })
  d.fieldTable([
    ["Partner", `${input.partner.legalName} (${input.partner.partnerId})`],
    ["MartPoint entity", input.martpointEntity],
    ["Effective date", fmtDate(input.effectiveDate)],
    ["Approved technical scope", input.scope],
    ["Approved solution and version", input.approvedSolution],
    ["Approved use case", input.useCase],
    ["Related Work Order", orNA(input.workOrderRef)],
  ])
  d.heading("1. Scope and change control")
  d.para("Only the specific integrations, APIs, connectors, custom development, technical deliverables, environments and production activities stated above are approved. Changes require written approval and, where fees, dates or deliverables change, an approved Change Order before work proceeds.")
  d.heading("2. Intellectual property")
  d.fieldTable([["Partner pre-existing intellectual property", orNA(input.preExistingIp)], ["Project deliverables and ownership/licence", orNA(input.deliverableIp)]])
  d.para("Each Party retains its pre-existing intellectual property. Ownership, licence scope, source-code delivery, third-party and open-source components, restrictions and post-termination rights for new deliverables must be expressly completed above or in the related Work Order. No assignment or licence is implied where left blank.")
  d.heading("3. API, integration and production access")
  d.para(orNA(input.apiAccess))
  d.para("Access is personal, least-privilege, purpose-limited and time-limited. Production access, customer tenant access, data export and credential issuance require separate written approval. Credentials may not be shared, and access may be revoked at any time to protect a customer, system or data.")
  d.heading("4. Security and testing")
  d.para(orNA(input.securityResponsibilities))
  d.para(orNA(input.testingAndProductionApproval))
  d.para("No change may be deployed to production until testing evidence is reviewed and the authorised MartPoint approver issues written Production Approval. Suspected security or privacy incidents must be reported within four hours of discovery.")
  d.heading("5. Deliverable acceptance and maintenance")
  d.para(orNA(input.acceptanceCriteria))
  d.para(orNA(input.maintenanceResponsibilities))
  d.heading("6. Revocation and handover")
  d.para(orNA(input.revocationAndHandover))
  d.para("At completion, expiry or request, the Partner shall return documentation and data, transfer agreed deliverables, support transition and certify deletion where instructed. MartPoint may revoke credentials and access immediately when the approved purpose ends or risk requires it.")
  d.heading("Signatures")
  d.signatureTable([
    { side: "MartPoint", name: "", title: "", email: "" },
    { side: "Partner", name: "", title: "", email: "" },
  ])
  return d.finish(`MartPoint-Technology-Schedule-${safeFileStem(input.control.documentId)}.pdf`)
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

/* ═══════════════  Referral Partner controlled document pack (v1.0)  ═══════════════
 * The referral outputs the portal must generate around the Master Partner
 * Agreement's Referral Partner Schedule. Every commercial figure is a merge
 * field resolved from the signed Commission Schedule or the source finance
 * record — these templates never state a rate on their own authority, and a
 * missing value renders as "Not applicable" rather than invented text.
 */

export interface ReferralSignatory {
  name: string
  title: string
  email: string
}

/** Commercial terms resolved from the EXECUTED schedule row. */
export interface ReferralScheduleSummary {
  reference: string
  version: number
  status: string
  firstYearRatePercent: number | null
  firstRenewalRatePercent: number | null
  protectionDays: number | null
  holdingDays: number | null
  payoutDaysAfterMonthEnd: number | null
  effectiveFrom: string | null
}

function pct(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? NOT_APPLICABLE : `${value}%`
}

function dayCount(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? NOT_APPLICABLE : `${value} days`
}

/* ─── R1. Referral Partner Agreement and Schedule ─────────────────────────── */

export interface ReferralAgreementInput {
  control: DocControl
  partner: PartnerIdentity
  reference: string
  effectiveDate: string | null
  schedule: ReferralScheduleSummary | null
  eligibleItems: string | null
  exclusions: string | null
  martpointSignatory: ReferralSignatory
  partnerSignatory: ReferralSignatory
  approvedBy: string | null
}

export function renderReferralAgreement(
  input: ReferralAgreementInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner, schedule } = input
  const d = new PartnerDocBuilder({
    logoDataUrl: opts?.logoDataUrl,
    footerRef: `${input.control.documentId} — ${partner.legalName}`,
  })

  d.title("REFERRAL PARTNER AGREEMENT", input.reference)
  d.para(
    `This Agreement is made between MartPoint and ${partner.legalName} (Partner ID ${partner.partnerId}) and governs Referral Partner activity in the MartPoint partner portal.`,
    { gap: 12 }
  )

  d.heading("Document control")
  controlTable(d, input.control)
  d.fieldTable([
    ["Agreement reference", input.reference],
    ["Effective date", fmtDate(input.effectiveDate)],
    ["Approved by", orNA(input.approvedBy)],
    ["Commission Schedule in force", schedule ? `${schedule.reference} (version ${schedule.version})` : NOT_APPLICABLE],
  ])

  d.heading("1. Appointment")
  d.para(
    `MartPoint appoints ${partner.legalName} as a non-exclusive Referral Partner. This appointment creates no employment, agency, partnership or authority to bind MartPoint, and MartPoint remains free to appoint others and to sell directly.`,
    { gap: 10 }
  )

  d.heading("2. Scope of activity")
  d.listItem("Introduce prospective customers who are genuinely new to MartPoint, with their consent to be contacted.")
  d.listItem("Share only the approved MartPoint partner description and current portal materials.")
  d.listItem("Submit each referral through the partner portal before the prospect's qualifying MartPoint transaction.")

  d.heading("3. Registration, acceptance and protection")
  d.listItem(`A referral is assessed for consent, completeness and duplication on submission. Only Sales with Partner Operations may accept a referral.`)
  d.listItem(`An accepted referral is protected for ${schedule ? dayCount(schedule.protectionDays) : "the period stated in the signed Commission Schedule"}, running from the acceptance date.`)
  d.listItem("Protection may be extended only by a recorded MartPoint decision. Expiry releases the attribution without creating any liability.")

  d.heading("4. No payment for a referral")
  d.callout(
    "No commission is payable for a name, a lead, a meeting, a demonstration, a quotation, an invoice or a promise to pay. Submission and acceptance of a referral create no earning.",
    { title: "Approved commercial rule" }
  )

  d.heading("5. Commission trigger")
  d.para("A commission arises only when every condition below is satisfied and Finance has approved the earning:", { gap: 6 })
  d.listItem("The referral attribution is accepted and still valid.")
  d.listItem("This Agreement and a signed Commission Schedule are both in force.")
  d.listItem("The customer has made a cleared eligible payment for MartPoint software.")
  d.listItem("The customer licence is activated.")
  d.listItem("The holding period stated in the Commission Schedule has completed.")
  d.listItem("No blocking refund, chargeback, dispute or compliance hold applies.")
  if (schedule) {
    d.fieldTable([
      ["First-year rate", pct(schedule.firstYearRatePercent)],
      ["First collected renewal rate", pct(schedule.firstRenewalRatePercent)],
      ["Holding period", dayCount(schedule.holdingDays)],
      ["Revenue basis", orNA(input.eligibleItems)],
    ])
  } else {
    d.para(`No Commission Schedule is in force for this Agreement, so no rate applies: ${NOT_APPLICABLE}.`, { gap: 8 })
  }

  d.heading("6. Partner restrictions")
  d.listItem("Do not negotiate or set prices, discounts or payment terms.")
  d.listItem("Do not collect payment on MartPoint's behalf or issue an invoice.")
  d.listItem("Do not request or accept customer credentials or access to a customer account.")
  d.listItem("Do not implement, configure, bind or make delivery commitments for MartPoint.")
  d.listItem("Do not make unapproved claims about MartPoint products, results or pricing.")

  d.heading("7. Confidentiality and data")
  d.para(
    "Personal data introduced through a referral may be used only to assess and service that referral. Confidential sales information belonging to MartPoint or another partner must not be sought or retained. Security incidents affecting MartPoint or customer data must be reported without delay, and introduced data must be returned or deleted when the referral closes or this Agreement ends.",
    { gap: 8 }
  )
  d.para(`Excluded from any eligible revenue calculation: ${orNA(input.exclusions)}`, { gap: 8 })

  d.heading("8. Term and exit")
  d.listItem("MartPoint may suspend or terminate this appointment on an authorised Management decision, effective on the date stated in the notice.")
  d.listItem(`Approved eligible commissions are paid within ${schedule ? dayCount(schedule.payoutDaysAfterMonthEnd) : "the period stated in the Commission Schedule"} after the applicable monthly statement is issued.`)
  d.listItem("On exit, the partner must stop representing MartPoint, protect introduced data and complete any requested handover of records.")

  d.heading("9. Signatures")
  d.para("Signed by authorised representatives of both parties.", { gap: 6 })
  d.signatureTable([
    { side: "MartPoint", name: input.martpointSignatory.name, title: input.martpointSignatory.title, email: input.martpointSignatory.email },
    { side: partner.legalName, name: input.partnerSignatory.name, title: input.partnerSignatory.title, email: input.partnerSignatory.email },
  ])

  return d.finish(`MartPoint-Referral-Agreement-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── R2. Referral Commission Schedule ───────────────────────────────────── */

export interface ReferralCommissionScheduleInput {
  control: DocControl
  partner: PartnerIdentity
  reference: string
  version: number
  agreementReference: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  terms: ReferralScheduleSummary
  revenueBasis: string | null
  eligibleItems: string | null
  exclusions: string | null
  renewalRule: string | null
  statementCycle: string | null
  approvedSplit: string | null
  recordedApprover: ReferralSignatory | null
}

export function renderReferralCommissionSchedule(
  input: ReferralCommissionScheduleInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner, terms } = input
  const d = new PartnerDocBuilder({
    logoDataUrl: opts?.logoDataUrl,
    footerRef: `${input.control.documentId} — ${partner.legalName}`,
  })

  d.title("REFERRAL COMMISSION SCHEDULE", input.reference)
  d.para(
    "This Schedule states the commercial terms that control Referral Partner earnings. While it is in force it is authoritative over any standard rate described elsewhere.",
    { gap: 12 }
  )

  d.heading("Document control")
  controlTable(d, input.control)
  d.fieldTable([
    ["Schedule reference", input.reference],
    ["Version", String(input.version)],
    ["Parent Agreement", orNA(input.agreementReference)],
    ["Effective from", fmtDate(input.effectiveFrom)],
    ["Effective to", fmtDate(input.effectiveTo)],
  ])

  d.heading("1. Rates")
  d.fieldTable([
    ["First-year eligible collected software revenue", pct(terms.firstYearRatePercent)],
    ["First collected renewal only", pct(terms.firstRenewalRatePercent)],
    ["Renewal rule", orNA(input.renewalRule)],
  ])

  d.heading("2. Eligible revenue")
  d.fieldTable([
    ["Revenue basis", orNA(input.revenueBasis)],
    ["Eligible items", orNA(input.eligibleItems)],
  ])

  d.heading("3. Exclusions")
  d.para(orNA(input.exclusions), { gap: 10 })

  d.heading("4. Attribution")
  d.fieldTable([
    ["Protection period", dayCount(terms.protectionDays)],
    ["Protection runs from", "The acceptance date recorded on the referral"],
    ["Duplicate and inactivity rules", "A referral matching an existing customer, lead, opportunity or accepted referral is not accepted; protection lapses on its expiry date unless MartPoint records an extension"],
    input.approvedSplit ? ["Approved split", input.approvedSplit] : ["Approved split", "None"],
  ])

  d.heading("5. Holding period")
  d.fieldTable([
    ["Holding period", dayCount(terms.holdingDays)],
    ["Acquisition holding starts from", "The later of the cleared eligible payment or required licence activation"],
    ["Renewal holding starts from", "The later of the cleared renewal payment or effective subscription renewal"],
    ["Earning status during holding", "HELD — not payable, not disputable as an amount"],
  ])

  d.heading("6. Statements and payout")
  d.fieldTable([
    ["Statement cycle", orNA(input.statementCycle)],
    ["Payout timing", `Within ${dayCount(terms.payoutDaysAfterMonthEnd)} after monthly statement issuance`],
    ["Pre-issue validation", "Bank details verified, Finance approval recorded, no blocking refund, chargeback, dispute or compliance hold"],
  ])

  d.heading("7. Reversals and disputes")
  d.listItem("A refund, credit or chargeback creates a linked adjustment against the earning; an approved or paid earning is never silently overwritten.")
  d.listItem("Adjustments may be set off against a later statement or payout.")
  d.listItem("A partner may dispute a line by quoting the statement and line reference with supporting evidence inside the query period.")
  d.listItem("Disputes are decided by Finance with Partner Operations; the decision and reason are recorded in the audit history.")

  d.heading("8. Approval")
  d.para("This Schedule is approved by Finance and Management before it is signed, and it is the authority for every rate and period stated above.", { gap: 6 })
  d.fieldTable([
    ["Approved by", input.recordedApprover ? `${input.recordedApprover.name} — ${input.recordedApprover.title}` : NOT_APPLICABLE],
    ["Approval recorded at", fmtDate(input.control.generatedAt)],
  ])
  d.para("Superseding this Schedule requires a new version, signed before it takes effect. Issued versions are retained and never overwritten.", { gap: 8 })

  return d.finish(`MartPoint-Referral-Commission-Schedule-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── R3. Referral Acceptance Notice ─────────────────────────────────────── */

export interface ReferralAcceptanceNoticeInput {
  control: DocControl
  partner: PartnerIdentity
  referralReference: string
  prospectName: string
  submittedAt: string | null
  acceptedAt: string
  reviewer: string | null
  protectionStart: string | null
  protectionExpiry: string | null
  protectionDays: number | null
  protectionSource: string | null
  martpointOwner: string | null
  partnerNextStep: string | null
}

export function renderReferralAcceptanceNotice(
  input: ReferralAcceptanceNoticeInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({
    logoDataUrl: opts?.logoDataUrl,
    footerRef: `${input.control.documentId} — ${partner.legalName}`,
  })

  d.title("REFERRAL ACCEPTANCE NOTICE", input.control.documentId)
  d.para(`MartPoint has accepted the referral below as a new introduction from ${partner.legalName}.`, { gap: 12 })

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Referral")
  d.fieldTable([
    ["Referral reference", input.referralReference],
    ["Prospect business", input.prospectName],
    ["Submitting partner", `${partner.legalName} (${partner.partnerId})`],
    ["Submitted", fmtDate(input.submittedAt)],
  ])

  d.heading("Decision")
  d.fieldTable([
    ["Decision", "Accepted"],
    ["Acceptance date", fmtDate(input.acceptedAt)],
    ["Recorded by", orNA(input.reviewer)],
  ])

  d.heading("Attribution protection")
  d.fieldTable([
    ["Protection starts", fmtDate(input.protectionStart)],
    ["Protection expires", fmtDate(input.protectionExpiry)],
    ["Protection period", dayCount(input.protectionDays)],
    ["Period source", orNA(input.protectionSource)],
    ["Extension", "Only by a recorded MartPoint decision before expiry"],
  ])

  d.heading("What acceptance means")
  d.callout(
    "Acceptance records attribution only. It does not create a commission, an earning or any access to the prospect's or a customer's account.",
    { title: "Boundary" }
  )

  d.heading("Next step")
  d.fieldTable([
    ["MartPoint owner", orNA(input.martpointOwner)],
    ["Partner action", orNA(input.partnerNextStep)],
  ])

  return d.finish(`MartPoint-Referral-Acceptance-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── R4. Referral Information Request / Decision Notice ─────────────────── */

export interface ReferralDecisionNoticeInput {
  control: DocControl
  partner: PartnerIdentity
  referralReference: string
  prospectName: string
  decisionLabel: string
  effectiveDate: string
  reason: string | null
  requiredAction: string | null
  responseDue: string | null
  attributionEffect: string
  commissionEffect: string
  reviewContact: string
  decidedBy: string | null
}

export function renderReferralDecisionNotice(
  input: ReferralDecisionNoticeInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({
    logoDataUrl: opts?.logoDataUrl,
    footerRef: `${input.control.documentId} — ${partner.legalName}`,
  })

  d.title(`REFERRAL ${input.decisionLabel}`, input.control.documentId)
  d.para(`This notice records the MartPoint decision on referral ${input.referralReference}.`, { gap: 12 })

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Referral")
  d.fieldTable([
    ["Referral reference", input.referralReference],
    ["Prospect business", input.prospectName],
    ["Partner", `${partner.legalName} (${partner.partnerId})`],
  ])

  d.heading("Decision")
  d.fieldTable([
    ["Status", input.decisionLabel],
    ["Effective date", fmtDate(input.effectiveDate)],
    ["Recorded by", orNA(input.decidedBy)],
    ["Reason", orNA(input.reason)],
  ])
  d.para("The reason states the factual category only. Another partner's identity, private sales notes and confidential commercial data are never disclosed in this notice.", { gap: 8 })

  d.heading("Required action")
  d.fieldTable([
    ["Action", orNA(input.requiredAction)],
    ["Respond by", fmtDate(input.responseDue)],
  ])

  d.heading("Effect on your position")
  d.fieldTable([
    ["Attribution", input.attributionEffect],
    ["Commission", input.commissionEffect],
  ])

  d.heading("Review route")
  d.para(`To request a review, contact ${orNA(input.reviewContact)} quoting ${input.control.documentId} within the response period in your Agreement.`, { gap: 6 })

  return d.finish(`MartPoint-Referral-Decision-${safeFileStem(input.control.documentId)}.pdf`)
}

/* ─── R5. Referral Commission Statement ──────────────────────────────────── */

export interface ReferralCommissionStatementLine {
  referralReference: string
  customer: string
  invoiceNumber: string | null
  clearedAt: string | null
  activatedAt: string | null
  eligibleBase: string
  rate: string
  amount: string
  status: string
  holdingCompletedAt: string | null
  approvedBy: string | null
  payoutReference: string | null
}

export interface ReferralCommissionStatementInput {
  control: DocControl
  partner: PartnerIdentity
  currency: string
  period: { from: string | null; to: string | null }
  scheduleReference: string | null
  lines: ReferralCommissionStatementLine[]
  adjustments: { date: string | null; description: string; amount: string }[]
  totals: { eligible: number; approved: number; held: number; reversed: number; netPayable: number }
  disputeContact: string
  disputeDeadline: string | null
}

export function renderReferralCommissionStatement(
  input: ReferralCommissionStatementInput,
  opts?: { logoDataUrl?: string }
): GeneratedPdf {
  const { partner } = input
  const d = new PartnerDocBuilder({
    logoDataUrl: opts?.logoDataUrl,
    footerRef: `${input.control.documentId} — ${partner.legalName}`,
  })

  d.title("REFERRAL COMMISSION STATEMENT", input.control.documentId)
  d.para(
    "Statement of referral earnings closed by MartPoint Finance for the period below. Every line is derived from a cleared payment, a licence activation and the signed Commission Schedule. This statement is not proof of payment.",
    { gap: 12 }
  )

  d.heading("Document control")
  controlTable(d, input.control)

  d.heading("Partner and period")
  d.fieldTable([
    ["Partner", `${partner.legalName} (${partner.partnerId})`],
    ["Currency", input.currency],
    ["Period from", fmtDate(input.period.from)],
    ["Period to", fmtDate(input.period.to)],
    ["Commission Schedule applied", orNA(input.scheduleReference)],
  ])

  d.heading("Earning lines")
  if (input.lines.length === 0) {
    d.para("No referral earning lines in this period. Referrals that were submitted, accepted, quoted or invoiced but not paid create no line.")
  } else {
    d.table(
      ["Referral", "Customer", "Invoice", "Cleared", "Eligible base", "Rate", "Commission", "Status"],
      input.lines.map((l) => [
        l.referralReference,
        l.customer,
        orNA(l.invoiceNumber),
        fmtDate(l.clearedAt),
        l.eligibleBase,
        l.rate,
        l.amount,
        l.status,
      ])
    )
  }

  d.heading("Holding, approval and payout references")
  if (input.lines.length === 0) {
    d.para(NOT_APPLICABLE)
  } else {
    d.table(
      ["Referral", "Licence activation", "Holding completed", "Approved by", "Payout reference"],
      input.lines.map((l) => [
        l.referralReference,
        fmtDate(l.activatedAt),
        fmtDate(l.holdingCompletedAt),
        orNA(l.approvedBy),
        orNA(l.payoutReference),
      ])
    )
  }

  d.heading("Adjustments")
  if (input.adjustments.length === 0) {
    d.para("No refunds, credits, chargebacks, tax or other approved adjustments in this period.")
  } else {
    d.table(
      ["Date", "Description", "Amount"],
      input.adjustments.map((a) => [fmtDate(a.date), a.description, a.amount])
    )
  }

  d.heading("Totals")
  d.fieldTable([
    ["Eligible", fmtMoney(input.totals.eligible, input.currency)],
    ["Approved", fmtMoney(input.totals.approved, input.currency)],
    ["Held", fmtMoney(input.totals.held, input.currency)],
    ["Reversed and adjusted", fmtMoney(input.totals.reversed, input.currency)],
    ["Net payable (subject to Finance approval and payout)", fmtMoney(input.totals.netPayable, input.currency)],
  ])

  d.heading("Disputes")
  d.para(
    `To dispute a line, quote this statement and the line reference with supporting evidence${input.disputeDeadline ? ` by ${fmtDate(input.disputeDeadline)}` : ""}. Contact ${orNA(input.disputeContact)}.`,
    { gap: 6 }
  )

  return d.finish(`MartPoint-Referral-Commission-Statement-${safeFileStem(input.control.documentId)}.pdf`)
}
