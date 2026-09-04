import { supabase, isSupabaseConfigured } from "./supabase"

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES — Sprint 4 Commercial Finance
   ───────────────────────────────────────────────────────────────────────────── */

export type CommercialProduct = {
  id: string
  code: string
  name: string
  description?: string | null
  product_family: string
  status: "ACTIVE" | "INACTIVE"
  created_at: string
  updated_at: string
}

export type Plan = {
  id: string
  product_id: string
  code: string
  name: string
  description?: string | null
  billing_type: "RECURRING" | "ONE_TIME"
  billing_interval: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "NONE"
  currency: string
  base_price: number
  included_branches: number
  included_users: number
  online_store_included: boolean
  active: boolean
  effective_from: string
  effective_until?: string | null
  created_at: string
  updated_at: string
}

export type Addon = {
  id: string
  code: string
  name: string
  description?: string | null
  pricing_type: "FIXED" | "PER_UNIT" | "CUSTOM"
  unit_name?: string | null
  default_price: number
  currency: string
  recurring: boolean
  billing_interval?: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "NONE" | null
  active: boolean
  created_at: string
  updated_at: string
}

export type BusinessCommercialProfile = {
  business_id: string
  billing_name?: string | null
  billing_email?: string | null
  billing_phone?: string | null
  billing_address?: string | null
  tax_id?: string | null
  currency: string
  payment_terms_days: number
  account_status: "ACTIVE" | "ON_HOLD" | "SUSPENDED"
  created_at: string
  updated_at: string
}

export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CONVERTED"
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID" | "CANCELLED"
export type PaymentStatus = "PENDING" | "CONFIRMED" | "FAILED" | "REVERSED" | "REFUNDED" | "PARTIALLY_REFUNDED"
export type PaymentMethod = "BANK_TRANSFER" | "PAYSTACK" | "FLUTTERWAVE" | "CASH" | "POS" | "OTHER"
export type SubscriptionStatus = "PENDING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED" | "EXPIRED"
export type LicenceStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "REVOKED"
export type CommissionStatus = "PENDING" | "ELIGIBLE" | "APPROVED" | "SCHEDULED" | "PAID" | "REVERSED" | "CANCELLED"
export type CommissionBasis = "PERCENTAGE" | "FIXED"
export type CommissionAppliesTo = "INITIAL_LICENSE" | "RENEWAL" | "ADDON" | "IMPLEMENTATION" | "CUSTOM"
export type CommissionTrigger = "PAYMENT_CONFIRMED" | "SUBSCRIPTION_ACTIVATED" | "CUSTOMER_GO_LIVE"
export type PayoutStatus = "DRAFT" | "APPROVED" | "PAID" | "FAILED" | "CANCELLED"

export type Quote = {
  id: string
  quote_number: string
  business_id: string
  partner_id?: string | null
  partner_lead_id?: string | null
  status: QuoteStatus
  currency: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  valid_until?: string | null
  notes_public?: string | null
  notes_internal?: string | null
  created_by?: string | null
  approved_by?: string | null
  created_at: string
  updated_at: string
}

export type QuoteItem = {
  id: string
  quote_id: string
  item_type: "PLAN" | "ADDON" | "SERVICE" | "CUSTOM"
  reference_id?: string | null
  description: string
  quantity: number
  unit_price: number
  discount: number
  tax: number
  line_total: number
}

export type Invoice = {
  id: string
  invoice_number: string
  business_id: string
  quote_id?: string | null
  currency: string
  issue_date: string
  due_date: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  balance_due: number
  status: InvoiceStatus
  notes_public?: string | null
  notes_internal?: string | null
  created_by?: string | null
  issued_by?: string | null
  created_at: string
  updated_at: string
}

export type InvoiceItem = Omit<QuoteItem, "quote_id"> & { invoice_id: string }

