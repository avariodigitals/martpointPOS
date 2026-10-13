/* ───────────────────────────  Referral commission engine (pure)  ───────────────────────────
 * Every figure here is computed from immutable source records:
 * invoice lines, confirmed payment allocations, licence activation dates and
 * the active signed Commission Schedule. Rates are never hard-coded — callers
 * must pass the schedule terms read from partner_commission_schedules.
 *
 * No Supabase imports: this module is safe for unit tests and for reuse from
 * cron sweeps, payment confirmation and admin overrides alike.
 */

/* ─── kobo-safe money helpers (naira in, naira out, 2dp) ─── */

function toKobo(n: number): number {
  return Math.round((Number(n) || 0) * 100)
}

function fromKobo(k: number): number {
  return Math.round(k) / 100
}

/* ─── Invoice line eligibility ─── */

export type InvoiceItemType = "PLAN" | "ADDON" | "SERVICE" | "CUSTOM"

export interface InvoiceLineInput {
  id: string
  itemType: InvoiceItemType
  description: string
  quantity: number
  unitPrice: number
  discount: number
  /** Absolute tax (VAT) amount on the line, in naira. */
  tax: number
}

export type ExclusionReason =
  | "TAX"
  | "HARDWARE"
  | "LOGISTICS"
  | "IMPLEMENTATION"
  | "TRAINING"
  | "DATA_MIGRATION"
  | "THIRD_PARTY"
  | "FINANCE_CHARGE"
  | "NON_SOFTWARE_SERVICE"
  | "UNSUPPORTED_CUSTOM_WORK"

const KEYWORD_RULES: Array<{ re: RegExp; reason: ExclusionReason }> = [
  { re: /\b(hardware|pos terminal|terminal|scanner|printer|card reader|device|tablet|receipt roll)s?\b/, reason: "HARDWARE" },
  { re: /\b(logistics|delivery|shipping|freight|courier)\b/, reason: "LOGISTICS" },
  { re: /\b(implementation|install(ation)?|setup|set-up|configuration|deploy(ment)?|customi[sz]ation)\b/, reason: "IMPLEMENTATION" },
  { re: /\b(training|workshop|coaching session)\b/, reason: "TRAINING" },
  { re: /\b(migration|data import|data export|data cleanup)\b/, reason: "DATA_MIGRATION" },
  { re: /\b(third[- ]party|resold|resale|partner fee)\b/, reason: "THIRD_PARTY" },
  { re: /\b(finance charge|interest|processing fee|bank charge)\b/, reason: "FINANCE_CHARGE" },
]

export interface ClassifiedLine {
  id: string
  description: string
  itemType: InvoiceItemType
  netNaira: number
  eligible: boolean
  reason: ExclusionReason | null
}

export function lineNetNaira(line: InvoiceLineInput): number {
  const qty = Number(line.quantity) || 0
  return fromKobo(toKobo(line.unitPrice) * qty - toKobo(line.discount))
}

/** Eligible = MartPoint software. Tax is excluded by construction (net = pre-tax). */
export function classifyInvoiceLine(line: InvoiceLineInput): ClassifiedLine {
  const net = lineNetNaira(line)
  const text = (line.description || "").toLowerCase()

  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(text)) {
      return { id: line.id, description: line.description, itemType: line.itemType, netNaira: net, eligible: false, reason: rule.reason }
    }
  }

  if (line.itemType === "PLAN") {
    return { id: line.id, description: line.description, itemType: line.itemType, netNaira: net, eligible: true, reason: null }
  }
  if (line.itemType === "ADDON") {
    return { id: line.id, description: line.description, itemType: line.itemType, netNaira: net, eligible: true, reason: null }
  }
  if (line.itemType === "SERVICE") {
    return { id: line.id, description: line.description, itemType: line.itemType, netNaira: net, eligible: false, reason: "NON_SOFTWARE_SERVICE" }
  }
  return { id: line.id, description: line.description, itemType: line.itemType, netNaira: net, eligible: false, reason: "UNSUPPORTED_CUSTOM_WORK" }
}

export interface EligibleBaseInput {
  lines: InvoiceLineInput[]
  /** Invoice total the customer must pay, including tax (invoices.total_amount). */
  invoiceGrossNaira: number
  /** Gross amount actually cleared (confirmed payment allocations) against the invoice. */
  clearedGrossNaira: number
  /** Absolute tax present on the invoice lines (for reporting). */
  taxNaira?: number
}

