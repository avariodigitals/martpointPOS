/* ───────────────────────────  Referral finance service  ───────────────────────────
 * Turns cleared customer money into referral commission earnings, walks them
 * through the approved earning statuses and hands Finance a reproducible
 * calculation record.
 *
 * Nothing here invents a figure: every amount is derived from immutable
 * sources — invoice lines, confirmed payment allocations, the licence record
 * and the partner's active signed Commission Schedule. Rates, holding days and
 * payout timing come from the schedule row, never from constants in code.
 *
 * Earnings are only booked on cleared money. Submission, acceptance, meetings,
 * demos, quotations and unpaid invoices create no earning.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import { emitReferralNotification } from "./referral-notifications"
import { getActiveSchedule, getAgreementForPartner, agreementInForce, type ScheduleRow } from "./referral-agreements"
import {
  attributionValidAt,
  calculateReferralCommission,
  computeEligibleBase,
  computeRefundAdjustment,
  evaluateReferralEligibility,
  evaluateStacking,
  rateForEarning,
  renewalEarningAllowed,
  type EarningKind,
  type EligibilityGate,
  type InvoiceLineInput,
  type ScheduleTerms,
} from "./referral-commission-engine"

type Row = Record<string, unknown>

function k(n: unknown): number {
  return Math.round((Number(n) || 0) * 100)
}
function nk(kobo: number): number {
  return Math.round(kobo) / 100
}
function str(v: unknown): string {
  return v == null ? "" : String(v)
}
function iso(v: unknown): string | null {
  if (!v) return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
function nowIso(): string {
  return new Date().toISOString()
}

/* Referral engine rows are identified by earning_kind — legacy rows written by
 * the generic pipeline leave it NULL and stay under the generic sweep. */
const ENGINE_STATUSES = ["POTENTIAL", "PENDING", "ELIGIBLE", "HELD"] as const
/* Approved / paid amounts are history: they change only through linked
 * adjustments, never through re-evaluation. */
const LOCKED_STATUSES = ["APPROVED", "PAID", "REVERSED", "CANCELLED", "DISPUTED", "SCHEDULED"]

/** Referral statuses that still carry a live attribution claim. */
const POST_ACCEPT_STATUSES = [
  "ACCEPTED",
  "QUALIFIED",
  "CONVERTED_UNPAID",
  "PAID_PENDING_ACTIVATION",
  "ACTIVATED_HOLDING",
  "COMMISSION_ELIGIBLE",
  "APPROVED",
  "PAID",
]

const GATE_REASONS: Record<EligibilityGate, string> = {
  ATTRIBUTION: "no accepted, protected referral attribution for this customer",
  AGREEMENT: "no Referral Partner Agreement in force",
  SCHEDULE: "no executed Commission Schedule in force",
  PAYMENT: "no cleared eligible customer payment",
  ACTIVATION: "customer licence not yet activated",
  HOLDING: "holding period not yet completed",
  COMPLIANCE: "refund, dispute or compliance hold in force",
}

/* ─── Referral commission plan rows (categorisation only — rates come from the schedule) ─── */

export const PLAN_FIRST_YEAR_NAME = "Referral Software First-Year Commission"
export const PLAN_RENEWAL_NAME = "Referral Software First-Renewal Commission"

let planCache: { firstYear: string; renewal: string } | null = null

async function loadReferralPlans(): Promise<{ firstYear: string; renewal: string } | null> {
  if (!isSupabaseConfigured()) return null
  if (planCache) return planCache
  const { data } = await supabase
    .from("commission_plans")
    .select("id, name")
    .in("name", [PLAN_FIRST_YEAR_NAME, PLAN_RENEWAL_NAME])
  const rows = (data || []) as Row[]
  const firstYear = rows.find((r) => r.name === PLAN_FIRST_YEAR_NAME)?.id
  const renewal = rows.find((r) => r.name === PLAN_RENEWAL_NAME)?.id
  if (!firstYear || !renewal) return null
  planCache = { firstYear: String(firstYear), renewal: String(renewal) }
  return planCache
}

/* ─── Earning context: every input the engine needs, from source records ─── */

interface EarningContext {
  partnerId: string
  partnerStatus: string
  businessId: string
  invoiceId: string
  invoiceNumber: string
  currency: string
  referral: Row | null
  licence: Row | null
  agreement: Row | null
  scheduleRow: ScheduleRow | null
  terms: ScheduleTerms | null
  lines: InvoiceLineInput[]
  invoiceTotalNaira: number
  invoiceIssueDate: string
  taxNaira: number
  clearedGrossNaira: number
  refundedNaira: number
  paymentClearedAt: string | null
  paymentIds: string[]
  kind: EarningKind
}

function toEngineItemType(itemType: string): InvoiceLineInput["itemType"] {
  if (itemType === "PLAN" || itemType === "ADDON" || itemType === "SERVICE") return itemType
  // PRODUCT lines are catalog goods (hardware/resale), not software licences.
  return "CUSTOM"
}