export type Payment = {
  id: string
  payment_reference: string
  business_id: string
  invoice_id?: string | null
  amount: number
  currency: string
  payment_method: PaymentMethod
  gateway_reference?: string | null
  status: PaymentStatus
  paid_at?: string | null
  confirmed_at?: string | null
  confirmed_by?: string | null
  proof_document_path?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export type PaymentAllocation = {
  id: string
  payment_id: string
  invoice_id: string
  amount_allocated: number
  created_at: string
}

export type Receipt = {
  id: string
  receipt_number: string
  payment_id: string
  business_id: string
  amount: number
  currency: string
  issued_at: string
  issued_by?: string | null
}

export type Subscription = {
  id: string
  business_id: string
  plan_id: string
  status: SubscriptionStatus
  billing_interval: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "NONE"
  start_date: string
  current_period_start: string
  current_period_end: string
  renewal_date?: string | null
  auto_renew: boolean
  quantity?: number | null
  price_at_activation: number
  currency: string
  invoice_id?: string | null
  created_by?: string | null
  activated_by?: string | null
  created_at: string
  updated_at: string
}

export type SubscriptionAddon = {
  id: string
  subscription_id: string
  addon_id: string
  quantity: number
  unit_price_at_activation: number
  total_price: number
  start_date: string
  end_date?: string | null
  status: "ACTIVE" | "INACTIVE" | "EXPIRED"
}

export type BusinessLicence = {
  id: string
  business_id: string
  subscription_id?: string | null
  licence_type: "CLOUD" | "ERP" | "OFFLINE" | "CUSTOM"
  status: LicenceStatus
  issued_at?: string | null
  effective_from?: string | null
  expires_at?: string | null
  max_users: number
  max_branches: number
  online_store_enabled: boolean
  deployment_id?: string | null
  internal_reference?: string | null
  created_by?: string | null
  updated_at: string
}

export type CommissionPlan = {
  id: string
  name: string
  description?: string | null
  partner_type?: string | null
  commission_basis: CommissionBasis
  percentage?: number | null
  fixed_amount?: number | null
  applies_to: CommissionAppliesTo
  product_id?: string | null
  plan_id?: string | null
  addon_id?: string | null
  effective_from: string
  effective_until?: string | null
  active: boolean
  commission_trigger: CommissionTrigger
  clawback_days?: number | null
}

export type PartnerCommission = {
  id: string
  partner_id: string
  business_id: string
  invoice_id?: string | null
  payment_id?: string | null
  subscription_id?: string | null
  commission_plan_id: string
  basis_amount: number
  commission_rate?: number | null
  fixed_amount?: number | null
  commission_amount: number
  currency: string
  status: CommissionStatus
  earned_at?: string | null
  approved_at?: string | null
  approved_by?: string | null
  paid_at?: string | null
  reversal_reason?: string | null
  attribution_type: "ORIGINATING" | "SALES" | "IMPLEMENTATION"
  created_at: string
  updated_at: string
}

export type CommissionPayout = {
  id: string
  payout_reference: string
  partner_id: string
  amount: number
  currency: string
  payment_method?: string | null
  bank_reference?: string | null
  status: PayoutStatus
  approved_by?: string | null
  approved_at?: string | null
  paid_by?: string | null
  paid_at?: string | null
  notes_internal?: string | null
}

export type FinanceOverview = {
  invoices_issued: number
  payments_received: number
  outstanding_balance: number
  overdue_invoices: number
  overdue_balance: number
  active_subscriptions: number
  renewals_30_days: number
  renewals_7_days: number
  pending_commissions: number
  commission_payable: number
}

/* ─────────────────────────────────────────────────────────────────────────────
   AUDIT EVENTS
   ───────────────────────────────────────────────────────────────────────────── */

export type FinanceAuditAction =
  | "QUOTE_CREATED" | "QUOTE_SENT" | "QUOTE_ACCEPTED" | "QUOTE_CONVERTED"
  | "INVOICE_CREATED" | "INVOICE_ISSUED" | "INVOICE_VOIDED"
  | "PAYMENT_RECORDED" | "PAYMENT_CONFIRMED" | "PAYMENT_REVERSED" | "PAYMENT_REFUNDED"
  | "RECEIPT_ISSUED"
  | "SUBSCRIPTION_CREATED" | "SUBSCRIPTION_ACTIVATED" | "SUBSCRIPTION_SUSPENDED" | "SUBSCRIPTION_RENEWED" | "SUBSCRIPTION_CANCELLED"
  | "ADDON_ACTIVATED" | "ADDON_REMOVED"
  | "BUSINESS_LICENCE_CREATED" | "BUSINESS_LICENCE_UPDATED"
  | "ENTITLEMENT_SYNCED"
  | "COMMISSION_CREATED" | "COMMISSION_ELIGIBLE" | "COMMISSION_APPROVED" | "COMMISSION_REVERSED" | "COMMISSION_PAID"
  | "COMMISSION_PAYOUT_CREATED" | "COMMISSION_PAYOUT_APPROVED" | "COMMISSION_PAYOUT_PAID"
  | "SUPPORT_TICKET_CREATED" | "SUPPORT_TICKET_ASSIGNED" | "SUPPORT_TICKET_PARTNER_ASSIGNED"
  | "SUPPORT_TICKET_ESCALATED" | "SUPPORT_TICKET_PRIORITY_CHANGED" | "SUPPORT_TICKET_RESOLVED"
  | "SUPPORT_TICKET_REOPENED" | "SUPPORT_TICKET_CLOSED" | "SUPPORT_INTERNAL_NOTE_ADDED"
  | "CUSTOMER_SUCCESS_STAGE_CHANGED" | "CUSTOMER_HEALTH_CHANGED" | "CUSTOMER_SUCCESS_ACTIVITY_ADDED"
  | "COMPLIANCE_REQUESTED" | "COMPLIANCE_DOCUMENT_SUBMITTED" | "COMPLIANCE_VERIFIED"
  | "COMPLIANCE_REJECTED" | "COMPLIANCE_EXPIRED"
  | "CUSTOMER_INCIDENT_CREATED" | "CUSTOMER_INCIDENT_RESOLVED"

export async function logFinanceAudit(
  actorType: "ADMIN" | "SYSTEM" | "PARTNER",
  actorId: string | undefined,
  action: FinanceAuditAction,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
) {
  if (!isSupabaseConfigured()) return
  await supabase.from("finance_audit_events").insert({
    actor_type: actorType,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    created_at: new Date().toISOString(),
  })
}

/* ─────────────────────────────────────────────────────────────────────────────
   MONEY UTILITIES — integer kobo to avoid JS float errors
   ───────────────────────────────────────────────────────────────────────────── */

export function toKobo(n: number | string | undefined | null): number {
  if (n === undefined || n === null) return 0
  const v = typeof n === "string" ? Number.parseFloat(n) : n
  if (Number.isNaN(v)) return 0
  return Math.round(v * 100)
}

export function fromKobo(k: number | undefined | null): number {
  if (k === undefined || k === null) return 0
  return k / 100
}

export function money(n: number | string | undefined | null): number {
  return fromKobo(toKobo(n))
}

function lineTotalKobo(quantity: number, unitPriceKobo: number, discountKobo = 0, taxKobo = 0): number {
  const qtyHundred = Math.round(quantity * 100)
  const base = Math.round((unitPriceKobo * qtyHundred) / 100)
  return Math.max(0, base - discountKobo + taxKobo)
}

function fmtInvoiceNumber(n: string): string { return n }

/* ─────────────────────────────────────────────────────────────────────────────
   DOCUMENT NUMBER GENERATION
   ───────────────────────────────────────────────────────────────────────────── */

export async function nextInvoiceNumber(): Promise<string> {
  if (!isSupabaseConfigured()) return "MPI-00000-00000"
  const year = new Date().getFullYear()
  const { data, error } = await supabase.rpc("next_invoice_number", { p_year: year })
  if (error || !data) throw new Error(`Invoice number generation failed: ${error?.message || "unknown"}`)
  return data as string
}

export async function nextQuoteNumber(): Promise<string> {
  if (!isSupabaseConfigured()) return "MPQ-00000-00000"
  const year = new Date().getFullYear()
  const { data, error } = await supabase.rpc("next_quote_number", { p_year: year })
  if (error || !data) throw new Error(`Quote number generation failed: ${error?.message || "unknown"}`)
  return data as string
}

export async function nextPaymentReference(): Promise<string> {
  if (!isSupabaseConfigured()) return "MPP-00000-00000"
  const year = new Date().getFullYear()
  const { data, error } = await supabase.rpc("next_payment_reference", { p_year: year })
  if (error || !data) throw new Error(`Payment reference generation failed: ${error?.message || "unknown"}`)
  return data as string
}

export async function nextReceiptNumber(): Promise<string> {
  if (!isSupabaseConfigured()) return "MPR-00000-00000"
  const year = new Date().getFullYear()
  const { data, error } = await supabase.rpc("next_receipt_number", { p_year: year })
  if (error || !data) throw new Error(`Receipt number generation failed: ${error?.message || "unknown"}`)
  return data as string
}

export async function nextCommissionPayoutReference(): Promise<string> {
  if (!isSupabaseConfigured()) return "MPCP-00000-00000"
  const year = new Date().getFullYear()
  const { data, error } = await supabase.rpc("next_commission_payout_reference", { p_year: year })
  if (error || !data) throw new Error(`Payout reference generation failed: ${error?.message || "unknown"}`)
  return data as string
}

/* ─────────────────────────────────────────────────────────────────────────────
   QUOTE RECALCULATION
   ───────────────────────────────────────────────────────────────────────────── */

export async function recalculateQuote(quoteId: string) {
  if (!isSupabaseConfigured()) return
  const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", quoteId)
  const rows = (items as QuoteItem[]) || []

  let subtotalKobo = 0
  let taxKobo = 0
  let discountKobo = 0

  for (const item of rows) {
    const unitKobo = toKobo(item.unit_price)
    const discKobo = toKobo(item.discount)
    const tKobo = toKobo(item.tax)
    const qty = item.quantity || 0
    const totalKobo = lineTotalKobo(qty, unitKobo, discKobo, tKobo)
    if (toKobo(item.line_total) !== totalKobo) {
      await supabase.from("quote_items").update({ line_total: fromKobo(totalKobo) }).eq("id", item.id)
    }
    subtotalKobo += lineTotalKobo(qty, unitKobo, 0, 0)
    discountKobo += discKobo
    taxKobo += tKobo
  }

  const totalKobo = Math.max(0, subtotalKobo - discountKobo + taxKobo)
  await supabase.from("quotes").update({
    subtotal: fromKobo(subtotalKobo),
    tax_amount: fromKobo(taxKobo),
    discount_amount: fromKobo(discountKobo),
    total_amount: fromKobo(totalKobo),
    updated_at: new Date().toISOString(),
  }).eq("id", quoteId)
}

/* ─────────────────────────────────────────────────────────────────────────────
   INVOICE RECALCULATION
   ─────────────────════════════════════════════════════════════════════════════ */

export async function recalculateInvoice(invoiceId: string) {
  if (!isSupabaseConfigured()) return
  const { data: items } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId)
  const rows = (items as InvoiceItem[]) || []

  let subtotalKobo = 0
  let taxKobo = 0
  let discountKobo = 0

  for (const item of rows) {
    const unitKobo = toKobo(item.unit_price)
    const discKobo = toKobo(item.discount)
    const tKobo = toKobo(item.tax)
    const qty = item.quantity || 0
    const totalKobo = lineTotalKobo(qty, unitKobo, discKobo, tKobo)
    if (toKobo(item.line_total) !== totalKobo) {
      await supabase.from("invoice_items").update({ line_total: fromKobo(totalKobo) }).eq("id", item.id)
    }
    subtotalKobo += lineTotalKobo(qty, unitKobo, 0, 0)
    discountKobo += discKobo
    taxKobo += tKobo
  }

  const totalKobo = Math.max(0, subtotalKobo - discountKobo + taxKobo)

  // Sum confirmed payment allocations
  const { data: allocs } = await supabase
    .from("payment_allocations")
    .select("amount_allocated, payment_id")
    .eq("invoice_id", invoiceId)

  const paidKobo = ((allocs as { amount_allocated: number; payment_id: string }[]) || [])
    .reduce((sum, a) => sum + toKobo(a.amount_allocated), 0)

  const balanceKobo = Math.max(0, totalKobo - paidKobo)

  let status: InvoiceStatus = "DRAFT"
  const { data: inv } = await supabase.from("invoices").select("status, issue_date, due_date").eq("id", invoiceId).single()
  const currentStatus = (inv as { status: InvoiceStatus; issue_date: string; due_date: string } | null)?.status || "DRAFT"

  if (currentStatus === "VOID" || currentStatus === "CANCELLED") {
    status = currentStatus
  } else if (paidKobo >= totalKobo) {
    status = "PAID"
  } else if (paidKobo > 0) {
    status = "PARTIALLY_PAID"
  } else if (currentStatus !== "DRAFT") {
    const due = new Date((inv as { due_date: string }).due_date)
    status = due < new Date() ? "OVERDUE" : "ISSUED"
  }

  await supabase.from("invoices").update({
    subtotal: fromKobo(subtotalKobo),
    tax_amount: fromKobo(taxKobo),
    discount_amount: fromKobo(discountKobo),
    total_amount: fromKobo(totalKobo),
    amount_paid: fromKobo(paidKobo),
    balance_due: fromKobo(balanceKobo),
    status,
    updated_at: new Date().toISOString(),
  }).eq("id", invoiceId)
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAYMENT ALLOCATION
   ───────────────────────────────────────────────────────────────────────────── */

export interface PaymentAllocationInput {
  payment_id: string
  invoice_id: string
  amount: number
}

export async function recordPayment(input: {
  business_id: string
  invoice_id?: string
  amount: number
  currency?: string
  payment_method: PaymentMethod
  gateway_reference?: string
  paid_at?: string
  notes?: string
}) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  const reference = await nextPaymentReference()
  const { data, error } = await supabase.from("payments").insert({
    payment_reference: reference,
    business_id: input.business_id,
    invoice_id: input.invoice_id || null,
    amount: input.amount,
    currency: input.currency || "NGN",
    payment_method: input.payment_method,
    gateway_reference: input.gateway_reference || null,
    status: "PENDING",
    paid_at: input.paid_at || new Date().toISOString(),
    notes: input.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select().single()

  if (error || !data) throw new Error(`Payment record failed: ${error?.message || "unknown"}`)
  return data as Payment
}

export async function confirmPayment(paymentId: string, confirmedBy: string, actorId?: string) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  const now = new Date().toISOString()

  const { data: payment } = await supabase.from("payments").select("*").eq("id", paymentId).single()
  if (!payment) throw new Error("Payment not found")
  if ((payment as Payment).status !== "PENDING") throw new Error(`Payment is not pending: ${(payment as Payment).status}`)

  const { error } = await supabase.from("payments").update({
    status: "CONFIRMED",
    confirmed_at: now,
    confirmed_by: confirmedBy,
    updated_at: now,
  }).eq("id", paymentId)

  if (error) throw new Error(`Payment confirmation failed: ${error.message}`)

  // Allocate to linked invoice if one exists and no allocations yet
  const p = payment as Payment
  if (p.invoice_id && p.status === "PENDING") {
    await allocatePayment({ payment_id: p.id, invoice_id: p.invoice_id, amount: p.amount })
  }

  await logFinanceAudit("ADMIN", actorId, "PAYMENT_CONFIRMED", "PAYMENT", paymentId, { confirmed_by: confirmedBy })

  // Evaluate commissions where payment is the trigger
  await evaluateCommissionsForPayment(paymentId, actorId)
}

export async function allocatePayment(input: PaymentAllocationInput) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  const amountKobo = toKobo(input.amount)
  if (amountKobo <= 0) throw new Error("Allocation amount must be positive")

  const { data: payment } = await supabase.from("payments").select("amount, status").eq("id", input.payment_id).single()
  if (!payment) throw new Error("Payment not found")
  if ((payment as Payment).status !== "CONFIRMED") throw new Error("Payment must be confirmed before allocation")

  const { data: invoice } = await supabase.from("invoices").select("total_amount, amount_paid, status").eq("id", input.invoice_id).single()
  if (!invoice) throw new Error("Invoice not found")
  const inv = invoice as Pick<Invoice, "total_amount" | "amount_paid" | "status">
  if (inv.status === "VOID" || inv.status === "CANCELLED") throw new Error("Cannot allocate to void/cancelled invoice")

  // Already allocated on this payment
  const { data: existing } = await supabase
    .from("payment_allocations")
    .select("amount_allocated")
    .eq("payment_id", input.payment_id)

  const allocatedKobo = ((existing as { amount_allocated: number }[]) || []).reduce((s, a) => s + toKobo(a.amount_allocated), 0)
  const paymentKobo = toKobo((payment as Payment).amount)
  if (allocatedKobo + amountKobo > paymentKobo) throw new Error("Allocation would exceed payment amount")

  // Invoice outstanding
  const totalKobo = toKobo(inv.total_amount)
  const paidKobo = toKobo(inv.amount_paid)
  const balanceKobo = totalKobo - paidKobo
  if (amountKobo > balanceKobo) throw new Error("Allocation would exceed invoice outstanding balance")

  const { error } = await supabase.from("payment_allocations").insert({
    payment_id: input.payment_id,
    invoice_id: input.invoice_id,
    amount_allocated: input.amount,
    created_at: new Date().toISOString(),
  })

  if (error) throw new Error(`Allocation failed: ${error.message}`)

  await recalculateInvoice(input.invoice_id)
}