export interface EligibleBase {
  eligibleLines: ClassifiedLine[]
  excludedLines: ClassifiedLine[]
  grossNetNaira: number
  eligibleNetNaira: number
  excludedNetNaira: number
  taxExcludedNaira: number
  /** The share of eligible software revenue actually cleared by the customer. */
  clearedEligibleNaira: number
  /** Fraction of the invoice paid so far (0..1), tax included. */
  paymentFraction: number
}

export function computeEligibleBase(input: EligibleBaseInput): EligibleBase {
  const classified = (input.lines || []).map(classifyInvoiceLine)
  const eligibleLines = classified.filter((l) => l.eligible)
  const excludedLines = classified.filter((l) => !l.eligible)

  const grossNetNaira = fromKobo(classified.reduce((s, l) => s + toKobo(l.netNaira), 0))
  const eligibleNetNaira = fromKobo(eligibleLines.reduce((s, l) => s + toKobo(l.netNaira), 0))
  const excludedNetNaira = fromKobo(excludedLines.reduce((s, l) => s + toKobo(l.netNaira), 0))

  const invoiceGross = Math.max(0, Number(input.invoiceGrossNaira) || 0)
  const clearedGross = Math.max(0, Number(input.clearedGrossNaira) || 0)
  const paymentFraction = invoiceGross > 0 ? Math.min(1, clearedGross / invoiceGross) : 0

  const clearedEligibleNaira = fromKobo(Math.round(toKobo(eligibleNetNaira) * paymentFraction))

  return {
    eligibleLines,
    excludedLines,
    grossNetNaira,
    eligibleNetNaira,
    excludedNetNaira,
    taxExcludedNaira: Math.max(0, Number(input.taxNaira) || 0),
    clearedEligibleNaira,
    paymentFraction,
  }
}

/* ─── Schedule terms (read from the signed Commission Schedule — never hard-coded) ─── */

export interface ScheduleTerms {
  firstYearRatePercent: number
  firstRenewalRatePercent: number
  holdingDays: number
  protectionDays: number
  payoutDaysAfterMonthEnd: number
  approvedSplit: string
}

export const STANDARD_SCHEDULE_TERMS: ScheduleTerms = {
  firstYearRatePercent: 10,
  firstRenewalRatePercent: 5,
  holdingDays: 30,
  protectionDays: 90,
  payoutDaysAfterMonthEnd: 14,
  approvedSplit: "",
}

export type EarningKind = "FIRST_YEAR" | "RENEWAL"

export function rateForEarning(terms: ScheduleTerms, kind: EarningKind): number {
  return kind === "RENEWAL" ? terms.firstRenewalRatePercent : terms.firstYearRatePercent
}

/* ─── Commission calculation ─── */

export function calculateReferralCommission(input: {
  clearedEligibleNaira: number
  ratePercent: number
  taxDeductionNaira?: number
}): { commissionNaira: number; basisNaira: number; ratePercent: number } {
  const basis = Math.max(0, Number(input.clearedEligibleNaira) || 0)
  const rate = Number(input.ratePercent) || 0
  const gross = fromKobo(Math.round(toKobo(basis) * rate / 100))
  const net = Math.max(0, fromKobo(toKobo(gross) - toKobo(input.taxDeductionNaira || 0)))
  return { commissionNaira: net, basisNaira: basis, ratePercent: rate }
}

/* ─── Triggers ───
 * NO payment is earned for any of the pre-payment events. Only cleared
 * customer money creates an earning.
 */

export type EarningTrigger =
  | "LEAD_SUBMITTED"
  | "REFERRAL_ACCEPTED"
  | "MEETING_ARRANGED"
  | "DEMONSTRATION_ATTENDED"
  | "QUOTATION_REQUESTED"
  | "INVOICE_ISSUED"
  | "VERBAL_COMMITMENT"
  | "UNPAID_ORDER"
  | "CLEARED_CUSTOMER_PAYMENT"
  | "CLEARED_RENEWAL_PAYMENT"

const PAYING_TRIGGERS: EarningTrigger[] = ["CLEARED_CUSTOMER_PAYMENT", "CLEARED_RENEWAL_PAYMENT"]

export function earningAllowedForTrigger(trigger: EarningTrigger): boolean {
  return PAYING_TRIGGERS.includes(trigger)
}

/* ─── Earning statuses & transitions ─── */

export const EARNING_STATUSES = [
  "POTENTIAL",
  "PENDING",
  "ELIGIBLE",
  "APPROVED",
  "PAID",
  "HELD",
  "REVERSED",
  "DISPUTED",
] as const

export type EarningStatus = (typeof EARNING_STATUSES)[number]