async function loadEarningContext(input: {
  partnerId: string
  businessId: string
  invoiceId: string
  /** When the earning event is a specific payment, gates are read at its clearing time. */
  at?: string | null
}): Promise<EarningContext | null> {
  if (!isSupabaseConfigured()) return null

  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", input.invoiceId).maybeSingle()
  if (!invoice) return null
  const inv = invoice as Row

  const [itemsRes, allocRes, licenceRes, referralRes, partnerRes, agreementRes, scheduleRes] = await Promise.all([
    supabase.from("invoice_items").select("*").eq("invoice_id", input.invoiceId),
    supabase
      .from("payment_allocations")
      .select("amount_allocated, payment_id, payments(status, confirmed_at, refunded_amount)")
      .eq("invoice_id", input.invoiceId),
    supabase.from("business_licenses").select("*").eq("business_id", input.businessId).maybeSingle(),
    loadReferralForBusiness(input.businessId, input.partnerId),
    supabase.from("partners").select("id, status, partner_type, public_email").eq("id", input.partnerId).maybeSingle(),
    getAgreementForPartner(input.partnerId, "REFERRAL_PARTNER_AGREEMENT"),
    getActiveSchedule(input.partnerId, input.at || undefined),
  ])

  const lines: InvoiceLineInput[] = (((itemsRes.data || []) as Row[]) || []).map((item) => ({
    id: str(item.id),
    itemType: toEngineItemType(str(item.item_type)),
    description: str(item.description),
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unit_price) || 0,
    discount: Number(item.discount) || 0,
    tax: Number(item.tax) || 0,
  }))

  // Only confirmed payments clear money; reversed/refunded allocations stop counting.
  let clearedK = 0
  let refundedK = 0
  let earliestCleared: string | null = null
  const paymentIds: string[] = []
  for (const a of ((allocRes.data || []) as Row[])) {
    const payment = a.payments as Row | null
    if (!payment || str(payment.status) !== "CONFIRMED") continue
    clearedK += k(a.amount_allocated)
    refundedK += k(payment.refunded_amount)
    const confirmedAt = iso(payment.confirmed_at)
    if (confirmedAt && (!earliestCleared || new Date(confirmedAt) < new Date(earliestCleared))) {
      earliestCleared = confirmedAt
    }
    if (a.payment_id) paymentIds.push(str(a.payment_id))
  }

  const licence = (licenceRes.data as Row | null) ?? null
  const kind = determineEarningKind(str(inv.issue_date), licence)

  return {
    partnerId: input.partnerId,
    partnerStatus: str((partnerRes.data as Row | null)?.status),
    businessId: input.businessId,
    invoiceId: input.invoiceId,
    invoiceNumber: str(inv.invoice_number),
    currency: str(inv.currency) || "NGN",
    referral: referralRes,
    licence: licence && str(licence.status) === "ACTIVE" ? licence : null,
    agreement: agreementRes,
    scheduleRow: scheduleRes.row,
    terms: scheduleRes.terms,
    lines,
    invoiceTotalNaira: Number(inv.total_amount) || 0,
    invoiceIssueDate: str(inv.issue_date),
    taxNaira: Number(inv.tax_amount) || 0,
    clearedGrossNaira: nk(clearedK),
    refundedNaira: nk(refundedK),
    paymentClearedAt: input.at ? iso(input.at) : earliestCleared,
    paymentIds,
    kind,
  }
}

