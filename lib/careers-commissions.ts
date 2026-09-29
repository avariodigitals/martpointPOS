/* ───────────────────────────  Careers commission engine  ───────────────────────────
 * Pure, unit-testable commission rules for workforce roles. Commission is
 * calculated ONLY from qualifying collected revenue — taxes, refunded
 * payments, logistics, reimbursable expenses and hardware are excluded unless
 * management explicitly re-includes a category via include_overrides.
 */

import { supabase, isSupabaseConfigured } from "./supabase"

/** Revenue categories that never earn commission unless explicitly re-enabled. */
export const COMMISSION_EXCLUDED_CATEGORIES = [
  "taxes",
  "refunds",
  "logistics",
  "reimbursable expenses",
  "hardware",
] as const

export const COMMISSION_APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const
export const COMMISSION_PAYMENT_STATUSES = ["EARNED", "PAYABLE", "PAID", "REVERSED"] as const
export const LEAD_SOURCES = ["SELF_GENERATED", "COMPANY_GENERATED"] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

export interface CommissionRules {
  /** JSONB blob — callers may carry additional rule keys. */
  [key: string]: unknown
  /** If non-empty, only these categories qualify. */
  eligible_categories?: string[]
  /** Additional exclusions on top of the built-in defaults. */
  excluded_categories?: string[]
  /** Categories management has explicitly re-included (overrides defaults). */
  include_overrides?: string[]
  basis?: "PERCENTAGE" | "FIXED"
  /** Fallback percentage for PERCENTAGE basis. */
  percentage?: number
  /** Amount for FIXED basis (kobo). */
  fixed_amount_kobo?: number
  /** Percentage rate for self-generated leads. */
  self_lead_rate?: number | null
  /** Percentage rate for company-generated leads. */
  company_lead_rate?: number | null
  /** Earned commission only becomes payable at or above this (kobo). */
  minimum_payout_kobo?: number | null
  /** When true, refunded qualifying revenue reverses earned commission. */
  clawback_on_refund?: boolean
}

export interface CommissionInput {
  category: string
  amountKobo: number
  leadSource: LeadSource
  /** true when the underlying payment was refunded/charged back. */
  refunded?: boolean
}

export interface CommissionResult {
  eligible: boolean
  reason: string | null
  /** Rate applied for PERCENTAGE basis, or null for FIXED. */
  rate: number | null
  amountKobo: number
  /** Whether the amount meets the minimum payment threshold. */
  payable: boolean
}

const norm = (s: string) => s.trim().toLowerCase()

/** Decides whether a revenue category qualifies for commission. */
export function isEligibleRevenueCategory(
  category: string,
  rules: CommissionRules = {}
): { eligible: boolean; reason: string | null } {
  const c = norm(category)
  if (!c) return { eligible: false, reason: "Missing revenue category" }

  const overrides = new Set((rules.include_overrides || []).map(norm))
  if (overrides.has(c)) return { eligible: true, reason: null }

  const excluded = new Set([
    ...COMMISSION_EXCLUDED_CATEGORIES,
    ...(rules.excluded_categories || []).map(norm),
  ])
  if (excluded.has(c)) {
    return { eligible: false, reason: `Category "${category}" is excluded from commission` }
  }

  const eligible = (rules.eligible_categories || []).map(norm)
  if (eligible.length > 0 && !eligible.includes(c)) {
    return { eligible: false, reason: `Category "${category}" is not an eligible revenue category` }
  }

  return { eligible: true, reason: null }
}

/** Rate for the lead source: self-generated rate falls back to base percentage. */
export function commissionRate(rules: CommissionRules, leadSource: LeadSource): number | null {
  if ((rules.basis || "PERCENTAGE") === "FIXED") return null
  const specific = leadSource === "SELF_GENERATED" ? rules.self_lead_rate : rules.company_lead_rate
  if (specific != null) return specific
  return rules.percentage ?? null
}

/**
 * Compute commission for a collected payment.
 * Pure — safe to unit test. Money is integer kobo, rounded half-up.
 */
export function computeCommission(rules: CommissionRules, input: CommissionInput): CommissionResult {
  if (input.refunded) {
    if (rules.clawback_on_refund !== false) {
      return { eligible: false, reason: "Payment was refunded — commission reversed/excluded", rate: null, amountKobo: 0, payable: false }
    }
  }
  const { eligible, reason } = isEligibleRevenueCategory(input.category, rules)
  if (!eligible) return { eligible: false, reason, rate: null, amountKobo: 0, payable: false }

  let amount = 0
  let rate: number | null = null
  if ((rules.basis || "PERCENTAGE") === "FIXED") {
    amount = Math.round(rules.fixed_amount_kobo || 0)
  } else {
    rate = commissionRate(rules, input.leadSource)
    if (rate == null) {
      return { eligible: false, reason: "No commission rate configured for this lead source", rate: null, amountKobo: 0, payable: false }
    }
    amount = Math.round((input.amountKobo * rate) / 100)
  }

  const threshold = rules.minimum_payout_kobo
  const payable = threshold == null || amount >= threshold
  return {
    eligible: true,
    reason: payable ? null : `Below minimum payout threshold (₦${((threshold || 0) / 100).toLocaleString("en-NG")})`,
    rate,
    amountKobo: amount,
    payable,
  }
}

/* ─── Ledger helpers (service-role) ─── */

export interface CareerCommission {
  id: string
  earner_label: string
  candidate_id: string | null
  user_id: string | null
  vacancy_id: string | null
  role_template_id: string | null
  lead_id: string | null
  business_id: string | null
  revenue_category: string
  lead_source: LeadSource
  qualifying_amount_kobo: number
  basis: "PERCENTAGE" | "FIXED"
  rate: number | null
  amount_kobo: number
  approval_status: (typeof COMMISSION_APPROVAL_STATUSES)[number]
  payment_status: (typeof COMMISSION_PAYMENT_STATUSES)[number]
  earned_at: string
  payable_at: string | null
  paid_at: string | null
  approved_by: string | null
  paid_by: string | null
  reversal_of_id: string | null
  notes: string | null
  created_at: string
}

export async function listCommissions(filters: { payment_status?: string; approval_status?: string } = {}): Promise<CareerCommission[]> {
  if (!isSupabaseConfigured()) return []
  let query = supabase.from("career_commissions").select("*").order("earned_at", { ascending: false })
  if (filters.payment_status) query = query.eq("payment_status", filters.payment_status)
  if (filters.approval_status) query = query.eq("approval_status", filters.approval_status)
  const { data } = await query
  return (data || []) as CareerCommission[]
}

export async function commissionTotals(): Promise<{ earned: number; approved: number; paid: number }> {
  if (!isSupabaseConfigured()) return { earned: 0, approved: 0, paid: 0 }
  const { data } = await supabase
    .from("career_commissions")
    .select("amount_kobo, approval_status, payment_status")
  let earned = 0, approved = 0, paid = 0
  for (const c of data || []) {
    if (c.payment_status === "REVERSED" || c.approval_status === "REJECTED") continue
    earned += c.amount_kobo || 0
    if (c.approval_status === "APPROVED") approved += c.amount_kobo || 0
    if (c.payment_status === "PAID") paid += c.amount_kobo || 0
  }
  return { earned, approved, paid }
}