export const EARNING_TRANSITIONS: Record<EarningStatus, EarningStatus[]> = {
  POTENTIAL: ["PENDING", "HELD", "REVERSED"],
  PENDING: ["ELIGIBLE", "HELD", "DISPUTED", "REVERSED"],
  ELIGIBLE: ["APPROVED", "HELD", "DISPUTED", "REVERSED"],
  APPROVED: ["PAID", "HELD", "DISPUTED", "REVERSED"],
  PAID: ["DISPUTED", "REVERSED"],
  HELD: ["PENDING", "ELIGIBLE", "DISPUTED", "REVERSED"],
  DISPUTED: ["ELIGIBLE", "APPROVED", "REVERSED"],
  REVERSED: [],
}

export function earningTransitionAllowed(from: string, to: string): boolean {
  if (!(EARNING_STATUSES as readonly string[]).includes(from)) return false
  if (!(EARNING_STATUSES as readonly string[]).includes(to)) return false
  return EARNING_TRANSITIONS[from as EarningStatus].includes(to as EarningStatus)
}

/* ─── Eligibility gates ─── */

export type EligibilityGate =
  | "ATTRIBUTION"
  | "AGREEMENT"
  | "SCHEDULE"
  | "PAYMENT"
  | "ACTIVATION"
  | "HOLDING"
  | "COMPLIANCE"

export interface EligibilityInput {
  /** Referral accepted and protection valid for the earning event. */
  attributionAccepted: boolean
  /** Referral Partner Agreement (and schedule agreement) EXECUTED/ACTIVE at the event. */
  agreementActive: boolean
  /** An EXECUTED Commission Schedule exists and covers the event. */
  scheduleExecuted: boolean
  /** Gross cleared (confirmed) eligible customer money on this invoice. */
  clearedGrossNaira: number
  paymentClearedAt: string | null
  licenceActivatedAt: string | null
  holdingDays: number
  now: string
  /** Refund, chargeback, dispute or compliance hold in force. */
  blockingHold: boolean
}

export interface EligibilityResult {
  eligible: boolean
  status: EarningStatus
  failedGates: EligibilityGate[]
  holdingStartsAt: string | null
  holdingCompletesAt: string | null
}

export function evaluateReferralEligibility(input: EligibilityInput): EligibilityResult {
  const failed: EligibilityGate[] = []

  if (!input.attributionAccepted) failed.push("ATTRIBUTION")
  if (!input.scheduleExecuted) failed.push("SCHEDULE")
  if (!input.agreementActive) failed.push("AGREEMENT")

  const hasMoney = (Number(input.clearedGrossNaira) || 0) > 0
  if (!hasMoney) failed.push("PAYMENT")

  if (hasMoney && !input.licenceActivatedAt) failed.push("ACTIVATION")

  let holdingStartsAt: string | null = null
  let holdingCompletesAt: string | null = null
  if (input.licenceActivatedAt && input.paymentClearedAt) {
    const start = Math.max(
      new Date(input.paymentClearedAt).getTime(),
      new Date(input.licenceActivatedAt).getTime()
    )
    holdingStartsAt = new Date(start).toISOString()
    holdingCompletesAt = new Date(start + Math.max(0, input.holdingDays) * 86_400_000).toISOString()
    if (new Date(input.now).getTime() < new Date(holdingCompletesAt).getTime()) {
      failed.push("HOLDING")
    }
  }

  // Compliance hold overrides everything once money exists.
  if (input.blockingHold && hasMoney) failed.push("COMPLIANCE")

  const eligible = failed.length === 0

  let status: EarningStatus
  if (input.blockingHold && hasMoney) {
    status = "HELD"
  } else if (!hasMoney) {
    status = "POTENTIAL"
  } else if (failed.includes("ATTRIBUTION") || failed.includes("AGREEMENT") || failed.includes("SCHEDULE")) {
    status = "HELD"
  } else if (failed.length > 0) {
    status = "PENDING"
  } else {
    status = "ELIGIBLE"
  }

  return { eligible, status, failedGates: failed, holdingStartsAt, holdingCompletesAt }
}

/* ─── Refunds, chargebacks and linked adjustments ─── */

export interface RefundInput {
  commissionNaira: number
  refundedNaira: number
  clearedNaira: number
  /** Chargebacks behave like refunds but keep their own adjustment kind. */
  kind?: "REFUND" | "CHARGEBACK"
  /** Current earning status — approved/paid earnings are never overwritten. */
  earningStatus: EarningStatus | string
}