/** The accepted referral that owns this customer, if any. */
async function loadReferralForBusiness(businessId: string, partnerId: string): Promise<Row | null> {
  const { data: business } = await supabase
    .from("businesses")
    .select("partner_lead_id")
    .eq("id", businessId)
    .maybeSingle()
  const directLeadId = str((business as Row | null)?.partner_lead_id)
  if (directLeadId) {
    const { data } = await supabase.from("partner_leads").select("*").eq("id", directLeadId).maybeSingle()
    if (data) return data as Row
  }

  const { data } = await supabase
    .from("partner_leads")
    .select("*")
    .eq("partner_id", partnerId)
    .or(`converted_business_id.eq.${businessId},matched_business_id.eq.${businessId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as Row | null) ?? null
}

/**
 * First-year vs renewal, from immutable sources: a charge raised on or after
 * the paid period covered by the active licence is a renewal; anything before
 * that (including mid-year top-ups) is still first-year revenue.
 */
function determineEarningKind(invoiceIssueDate: string, licence: Row | null): EarningKind {
  if (!licence) return "FIRST_YEAR"
  const effectiveFrom = iso(licence.effective_from || licence.issued_at)
  const issued = iso(invoiceIssueDate)
  if (!effectiveFrom || !issued) return "FIRST_YEAR"
  const intervalDays = billingIntervalDays(str(licence.billing_interval))
  return new Date(issued).getTime() >= new Date(effectiveFrom).getTime() + intervalDays * 86_400_000
    ? "RENEWAL"
    : "FIRST_YEAR"
}

function billingIntervalDays(interval: string): number {
  const v = interval.toUpperCase()
  if (v === "MONTHLY") return 30
  if (v === "QUARTERLY") return 91
  return 365
}

/* ─── Core evaluation ─── */

interface EarningState {
  status: string
  basisNaira: number
  ratePercent: number
  commissionNaira: number
  holdReason: string | null
  failedGates: EligibilityGate[]
  activationAt: string | null
  holdingStartsAt: string | null
  holdingCompletesAt: string | null
  snapshot: Row
  eligibleLines: unknown[]
  excludedLines: unknown[]
  excludedNaira: number
  /** Set when the standard rules say this invoice must not earn at all (e.g. a second renewal). */
  blockedFromBooking: boolean
}

async function computeEarningState(
  ctx: EarningContext,
  opts: { excludeCommissionId?: string; at?: string } = {}
): Promise<EarningState> {
  const base = computeEligibleBase({
    lines: ctx.lines,
    invoiceGrossNaira: ctx.invoiceTotalNaira,
    clearedGrossNaira: ctx.clearedGrossNaira,
    taxNaira: ctx.taxNaira,
  })

  const referral = ctx.referral
  const referralStatus = str(referral?.status)
  const attributionAccepted =
    !!referral &&
    POST_ACCEPT_STATUSES.includes(referralStatus) &&
    attributionValidAt(iso(referral.acceptance_at), iso(referral.protection_expires_at), opts.at || ctx.paymentClearedAt || nowIso())

  const agreementActive = agreementInForce(str(ctx.agreement?.status))
  const scheduleExecuted = !!ctx.terms
  const terms = ctx.terms
  const clearedAt = ctx.paymentClearedAt
  const activationAt = ctx.licence ? iso(ctx.licence.issued_at || ctx.licence.effective_from) : null

  const otherRes = await supabase
    .from("partner_commissions")
    .select("partner_id, attribution_type, status")
    .eq("business_id", ctx.businessId)
    .neq("partner_id", ctx.partnerId)
    .not("status", "in", "(REVERSED,CANCELLED)")
    .limit(25)
  const stacking = evaluateStacking({
    approvedSplit: terms?.approvedSplit || "",
    existingCommissions: ((otherRes.data || []) as Row[]).map((r) => ({
      beneficiaryPartnerId: str(r.partner_id),
      attributionType: str(r.attribution_type),
      status: str(r.status),
    })),
    partnerId: ctx.partnerId,
  })

  let existingRenewals = 0
  if (ctx.kind === "RENEWAL") {
    const base = supabase
      .from("partner_commissions")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", ctx.partnerId)
      .eq("business_id", ctx.businessId)
      .eq("earning_kind", "RENEWAL")
      .is("parent_commission_id", null)
    const query = opts.excludeCommissionId ? base.neq("id", opts.excludeCommissionId) : base
    const { count } = await query
    existingRenewals = count ?? 0
  }
  const renewalRule = renewalEarningAllowed({ earningKind: ctx.kind, existingRenewalEarnings: existingRenewals })

  // No schedule → no rate to apply. The earning is held, never invented.
  const ratePercent = terms ? rateForEarning(terms, ctx.kind) : 0
  const calc = calculateReferralCommission({ clearedEligibleNaira: base.clearedEligibleNaira, ratePercent })

  const blockingHold = ["SUSPENDED", "TERMINATED", "INACTIVE"].includes(ctx.partnerStatus)
  const eligibility = evaluateReferralEligibility({
    attributionAccepted,
    agreementActive,
    scheduleExecuted,
    clearedGrossNaira: ctx.clearedGrossNaira,
    paymentClearedAt: clearedAt,
    licenceActivatedAt: activationAt,
    holdingDays: terms?.holdingDays ?? 0,
    now: opts.at || nowIso(),
    blockingHold,
  })

  let status = eligibility.status
  let holdReason: string | null = null
  if (stacking.blocked) {
    status = "HELD"
    holdReason = stacking.reason
  } else if (!renewalRule.allowed) {
    status = "HELD"
    holdReason = renewalRule.reason
    if (ctx.clearedGrossNaira <= 0) status = "POTENTIAL"
  } else if (blockingHold && ctx.clearedGrossNaira > 0) {
    status = "HELD"
    holdReason = `Partner account is ${ctx.partnerStatus.toLowerCase()}`
  } else if (status === "HELD") {
    holdReason = eligibility.failedGates.map((g) => GATE_REASONS[g]).join("; ")
  }

  const snapshot: Row = {
    engine: "referral-commission-engine",
    computedAt: nowIso(),
    earningKind: ctx.kind,
    invoiceNumber: ctx.invoiceNumber,
    paymentIds: ctx.paymentIds,
    paymentClearedAt: clearedAt,
    invoiceTotalNaira: ctx.invoiceTotalNaira,
    clearedGrossNaira: ctx.clearedGrossNaira,
    refundedNaira: ctx.refundedNaira,
    paymentFraction: base.paymentFraction,
    eligibleNetNaira: base.eligibleNetNaira,
    excludedNetNaira: base.excludedNetNaira,
    taxExcludedNaira: base.taxExcludedNaira,
    clearedEligibleNaira: base.clearedEligibleNaira,
    ratePercent,
    rateSource: ctx.scheduleRow ? str(ctx.scheduleRow.reference_number) : null,
    holdingDays: terms?.holdingDays ?? null,
    holdingStartsAt: eligibility.holdingStartsAt,
    holdingCompletesAt: eligibility.holdingCompletesAt,
    activationAt,
    agreementReference: ctx.agreement ? str(ctx.agreement.reference_number) : null,
    attribution: referral
      ? {
          referralId: str(referral.id),
          reference: str(referral.referral_reference || referral.id),
          status: referralStatus,
          acceptanceAt: iso(referral.acceptance_at),
          protectionExpiresAt: iso(referral.protection_expires_at),
          valid: attributionAccepted,
        }
      : { referralId: null, valid: false },
    failedGates: eligibility.failedGates,
    stackingBlocked: stacking.blocked,
    renewalAllowed: renewalRule.allowed,
    partnerStatus: ctx.partnerStatus,
  }

  return {
    status,
    basisNaira: calc.basisNaira,
    ratePercent: calc.ratePercent,
    commissionNaira: calc.commissionNaira,
    holdReason,
    failedGates: eligibility.failedGates,
    activationAt,
    holdingStartsAt: eligibility.holdingStartsAt,
    holdingCompletesAt: eligibility.holdingCompletesAt,
    snapshot,
    eligibleLines: base.eligibleLines,
    excludedLines: base.excludedLines,
    excludedNaira: base.excludedNetNaira,
    blockedFromBooking: !renewalRule.allowed || stacking.blocked,
  }
}

/* ─── Booking: cleared payment → earning row (or re-evaluation of the existing one) ─── */

export interface BookResult {
  ok: boolean
  error?: string
  created?: boolean
  recomputed?: boolean
  skipped?: string
  commissionId?: string
  status?: string
}

async function engineRowsForInvoice(invoiceId: string, partnerId: string): Promise<Row[]> {
  const { data } = await supabase
    .from("partner_commissions")
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("partner_id", partnerId)
    .is("parent_commission_id", null)
    .not("earning_kind", "is", null)
  return (data || []) as Row[]
}

/**
 * Book (or refresh) the referral earning for one invoice. Idempotent: a second
 * confirmed payment on the same invoice re-evaluates the existing earning with
 * the larger cleared base instead of creating a duplicate.
 */
export async function bookReferralEarning(input: {
  partnerId: string
  businessId: string
  invoiceId: string
  /** Timestamp of the earning event; gates and the holding clock read from here. */
  at?: string | null
  /** The payment that triggered the booking (stored for audit). */
  triggerPaymentId?: string | null
  actorId?: string | null
}): Promise<BookResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const ctx = await loadEarningContext({
    partnerId: input.partnerId,
    businessId: input.businessId,
    invoiceId: input.invoiceId,
    at: input.at ?? null,
  })
  if (!ctx) return { ok: false, error: "Invoice or partner not found" }

  const state = await computeEarningState(ctx, { at: input.at ?? undefined })
  const existing = (await engineRowsForInvoice(input.invoiceId, input.partnerId)).find(
    (r) => str(r.earning_kind) === ctx.kind
  )

  if (existing && LOCKED_STATUSES.includes(str(existing.status))) {
    return { ok: true, skipped: "earning already approved, paid or reversed", commissionId: str(existing.id), status: str(existing.status) }
  }

  if (!existing) {
    if (ctx.clearedGrossNaira <= 0) return { ok: true, skipped: "no cleared money on this invoice" }
    if (state.blockedFromBooking && state.status === "HELD") {
      // Blocked outcomes that will never earn (duplicate renewal, unapproved stacking)
      // are recorded as a held earning so the partner can see the reason.
    }
    return await insertEarning(ctx, state, input)
  }

  return await applyRecompute(existing, ctx, state)
}

async function insertEarning(
  ctx: EarningContext,
  state: EarningState,
  input: { partnerId: string; businessId: string; invoiceId: string; triggerPaymentId?: string | null; actorId?: string | null }
): Promise<BookResult> {
  const plans = await loadReferralPlans()
  if (!plans) {
    return { ok: false, error: "Referral commission plans are not installed — apply migration 088" }
  }
  const planId = ctx.kind === "RENEWAL" ? plans.renewal : plans.firstYear

  const insert: Row = {
    partner_id: ctx.partnerId,
    business_id: ctx.businessId,
    invoice_id: ctx.invoiceId,
    payment_id: input.triggerPaymentId ?? ctx.paymentIds[0] ?? null,
    commission_plan_id: planId,
    basis_amount: state.basisNaira,
    commission_rate: state.ratePercent,
    commission_amount: state.commissionNaira,
    currency: ctx.currency,
    status: state.status,
    earned_at: ctx.paymentClearedAt || nowIso(),
    attribution_type: "ORIGINATING",
    referral_id: ctx.referral ? str(ctx.referral.id) : null,
    schedule_id: ctx.scheduleRow ? str(ctx.scheduleRow.id) : null,
    earning_kind: ctx.kind,
    activation_at: state.activationAt,
    holding_start_at: state.holdingStartsAt,
    holding_completed_at: state.holdingCompletesAt,
    eligible_lines: state.eligibleLines,
    excluded_lines: state.excludedLines,
    excluded_amount: state.excludedNaira,
    calculation_snapshot: state.snapshot,
    calculation_version: 1,
    hold_reason: state.holdReason,
    tax_deduction: 0,
    created_at: nowIso(),
    updated_at: nowIso(),
  }

  const { data, error } = await supabase.from("partner_commissions").insert(insert).select().single()
  if (error) {
    // Unique guards (duplicate payment/plan, second renewal) — re-evaluate instead of failing the payment.
    if (error.code === "23505") {
      const rows = await engineRowsForInvoice(ctx.invoiceId, ctx.partnerId)
      const row = rows.find((r) => str(r.earning_kind) === ctx.kind)
      if (row) return await applyRecompute(row, ctx, state)
      return { ok: true, skipped: "earning already recorded" }
    }
    console.error("[referral-finance] earning insert failed:", error.message)
    return { ok: false, error: "Failed to record referral earning" }
  }

  const commissionId = str((data as Row).id)
  const ctxAudit: AuditContext = { actorType: input.actorId ? "ADMIN" : "SYSTEM", actorId: input.actorId || "referral-engine" }
  await recordAudit(ctxAudit, {
    action: AUDIT_ACTIONS.REFERRAL_COMMISSION_CREATED,
    entityType: AUDIT_ENTITIES.PARTNER_COMMISSION,
    entityId: commissionId,
    metadata: {
      partnerId: ctx.partnerId,
      businessId: ctx.businessId,
      invoiceId: ctx.invoiceId,
      referralId: insert.referral_id,
      earningKind: ctx.kind,
      basis: state.basisNaira,
      rate: state.ratePercent,
      amount: state.commissionNaira,
      status: state.status,
      holdReason: state.holdReason,
    },
  })

  await notifyBooking(ctx, state, commissionId)
  return { ok: true, created: true, commissionId, status: state.status }
}

/** Push a freshly booked earning into the partner feed / internal queues. */
async function notifyBooking(ctx: EarningContext, state: EarningState, commissionId: string): Promise<void> {
  if (ctx.clearedGrossNaira <= 0) return
  const amount = formatNaira(state.commissionNaira)
  const money = formatNaira(ctx.clearedGrossNaira)
  await emitReferralNotification({
    event: "CUSTOMER_PAYMENT_CLEARED",
    title: `Cleared payment received for ${ctx.invoiceNumber}`,
    body: `MartPoint has collected ${money} on invoice ${ctx.invoiceNumber}. Your earning is ${state.status === "ELIGIBLE" ? `eligible for Finance approval (${amount})` : state.status === "HELD" ? `on hold: ${state.holdReason}` : `pending (${state.status.toLowerCase()})`}.`,
    partnerId: ctx.partnerId,
    link: "/partner/commissions",
    sourceType: "partner_commission",
    sourceId: commissionId,
    emailTo: await partnerContactEmail(ctx.partnerId),
  })

  if (state.status === "ELIGIBLE") {
    await emitReferralNotification({
      event: "COMMISSION_ELIGIBLE",
      title: `Commission eligible: ${amount}`,
      body: `All contractual gates passed for invoice ${ctx.invoiceNumber}. Finance will approve and pay this amount.`,
      partnerId: ctx.partnerId,
      link: "/partner/commissions",
      sourceType: "partner_commission",
      sourceId: commissionId,
      emailTo: await partnerContactEmail(ctx.partnerId),
    })
  } else if (state.status === "HELD") {
    await emitReferralNotification({
      event: "COMMISSION_HELD_OR_ADJUSTED",
      title: `Commission on hold — invoice ${ctx.invoiceNumber}`,
      body: state.holdReason || "Eligibility conditions are not met.",
      partnerId: ctx.partnerId,
      link: "/partner/commissions",
      sourceType: "partner_commission",
      sourceId: commissionId,
    })
  }
}

/* ─── Re-evaluation of an existing earning ─── */

async function applyRecompute(
  row: Row,
  ctx: EarningContext,
  state: EarningState
): Promise<BookResult> {
  const from = str(row.status)
  const patch: Row = {
    basis_amount: state.basisNaira,
    commission_rate: state.ratePercent,
    commission_amount: state.commissionNaira,
    status: state.status,
    hold_reason: state.status === "HELD" ? state.holdReason : null,
    referral_id: ctx.referral ? str(ctx.referral.id) : row.referral_id ?? null,
    schedule_id: ctx.scheduleRow ? str(ctx.scheduleRow.id) : row.schedule_id ?? null,
    activation_at: state.activationAt,
    holding_start_at: state.holdingStartsAt,
    holding_completed_at: state.holdingCompletesAt,
    eligible_lines: state.eligibleLines,
    excluded_lines: state.excludedLines,
    excluded_amount: state.excludedNaira,
    calculation_snapshot: state.snapshot,
    calculation_version: (Number(row.calculation_version) || 0) + 1,
    updated_at: nowIso(),
  }

  const { error } = await supabase.from("partner_commissions").update(patch).eq("id", str(row.id))
  if (error) {
    console.error("[referral-finance] recompute failed:", error.message)
    return { ok: false, error: "Failed to re-evaluate referral earning" }
  }

  if (from !== state.status) {
    await recordAudit(
      { actorType: "SYSTEM", actorId: "referral-engine" },
      {
        action: AUDIT_ACTIONS.PARTNER_COMMISSION_ELIGIBILITY_EVALUATED,
        entityType: AUDIT_ENTITIES.PARTNER_COMMISSION,
        entityId: str(row.id),
        metadata: { from, to: state.status, partnerId: ctx.partnerId, holdReason: state.holdReason },
      }
    )
    await notifyTransition(ctx, row, from, state)
  }

  return { ok: true, recomputed: true, commissionId: str(row.id), status: state.status }
}

async function notifyTransition(
  ctx: EarningContext,
  row: Row,
  from: string,
  state: EarningState
): Promise<void> {
  const id = str(row.id)
  const amount = formatNaira(state.commissionNaira)

  if (state.status === "ELIGIBLE") {
    if (from === "PENDING" || from === "HELD") {
      await emitReferralNotification({
        event: "HOLDING_PERIOD_COMPLETED",
        title: `Holding period completed — ${ctx.invoiceNumber}`,
        body: state.holdingCompletesAt
          ? `The contractual holding period completed. ${amount} is now eligible for Finance approval.`
          : `${amount} is now eligible for Finance approval.`,
        partnerId: ctx.partnerId,
        link: "/partner/commissions",
        sourceType: "partner_commission",
        sourceId: id,
        emailTo: await partnerContactEmail(ctx.partnerId),
      })
    }
    await emitReferralNotification({
      event: "COMMISSION_ELIGIBLE",
      title: `Commission eligible: ${amount}`,
      body: `All contractual gates passed for invoice ${ctx.invoiceNumber}.`,
      partnerId: ctx.partnerId,
      link: "/partner/commissions",
      sourceType: "partner_commission",
      sourceId: id,
      emailTo: await partnerContactEmail(ctx.partnerId),
    })
  } else if (state.status === "HELD" && from !== "HELD") {
    await emitReferralNotification({
      event: "COMMISSION_HELD_OR_ADJUSTED",
      title: `Commission on hold — ${ctx.invoiceNumber}`,
      body: state.holdReason || "Eligibility conditions are not met.",
      partnerId: ctx.partnerId,
      link: "/partner/commissions",
      sourceType: "partner_commission",
      sourceId: id,
    })
  }
}

/** Re-evaluate one earning row from its source records (used by sweeps and approvals). */
export async function recomputeReferralCommission(commissionId: string): Promise<BookResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data } = await supabase.from("partner_commissions").select("*").eq("id", commissionId).maybeSingle()
  const row = data as Row | null
  if (!row) return { ok: false, error: "Commission not found" }
  if (!row.earning_kind) return { ok: true, skipped: "not a referral earning" }
  if (LOCKED_STATUSES.includes(str(row.status))) {
    return { ok: true, skipped: "earning already approved, paid or reversed", commissionId, status: str(row.status) }
  }
  if (!row.invoice_id || !row.business_id) return { ok: true, skipped: "earning has no invoice source" }

  const ctx = await loadEarningContext({
    partnerId: str(row.partner_id),
    businessId: str(row.business_id),
    invoiceId: str(row.invoice_id),
  })
  if (!ctx) return { ok: false, error: "Source records not found" }
  const state = await computeEarningState(ctx, { excludeCommissionId: commissionId })
  return await applyRecompute(row, ctx, state)
}

/* ─── Entry points from the payment pipeline ─── */

/**
 * Called when a payment is confirmed for a business whose originating partner
 * is a Referral Partner. Books the earning for the linked invoice.
 */
export async function createReferralEarningsForPayment(paymentId: string, actorId?: string): Promise<BookResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: payment } = await supabase.from("payments").select("*").eq("id", paymentId).maybeSingle()
  const p = payment as Row | null
  if (!p) return { ok: false, error: "Payment not found" }
  if (str(p.status) !== "CONFIRMED") return { ok: true, skipped: "payment not confirmed" }

  const invoiceId = str(p.invoice_id)
  const businessId = str(p.business_id)
  if (!invoiceId) return { ok: true, skipped: "payment is not allocated to an invoice" }

  const { data: business } = await supabase
    .from("businesses")
    .select("originating_partner_id")
    .eq("id", businessId)
    .maybeSingle()
  const partnerId = str((business as Row | null)?.originating_partner_id)
  if (!partnerId) return { ok: true, skipped: "business has no originating partner" }

  const { data: partner } = await supabase.from("partners").select("partner_type").eq("id", partnerId).maybeSingle()
  if (str((partner as Row | null)?.partner_type) !== "REFERRAL") {
    return { ok: true, skipped: "originating partner is not a Referral Partner" }
  }

  return await bookReferralEarning({
    partnerId,
    businessId,
    invoiceId,
    at: iso(p.confirmed_at) || nowIso(),
    triggerPaymentId: str(p.id),
    actorId: actorId ?? null,
  })
}

/** Re-evaluate every open earning for one business (licence activation hook). */
export async function recomputeReferralEarningsForBusiness(businessId: string): Promise<{
  evaluated: number
  eligible: number
  held: number
}> {
  const out = { evaluated: 0, eligible: 0, held: 0 }
  if (!isSupabaseConfigured()) return out

  const { data: business } = await supabase
    .from("businesses")
    .select("originating_partner_id")
    .eq("id", businessId)
    .maybeSingle()
  const partnerId = str((business as Row | null)?.originating_partner_id)
  if (!partnerId) return out

  const { data: partner } = await supabase.from("partners").select("partner_type").eq("id", partnerId).maybeSingle()
  if (str((partner as Row | null)?.partner_type) !== "REFERRAL") return out

  const referral = await loadReferralForBusiness(businessId, partnerId)
  if (referral) {
    await emitReferralNotification({
      event: "LICENCE_ACTIVATED",
      title: `Licence activated for ${str(referral.business_name)}`,
      body: "The holding period now runs from the later of your cleared payment and this activation date.",
      partnerId,
      link: "/partner/referrals",
      sourceType: "referral",
      sourceId: str(referral.id),
      emailTo: await partnerContactEmail(partnerId),
    })
  }

  const { data: rows } = await supabase
    .from("partner_commissions")
    .select("*")
    .eq("business_id", businessId)
    .in("status", [...ENGINE_STATUSES])
    .not("earning_kind", "is", null)
    .limit(50)
  for (const row of (rows || []) as Row[]) {
    const res = await recomputeReferralCommission(str(row.id))
    out.evaluated++
    if (res.status === "ELIGIBLE") out.eligible++
    if (res.status === "HELD") out.held++
  }
  return out
}

/* ─── Scheduled sweep ─── */

/**
 * Hourly maintenance: re-evaluate open earnings so holding periods complete,
 * activations register and resolved holds clear. Refunds are converted into
 * linked adjustments — approved or paid earnings are never rewritten.
 */
export async function sweepReferralCommissions(): Promise<{
  evaluated: number
  eligible: number
  held: number
  reversed: number
  invoicesScanned: number
}> {
  const out = { evaluated: 0, eligible: 0, held: 0, reversed: 0, invoicesScanned: 0 }
  if (!isSupabaseConfigured()) return out

  // 1. Refunds / chargebacks on paid referral invoices.
  const { data: refundPayments } = await supabase
    .from("payments")
    .select("invoice_id")
    .gt("refunded_amount", 0)
    .not("invoice_id", "is", null)
    .limit(200)
  const refundInvoices = Array.from(new Set(((refundPayments || []) as Row[]).map((r) => str(r.invoice_id)).filter(Boolean)))
  for (const invoiceId of refundInvoices) {
    const sync = await syncRefundAdjustmentsForInvoice(invoiceId)
    out.reversed += sync.reversed
    out.evaluated += sync.adjustments
  }

  // 2. Open earnings whose gates may have advanced.
  const { data: rows } = await supabase
    .from("partner_commissions")
    .select("id, status")
    .not("earning_kind", "is", null)
    .in("status", [...ENGINE_STATUSES])
    .limit(300)
  for (const row of (rows || []) as Row[]) {
    const res = await recomputeReferralCommission(str(row.id))
    out.invoicesScanned++
    if (res.status === "ELIGIBLE") out.eligible++
    else if (res.status === "HELD") out.held++
  }

  return out
}

/* ─── Refunds and chargebacks → linked adjustments ─── */

export async function syncRefundAdjustmentsForInvoice(
  invoiceId: string,
  opts?: { kind?: "REFUND" | "CHARGEBACK"; reason?: string }
): Promise<{ adjustments: number; reversed: number }> {
  const out = { adjustments: 0, reversed: 0 }
  if (!isSupabaseConfigured()) return out

  const { data: parents } = await supabase
    .from("partner_commissions")
    .select("*")
    .eq("invoice_id", invoiceId)
    .is("parent_commission_id", null)
    .not("earning_kind", "is", null)
    .neq("status", "REVERSED")
    .neq("status", "CANCELLED")
    .limit(25)
  const rows = (parents || []) as Row[]
  if (rows.length === 0) return out

  const allocRes = await supabase
    .from("payment_allocations")
    .select("amount_allocated, payments(status, refunded_amount, refunded_at, id)")
    .eq("invoice_id", invoiceId)
  let clearedK = 0
  let refundedK = 0
  let refundedAt: string | null = null
  let refundedPaymentId: string | null = null
  for (const a of ((allocRes.data || []) as Row[])) {
    const payment = a.payments as Row | null
    if (!payment || str(payment.status) !== "CONFIRMED") continue
    clearedK += k(a.amount_allocated)
    const refund = k(payment.refunded_amount)
    if (refund > 0) {
      refundedK += refund
      refundedAt = iso(payment.refunded_at) || refundedAt
      refundedPaymentId = str(payment.id) || refundedPaymentId
    }
  }
  if (refundedK <= 0) return out

  for (const parent of rows) {
    const outcome = computeRefundAdjustment({
      commissionNaira: Number(parent.commission_amount) || 0,
      refundedNaira: nk(refundedK),
      clearedNaira: nk(clearedK),
      kind: opts?.kind ?? "REFUND",
      earningStatus: str(parent.status),
    })
    if (outcome.adjustmentNaira === 0 && !outcome.setOriginalToReversed) continue

    if (outcome.setOriginalToReversed) {
      const { error } = await supabase
        .from("partner_commissions")
        .update({ status: "REVERSED", reversal_reason: outcome.reason, hold_reason: null, updated_at: nowIso() })
        .eq("id", str(parent.id))
        .not("status", "in", "(APPROVED,PAID,SCHEDULED)")
      if (!error) {
        out.reversed++
        await recordAudit({ actorType: "SYSTEM", actorId: "referral-engine" }, {
          action: AUDIT_ACTIONS.REFERRAL_COMMISSION_REVERSED,
          entityType: AUDIT_ENTITIES.PARTNER_COMMISSION,
          entityId: str(parent.id),
          metadata: { invoiceId, reason: outcome.reason, refundedNaira: nk(refundedK) },
        })
        await emitReferralNotification({
          event: "COMMISSION_HELD_OR_ADJUSTED",
          title: "Commission reversed by refund",
          body: outcome.reason,
          partnerId: str(parent.partner_id),
          link: "/partner/commissions",
          sourceType: "partner_commission",
          sourceId: str(parent.id),
        })
      }
      continue
    }

    // Delta-based: repeated runs only write the change since the last sync.
    const { data: children } = await supabase
      .from("partner_commissions")
      .select("commission_amount")
      .eq("parent_commission_id", str(parent.id))
      .in("adjustment_kind", ["REFUND", "CHARGEBACK"])
    const existingK = ((children || []) as Row[]).reduce((s, c) => s + k(c.commission_amount), 0)
    const deltaK = Math.round(k(outcome.adjustmentNaira) - existingK)
    if (deltaK === 0) continue

    const insert: Row = {
      partner_id: str(parent.partner_id),
      business_id: str(parent.business_id),
      invoice_id: invoiceId,
      payment_id: refundedPaymentId ?? parent.payment_id ?? null,
      commission_plan_id: str(parent.commission_plan_id),
      basis_amount: nk(refundedK),
      commission_rate: parent.commission_rate ?? null,
      commission_amount: nk(deltaK),
      currency: str(parent.currency) || "NGN",
      status: "REVERSED",
      earned_at: refundedAt || nowIso(),
      attribution_type: str(parent.attribution_type) || "ORIGINATING",
      referral_id: parent.referral_id ?? null,
      earning_kind: parent.earning_kind ?? null,
      parent_commission_id: str(parent.id),
      adjustment_kind: outcome.kind,
      reversal_reason: outcome.reason,
      calculation_snapshot: {
        engine: "referral-commission-engine",
        adjustment: outcome.reason,
        refundedNaira: nk(refundedK),
        clearedNaira: nk(clearedK),
        parentCommissionId: str(parent.id),
        computedAt: nowIso(),
      },
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    const { data: created, error } = await supabase.from("partner_commissions").insert(insert).select().single()
    if (error) {
      console.error("[referral-finance] adjustment insert failed:", error.message)
      continue
    }
    out.adjustments++
    await recordAudit({ actorType: "SYSTEM", actorId: "referral-engine" }, {
      action: AUDIT_ACTIONS.REFERRAL_COMMISSION_ADJUSTED,
      entityType: AUDIT_ENTITIES.PARTNER_COMMISSION,
      entityId: str((created as Row).id),
      metadata: {
        parentCommissionId: str(parent.id),
        invoiceId,
        kind: outcome.kind,
        amount: nk(deltaK),
        reason: opts?.reason || outcome.reason,
      },
    })
    await emitReferralNotification({
      event: "COMMISSION_HELD_OR_ADJUSTED",
      title: `Commission adjustment: ${formatNaira(nk(deltaK))}`,
      body: `${outcome.reason}. The original earning is preserved and this adjustment is linked to it.`,
      partnerId: str(parent.partner_id),
      link: "/partner/commissions",
      sourceType: "partner_commission",
      sourceId: str((created as Row).id),
    })
  }

  return out
}

/* ─── Finance approval ─── */

export interface FinanceActor {
  actorId: string
  actorName?: string | null
}

/**
 * Finance validates an eligible earning. Re-evaluates first, so an approval can
 * never be granted on a stale calculation, and requires a verified payout
 * profile (bank details reverification gate) before money can be approved.
 */
export async function approveReferralCommission(
  commissionId: string,
  actor: FinanceActor
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data } = await supabase.from("partner_commissions").select("*").eq("id", commissionId).maybeSingle()
  const row = data as Row | null
  if (!row) return { ok: false, error: "Commission not found" }
  if (!row.earning_kind) return { ok: false, error: "Not a referral commission" }
  if (str(row.status) !== "ELIGIBLE") {
    return { ok: false, error: `Only an eligible commission can be approved (current status: ${str(row.status)})` }
  }

  // Resolve any refund that arrived since the earning became eligible.
  if (row.invoice_id) await syncRefundAdjustmentsForInvoice(str(row.invoice_id))

  const recheck = await recomputeReferralCommission(commissionId)
  const { data: fresh } = await supabase.from("partner_commissions").select("status").eq("id", commissionId).maybeSingle()
  const status = str((fresh as Row | null)?.status)
  if (status !== "ELIGIBLE") {
    return {
      ok: false,
      error: `Commission is no longer eligible (${status}${recheck.status ? "" : ""}). ${
        status === "HELD" ? "Resolve the recorded hold and re-run evaluation." : ""
      }`,
    }
  }

  const { data: profile } = await supabase
    .from("partner_payout_profiles")
    .select("verification_status")
    .eq("partner_id", str(row.partner_id))
    .maybeSingle()
  if (str((profile as Row | null)?.verification_status) !== "VERIFIED") {
    return { ok: false, error: "Partner payout profile is not verified — payout details must be reverified before approval" }
  }

  const stamp = nowIso()
  const { error } = await supabase
    .from("partner_commissions")
    .update({ status: "APPROVED", approved_at: stamp, approved_by: actor.actorId, hold_reason: null, updated_at: stamp })
    .eq("id", commissionId)
    .eq("status", "ELIGIBLE")
  if (error) return { ok: false, error: "Approval failed" }

  await recordAudit({ actorType: "ADMIN", actorId: actor.actorId, actorName: actor.actorName ?? null }, {
    action: AUDIT_ACTIONS.REFERRAL_COMMISSION_APPROVED,
    entityType: AUDIT_ENTITIES.PARTNER_COMMISSION,
    entityId: commissionId,
    metadata: {
      partnerId: str(row.partner_id),
      amount: str(row.commission_amount),
      rate: str(row.commission_rate),
      basis: str(row.basis_amount),
      schedule: str(row.schedule_id || ""),
    },
  })

  await emitReferralNotification({
    event: "COMMISSION_APPROVED",
    title: `Commission approved: ${formatNaira(Number(row.commission_amount) || 0)}`,
    body: "Finance has validated the attribution and calculation. The amount is scheduled for the next approved payout batch.",
    partnerId: str(row.partner_id),
    link: "/partner/commissions",
    sourceType: "partner_commission",
    sourceId: commissionId,
    emailTo: await partnerContactEmail(str(row.partner_id)),
  })

  return { ok: true }
}

/** Partner-initiated dispute on an earning (status DISPUTED — never silent rewrites). */
export async function disputeReferralCommission(
  commissionId: string,
  partnerId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const trimmed = (reason || "").trim()
  if (trimmed.length < 10) return { ok: false, error: "Describe the disputed fact (at least 10 characters)" }

  const { data } = await supabase
    .from("partner_commissions")
    .select("*")
    .eq("id", commissionId)
    .eq("partner_id", partnerId)
    .maybeSingle()
  const row = data as Row | null
  if (!row) return { ok: false, error: "Commission not found" }
  if (!row.earning_kind) return { ok: false, error: "Not a referral commission" }
  if (["POTENTIAL", "REVERSED", "CANCELLED"].includes(str(row.status))) {
    return { ok: false, error: "This earning cannot be disputed" }
  }

  const stamp = nowIso()
  const { error } = await supabase
    .from("partner_commissions")
    .update({ status: "DISPUTED", dispute_reason: trimmed, updated_at: stamp })
    .eq("id", commissionId)
  if (error) return { ok: false, error: "Dispute failed" }

  await recordAudit({ actorType: "PARTNER", actorId: partnerId }, {
    action: AUDIT_ACTIONS.REFERRAL_COMMISSION_DISPUTED,
    entityType: AUDIT_ENTITIES.PARTNER_COMMISSION,
    entityId: commissionId,
    metadata: { partnerId, reason: trimmed, previousStatus: str(row.status) },
  })

  await emitReferralNotification({
    event: "COMMISSION_HELD_OR_ADJUSTED",
    title: "Commission disputed by partner",
    body: trimmed,
    partnerId,
    link: "/admin/partners/referrals",
    sourceType: "partner_commission",
    sourceId: commissionId,
  })
  return { ok: true }
}

/* ─── Payout completion ─── */

/**
 * When Finance marks a payout batch paid, the earnings it contains become PAID
 * with the payout reference. Only approved/scheduled rows move; negative
 * adjustment rows are netted in the payout total, not paid separately.
 */
export async function markReferralCommissionsPaid(
  payoutId: string,
  actor: FinanceActor
): Promise<{ paid: number }> {
  const out = { paid: 0 }
  if (!isSupabaseConfigured()) return out

  const { data: items } = await supabase
    .from("commission_payout_items")
    .select("commission_id")
    .eq("payout_id", payoutId)
  const ids = ((items || []) as Row[]).map((i) => str(i.commission_id)).filter(Boolean)
  if (ids.length === 0) return out

  const { data: payout } = await supabase
    .from("commission_payouts")
    .select("*")
    .eq("id", payoutId)
    .maybeSingle()
  const pay = payout as Row | null
  if (!pay) return out

  const stamp = nowIso()
  const { data: rows } = await supabase
    .from("partner_commissions")
    .select("*")
    .in("id", ids)
    .in("status", ["APPROVED", "SCHEDULED"])
  const moved = (rows || []) as Row[]
  if (moved.length === 0) return out

  const { error } = await supabase
    .from("partner_commissions")
    .update({ status: "PAID", paid_at: stamp, updated_at: stamp })
    .in("id", moved.map((r) => str(r.id)))
  if (error) return out
  out.paid = moved.length

  const referralCount = moved.filter((r) => !!r.referral_id).length
  await recordAudit({ actorType: "ADMIN", actorId: actor.actorId, actorName: actor.actorName ?? null }, {
    action: AUDIT_ACTIONS.REFERRAL_PAYOUT_COMPLETED,
    entityType: AUDIT_ENTITIES.PARTNER_COMMISSION,
    entityId: payoutId,
    metadata: {
      partnerId: str(pay.partner_id),
      payoutReference: str(pay.payout_reference),
      bankReference: str(pay.bank_reference || ""),
      amount: str(pay.amount),
      commissions: moved.map((r) => str(r.id)),
      referralCommissions: referralCount,
    },
  })

  if (referralCount > 0) {
    await emitReferralNotification({
      event: "PAYOUT_COMPLETED",
      title: `Payout ${str(pay.payout_reference)} completed`,
      body: `${formatNaira(Number(pay.amount) || 0)} paid${
        pay.bank_reference ? ` (reference ${str(pay.bank_reference)})` : ""
      }. Your payout statement is available in the portal.`,
      partnerId: str(pay.partner_id),
      link: "/partner/commissions",
      sourceType: "commission_payout",
      sourceId: payoutId,
      emailTo: await partnerContactEmail(str(pay.partner_id)),
    })
  }
  return out
}

/* ─── Monthly close (Finance period stamping) ─── */

/**
 * Close a calendar month for commission processing. Eligible earnings are
 * re-evaluated one last time, then APPROVED rows for the month are stamped with
 * the period so payout timing (payout_days_after_month_end) is auditable.
 */
export async function closeCommissionPeriod(
  periodKey: string,
  actor: FinanceActor
): Promise<{ ok: boolean; error?: string; periodId?: string; stamped?: number }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey || "")
  if (!match) return { ok: false, error: "periodKey must be YYYY-MM" }

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59))

  const { data: existing } = await supabase
    .from("commission_close_periods")
    .select("*")
    .eq("period_key", periodKey)
    .maybeSingle()
  let period = (existing as Row | null) ?? null
  if (!period) {
    const { data: created } = await supabase
      .from("commission_close_periods")
      .insert({
        period_key: periodKey,
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
        status: "OPEN",
        created_at: nowIso(),
      })
      .select()
      .single()
    if (!created) return { ok: false, error: "Failed to open period" }
    period = created as Row
  }
  if (str(period.status) === "CLOSED") return { ok: false, error: "Period is already closed" }

  const { data: approved } = await supabase
    .from("partner_commissions")
    .select("id, partner_id, earning_kind")
    .eq("status", "APPROVED")
    .gte("approved_at", start.toISOString())
    .lte("approved_at", end.toISOString())
    .limit(2000)
  const rows = (approved || []) as Row[]
  if (rows.length > 0) {
    await supabase
      .from("partner_commissions")
      .update({ period_id: str(period.id), updated_at: nowIso() })
      .in("id", rows.map((r) => str(r.id)))
  }

  const stamp = nowIso()
  await supabase
    .from("commission_close_periods")
    .update({ status: "CLOSED", closed_by: actor.actorId, closed_at: stamp })
    .eq("id", str(period.id))

  await recordAudit({ actorType: "ADMIN", actorId: actor.actorId, actorName: actor.actorName ?? null }, {
    action: AUDIT_ACTIONS.REFERRAL_COMMISSION_PERIOD_CLOSED,
    entityType: AUDIT_ENTITIES.COMMISSION_CLOSE_PERIOD,
    entityId: str(period.id),
    metadata: { periodKey, approvedCommissions: rows.length },
  })

  // One controlled statement per partner with referral earnings in this period.
  const referralPartners = Array.from(
    new Set(rows.filter((r) => str(r.earning_kind)).map((r) => str(r.partner_id)).filter(Boolean))
  ) as string[]
  for (const pid of referralPartners) {
    try {
      const { issueReferralCommissionStatement } = await import("./referral-documents")
      await issueReferralCommissionStatement(
        pid,
        {
          from: start.toISOString(),
          to: end.toISOString(),
          key: periodKey,
          periodId: str(period.id),
        },
        { id: actor.actorId || "system", name: actor.actorName ?? null, title: "MartPoint Finance" }
      )
    } catch (err) {
      console.error("[closeCommissionPeriod] statement document", err)
    }
  }

  return { ok: true, periodId: str(period.id), stamped: rows.length }
}

/* ─── Portal reads (partner-safe) ─── */

/** Amounts the partner may see: potential/pending/held figures stay undisclosed. */
export function commissionVisibleToPartner(row: Row): boolean {
  return ["ELIGIBLE", "APPROVED", "SCHEDULED", "PAID", "DISPUTED"].includes(str(row.status))
}

export async function listPartnerReferralCommissions(partnerId: string): Promise<Row[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("partner_commissions")
    .select("*")
    .eq("partner_id", partnerId)
    .not("earning_kind", "is", null)
    .order("earned_at", { ascending: false })
    .limit(200)
  return (data || []) as Row[]
}

export async function listPartnerReferralPayouts(partnerId: string): Promise<Row[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("commission_payouts")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(50)
  return (data || []) as Row[]
}

export async function partnerEarningsSummary(partnerId: string): Promise<{
  lifetimeNaira: number
  approvedNaira: number
  paidNaira: number
  pendingNaira: number
  heldCount: number
}> {
  const rows = await listPartnerReferralCommissions(partnerId)
  const sum = (pred: (r: Row) => boolean) => nk(rows.filter(pred).reduce((s, r) => s + k(r.commission_amount), 0))
  return {
    lifetimeNaira: sum((r) => !["REVERSED", "CANCELLED"].includes(str(r.status))),
    approvedNaira: sum((r) => ["APPROVED", "SCHEDULED"].includes(str(r.status))),
    paidNaira: sum((r) => str(r.status) === "PAID"),
    pendingNaira: sum((r) => ["POTENTIAL", "PENDING", "ELIGIBLE"].includes(str(r.status))),
    heldCount: rows.filter((r) => str(r.status) === "HELD").length,
  }
}

function formatNaira(n: number): string {
  return `₦${(Number(n) || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function partnerContactEmail(partnerId: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !partnerId) return null
  try {
    const { data: profile } = await supabase
      .from("partner_payout_profiles")
      .select("payout_contact_email")
      .eq("partner_id", partnerId)
      .maybeSingle()
    const email = str((profile as Row | null)?.payout_contact_email)
    if (email) return email
    const { data: partner } = await supabase.from("partners").select("public_email").eq("id", partnerId).maybeSingle()
    return str((partner as Row | null)?.public_email) || null
  } catch {
    return null
  }
}