export async function createReceipt(paymentId: string, issuedBy: string) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  const { data: payment } = await supabase.from("payments").select("*, business_id, amount, currency, status").eq("id", paymentId).single()
  if (!payment) throw new Error("Payment not found")
  if ((payment as Payment).status !== "CONFIRMED") throw new Error("Cannot issue receipt for unconfirmed payment")

  const receiptNumber = await nextReceiptNumber()
  const { data, error } = await supabase.from("receipts").insert({
    receipt_number: receiptNumber,
    payment_id: paymentId,
    business_id: (payment as Payment).business_id,
    amount: (payment as Payment).amount,
    currency: (payment as Payment).currency,
    issued_at: new Date().toISOString(),
    issued_by: issuedBy,
  }).select().single()

  if (error || !data) throw new Error(`Receipt creation failed: ${error?.message || "unknown"}`)
  await logFinanceAudit("ADMIN", issuedBy, "RECEIPT_ISSUED", "RECEIPT", (data as Receipt).id, { payment_id: paymentId })
  return data as Receipt
}

/* ─────────────────────────────────────────────────────────────────────────────
   ENTITLEMENT SYNC
   ───────────────────────────────────────────────────────────────────────────── */

export async function syncEntitlementsFromSubscription(subscriptionId: string, changedBy: string | undefined, reason = "Subscription activated") {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*, plans:plan_id (*)")
    .eq("id", subscriptionId)
    .single()

  if (!sub) throw new Error("Subscription not found")

  const subscription = sub as unknown as { id: string; business_id: string; plan_id: string; status: SubscriptionStatus; quantity: number | null; plans: Plan }
  if (subscription.status !== "ACTIVE") return

  const plan = subscription.plans
  let maxBranches = plan.included_branches
  let maxUsers = plan.included_users
  let onlineStore = plan.online_store_included

  const { data: addons } = await supabase
    .from("subscription_addons")
    .select("*, addons:addon_id (*)")
    .eq("subscription_id", subscriptionId)
    .eq("status", "ACTIVE")

  const activeAddons = (addons as unknown as { addons: Addon; quantity: number }[] | null) || []
  for (const row of activeAddons) {
    const addon = row.addons
    if (addon.code === "ADDITIONAL_BRANCH_YEAR" || addon.code === "ADDITIONAL_BRANCH_ONETIME") {
      maxBranches += row.quantity || 1
    } else if (addon.code === "ADDITIONAL_USER") {
      maxUsers += row.quantity || 1
    } else if (addon.code === "ONLINE_STORE") {
      onlineStore = true
    }
  }

  // Snapshot current entitlements for audit
  const { data: prev } = await supabase.from("business_entitlements").select("*").eq("business_id", subscription.business_id).single()
  const previous = prev as { max_branches: number; max_users: number; online_store_enabled: boolean; subscription_status: string } | null

  const updates = {
    max_branches: maxBranches,
    max_users: maxUsers,
    online_store_enabled: onlineStore,
    subscription_status: "ACTIVE" as const,
    updated_at: new Date().toISOString(),
  }

  await supabase.from("business_entitlements").upsert({
    business_id: subscription.business_id,
    ...updates,
  }, { onConflict: "business_id" })

  await supabase.from("entitlement_change_log").insert({
    business_id: subscription.business_id,
    source_type: "SUBSCRIPTION",
    source_id: subscriptionId,
    previous_values: previous ? {
      max_branches: previous.max_branches,
      max_users: previous.max_users,
      online_store_enabled: previous.online_store_enabled,
      subscription_status: previous.subscription_status,
    } : null,
    new_values: updates,
    reason,
    changed_by: changedBy,
    created_at: new Date().toISOString(),
  })

  await logFinanceAudit("SYSTEM", changedBy, "ENTITLEMENT_SYNCED", "BUSINESS_ENTITLEMENTS", subscription.business_id, { subscription_id: subscriptionId })
}