export interface RefundOutcome {
  /** Amount of the linked (negative) adjustment; 0 = no adjustment row needed. */
  adjustmentNaira: number
  /** Set on the ORIGINAL earning — only allowed when it is not yet approved or paid. */
  setOriginalToReversed: boolean
  kind: "REFUND" | "CHARGEBACK"
  reason: string
}

export function computeRefundAdjustment(input: RefundInput): RefundOutcome {
  const kind = input.kind ?? "REFUND"
  const refunded = Math.max(0, Number(input.refundedNaira) || 0)
  const cleared = Math.max(0, Number(input.clearedNaira) || 0)
  const commission = Math.max(0, Number(input.commissionNaira) || 0)
  if (refunded <= 0 || commission <= 0) {
    return { adjustmentNaira: 0, setOriginalToReversed: false, kind, reason: "" }
  }

  const full = cleared <= 0 || refunded >= cleared
  const locked = input.earningStatus === "APPROVED" || input.earningStatus === "PAID" || input.earningStatus === "SCHEDULED"

  if (full) {
    if (locked) {
      // Never overwrite an approved/paid earning: linked negative adjustment.
      return { adjustmentNaira: -commission, setOriginalToReversed: false, kind, reason: `Full ${kind.toLowerCase()} after approval` }
    }
    return { adjustmentNaira: 0, setOriginalToReversed: true, kind, reason: `Full ${kind.toLowerCase()} removed eligibility` }
  }

  // Partial refund reduces the base proportionately via a linked adjustment.
  const portion = fromKobo(Math.round(toKobo(commission) * (refunded / cleared)))
  return {
    adjustmentNaira: -Math.min(commission, portion),
    setOriginalToReversed: false,
    kind,
    reason: `Partial ${kind.toLowerCase()} — eligible base reduced proportionately`,
  }
}

/* ─── Referral + Channel stacking ─── */

export interface StackingCheckInput {
  /** Approved split text from the signed Commission Schedule, if any. */
  approvedSplit: string
  /** Non-reversed earnings already booked on the same business/invoice. */
  existingCommissions: Array<{
    beneficiaryPartnerId: string
    attributionType: string
    status: string
  }>
  partnerId: string
}

export function evaluateStacking(input: StackingCheckInput): { blocked: boolean; reason: string } {
  const hasSplit = (input.approvedSplit || "").trim().length > 0
  if (hasSplit) return { blocked: false, reason: "" }

  const conflict = input.existingCommissions.find(
    (c) =>
      c.beneficiaryPartnerId !== input.partnerId &&
      c.status !== "REVERSED" &&
      c.status !== "CANCELLED" &&
      (c.attributionType === "SALES" || c.attributionType === "IMPLEMENTATION")
  )
  if (conflict) {
    return {
      blocked: true,
      reason: "Referral and Channel acquisition rewards do not stack unless an approved split is written into the Commission Schedule",
    }
  }
  return { blocked: false, reason: "" }
}

/* ─── Renewal rule: first collected renewal only ─── */

export function renewalEarningAllowed(input: {
  earningKind: EarningKind
  existingRenewalEarnings: number
}): { allowed: boolean; reason: string } {
  if (input.earningKind !== "RENEWAL") return { allowed: true, reason: "" }
  if (input.existingRenewalEarnings > 0) {
    return { allowed: false, reason: "Only the first collected renewal earns commission under the standard schedule" }
  }
  return { allowed: true, reason: "" }
}

/* ─── Holding period & payout timing ─── */

export function holdingCompletionAt(paymentClearedAt: string, licenceActivatedAt: string, holdingDays: number): string {
  const start = Math.max(new Date(paymentClearedAt).getTime(), new Date(licenceActivatedAt).getTime())
  return new Date(start + Math.max(0, holdingDays) * 86_400_000).toISOString()
}

/** Approved payouts are due within N days after the month-end of approval. */
export function payoutDueAt(approvedAt: string, payoutDaysAfterMonthEnd: number): string {
  const d = new Date(approvedAt)
  const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
  return new Date(monthEnd.getTime() + Math.max(0, payoutDaysAfterMonthEnd) * 86_400_000).toISOString()
}

/* ─── Attribution protection window ─── */

export function protectionExpiry(acceptanceDate: string, protectionDays: number): string {
  return new Date(new Date(acceptanceDate).getTime() + Math.max(0, protectionDays) * 86_400_000).toISOString()
}

export function attributionValidAt(
  acceptanceDate: string | null,
  protectionExpiryDate: string | null,
  at: string
): boolean {
  if (!acceptanceDate || !protectionExpiryDate) return false
  const t = new Date(at).getTime()
  return t >= new Date(acceptanceDate).getTime() && t <= new Date(protectionExpiryDate).getTime()
}