/* ─────────────────────────────────────────────────────────────────────────────
   SUBSCRIPTION ACTIVATION
   ───────────────────────────────────────────────────────────────────────────── */

export async function activateSubscription(
  subscriptionId: string,
  activatedBy: string,
  options?: { licence_type?: "CLOUD" | "ERP" | "OFFLINE" | "CUSTOM"; expires_at?: string }
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  const now = new Date().toISOString()

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .single()
  if (!sub) throw new Error("Subscription not found")

  const subscription = sub as Subscription
  if (subscription.status !== "PENDING") throw new Error(`Cannot activate subscription in status ${subscription.status}`)

  const { data: plan } = await supabase.from("plans").select("*").eq("id", subscription.plan_id).single()
  if (!plan) throw new Error("Plan not found")

  const p = plan as Plan
  const today = new Date().toISOString().split("T")[0]
  const endDate = subscription.current_period_end

  await supabase.from("subscriptions").update({
    status: "ACTIVE",
    start_date: today,
    current_period_start: today,
    renewal_date: endDate,
    activated_by: activatedBy,
    updated_at: now,
  }).eq("id", subscriptionId)

  // Create or update commercial licence record
  const licenceType = options?.licence_type || (p.code.includes("ERP") ? "ERP" : p.billing_type === "ONE_TIME" ? "OFFLINE" : "CLOUD")
  await supabase.from("business_licenses").upsert({
    business_id: subscription.business_id,
    subscription_id: subscriptionId,
    licence_type: licenceType,
    status: "ACTIVE",
    issued_at: now,
    effective_from: today,
    expires_at: options?.expires_at || endDate,
    max_users: p.included_users,
    max_branches: p.included_branches,
    online_store_enabled: p.online_store_included,
    created_by: activatedBy,
    updated_at: now,
  }, { onConflict: "business_id" })

  // Sync entitlements
  await syncEntitlementsFromSubscription(subscriptionId, activatedBy)

  await logFinanceAudit("ADMIN", activatedBy, "SUBSCRIPTION_ACTIVATED", "SUBSCRIPTION", subscriptionId)
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMMISSION ENGINE
   ───────────────────────────────────────────────────────────────────────────── */

export async function evaluateCommissionsForPayment(paymentId: string, actorId?: string) {
  if (!isSupabaseConfigured()) return
  const { data: payment } = await supabase.from("payments").select("*").eq("id", paymentId).single()
  if (!payment) return
  const p = payment as Payment
  if (p.status !== "CONFIRMED") return

  const { data: business } = await supabase.from("businesses").select("originating_partner_id").eq("id", p.business_id).single()
  const b = business as { originating_partner_id?: string | null } | null
  const partnerId = b?.originating_partner_id
  if (!partnerId) return

  // Find matching active commission plan for payment trigger
  const { data: plans } = await supabase
    .from("commission_plans")
    .select("*")
    .eq("active", true)
    .eq("commission_trigger", "PAYMENT_CONFIRMED")
    .lte("effective_from", new Date().toISOString().split("T")[0])
    .or(`effective_until.is.null,effective_until.gte.${new Date().toISOString().split("T")[0]}`)

  const matching = (plans as CommissionPlan[] | null) || []
  for (const plan of matching) {
    const basisKobo = toKobo(p.amount)
    let commissionKobo = 0

    if (plan.commission_basis === "PERCENTAGE" && plan.percentage) {
      commissionKobo = Math.round(basisKobo * Number(plan.percentage) / 100)
    } else if (plan.commission_basis === "FIXED" && plan.fixed_amount) {
      commissionKobo = toKobo(plan.fixed_amount)
    }

    if (commissionKobo <= 0) continue

    const { data, error } = await supabase.from("partner_commissions").insert({
      partner_id: partnerId,
      business_id: p.business_id,
      payment_id: p.id,
      commission_plan_id: plan.id,
      basis_amount: p.amount,
      commission_rate: plan.percentage,
      fixed_amount: plan.fixed_amount,
      commission_amount: fromKobo(commissionKobo),
      currency: p.currency,
      status: "ELIGIBLE",
      earned_at: new Date().toISOString(),
      attribution_type: "ORIGINATING",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single()

    if (!error && data) {
      await logFinanceAudit("SYSTEM", actorId, "COMMISSION_CREATED", "PARTNER_COMMISSION", (data as PartnerCommission).id, { plan_id: plan.id })
      await logFinanceAudit("SYSTEM", actorId, "COMMISSION_ELIGIBLE", "PARTNER_COMMISSION", (data as PartnerCommission).id)
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   FINANCE OVERVIEW METRICS
   ───────────────────────────────────────────────────────────────────────────── */

export async function getFinanceOverview(): Promise<FinanceOverview> {
  if (!isSupabaseConfigured()) {
    return {
      invoices_issued: 0,
      payments_received: 0,
      outstanding_balance: 0,
      overdue_invoices: 0,
      overdue_balance: 0,
      active_subscriptions: 0,
      renewals_30_days: 0,
      renewals_7_days: 0,
      pending_commissions: 0,
      commission_payable: 0,
    }
  }

  const now = new Date().toISOString()
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const [issued, payments, overdue, outstanding, activeSubs, ren30, ren7, pendingComm] = await Promise.all([
    supabase.from("invoices").select("total_amount", { count: "exact", head: true }).in("status", ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"]),
    supabase.from("payments").select("amount").eq("status", "CONFIRMED"),
    supabase.from("invoices").select("balance_due").eq("status", "OVERDUE"),
    supabase.from("invoices").select("balance_due").in("status", ["ISSUED", "PARTIALLY_PAID", "OVERDUE"]),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("subscription_renewals").select("id", { count: "exact", head: true }).lte("renewal_due_date", in30.split("T")[0]).in("status", ["UPCOMING", "DUE"]),
    supabase.from("subscription_renewals").select("id", { count: "exact", head: true }).lte("renewal_due_date", in7.split("T")[0]).in("status", ["UPCOMING", "DUE"]),
    supabase.from("partner_commissions").select("commission_amount, status").in("status", ["PENDING", "ELIGIBLE"]),
  ])

  const overdueBalance = ((overdue.data as { balance_due: number }[]) || []).reduce((s, i) => s + toKobo(i.balance_due), 0)
  const outstandingBalance = ((outstanding.data as { balance_due: number }[]) || []).reduce((s, i) => s + toKobo(i.balance_due), 0)
  const pendingPayable = ((pendingComm.data as { commission_amount: number; status: CommissionStatus }[]) || [])
    .filter((c) => c.status === "ELIGIBLE" || c.status === "APPROVED" || c.status === "SCHEDULED")
    .reduce((s, c) => s + toKobo(c.commission_amount), 0)

  return {
    invoices_issued: issued.count || 0,
    payments_received: fromKobo(((payments.data as { amount: number }[] | null) || []).reduce((s, p) => s + toKobo(p.amount), 0)),
    outstanding_balance: fromKobo(outstandingBalance),
    overdue_invoices: overdue.data?.length || 0,
    overdue_balance: fromKobo(overdueBalance),
    active_subscriptions: activeSubs.count || 0,
    renewals_30_days: ren30.count || 0,
    renewals_7_days: ren7.count || 0,
    pending_commissions: (pendingComm.data?.length) || 0,
    commission_payable: fromKobo(pendingPayable),
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMMISSION PAYOUT HELPERS
   ───────────────────────────────────────────────────────────────────────────── */

export async function createCommissionPayout(partnerId: string, commissionIds: string[], createdBy: string) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data: commissions } = await supabase
    .from("partner_commissions")
    .select("*")
    .in("id", commissionIds)
    .in("status", ["APPROVED", "SCHEDULED"])

  const rows = (commissions as PartnerCommission[]) || []
  const totalKobo = rows.reduce((s, c) => s + toKobo(c.commission_amount), 0)
  if (totalKobo <= 0) throw new Error("No payable commissions selected")

  const payoutRef = await nextCommissionPayoutReference()
  const { data: payout, error } = await supabase.from("commission_payouts").insert({
    payout_reference: payoutRef,
    partner_id: partnerId,
    amount: fromKobo(totalKobo),
    currency: rows[0]?.currency || "NGN",
    status: "DRAFT",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select().single()

  if (error || !payout) throw new Error(`Payout creation failed: ${error?.message || "unknown"}`)

  for (const c of rows) {
    await supabase.from("commission_payout_items").insert({
      payout_id: (payout as CommissionPayout).id,
      commission_id: c.id,
      amount: c.commission_amount,
      created_at: new Date().toISOString(),
    })
    await supabase.from("partner_commissions").update({ status: "SCHEDULED", updated_at: new Date().toISOString() }).eq("id", c.id)
  }

  await logFinanceAudit("ADMIN", createdBy, "COMMISSION_PAYOUT_CREATED", "COMMISSION_PAYOUT", (payout as CommissionPayout).id)
  return payout as CommissionPayout
}

/* ─────────────────────────────────────────────────────────────────────────────
   RENEWAL DUE UPDATES
   ───────────────────────────────────────────────────────────────────────────── */

export async function refreshRenewalStatus(subscriptionId: string) {
  if (!isSupabaseConfigured()) return
  const { data: sub } = await supabase.from("subscriptions").select("renewal_date, status").eq("id", subscriptionId).single()
  if (!sub) return

  const s = sub as { renewal_date?: string | null; status: SubscriptionStatus }
  if (!s.renewal_date || s.status !== "ACTIVE") return

  const due = new Date(s.renewal_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let status: "UPCOMING" | "DUE" | "OVERDUE" | "RENEWED" | "NOT_RENEWING" = "UPCOMING"
  if (due < today) status = "OVERDUE"
  else if (due.getTime() === today.getTime()) status = "DUE"

  await supabase.from("subscription_renewals").upsert({
    subscription_id: subscriptionId,
    renewal_due_date: s.renewal_date,
    status,
    updated_at: new Date().toISOString(),
  }, { onConflict: "subscription_id" })
}
