/* ───────────────────────────  Referral review (internal)  ───────────────────────────
 * Admin/Sales reads for the referral decision queue. This is the internal view:
 * it may carry duplicate match detail and cross-partner information that the
 * portal is never allowed to see (that projection lives in referral-portal.ts).
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { runReferralDuplicateCheck, type DuplicateCheckResult } from "./referral"
import { REFERRAL_STATUS_LABELS, type ReferralStatus } from "./referral-status"

type Row = Record<string, unknown>
const str = (v: unknown) => (v == null ? "" : String(v))

export interface ReferralReviewRow {
  id: string
  referralReference: string
  status: string
  statusLabel: string
  businessName: string
  contactName: string
  phone: string
  email: string
  country: string
  state: string
  city: string
  businessType: string
  estimatedBranches: number | null
  estimatedUsers: number | null
  currentSystem: string
  knownRequirement: string
  relationshipSource: string
  notes: string
  consentConfirmed: boolean
  consentAt: string | null
  partnerId: string | null
  partnerName: string | null
  submittedAt: string | null
  acceptanceAt: string | null
  protectionExpiresAt: string | null
  protectionStatus: string
  informationRequestMessage: string | null
  informationRequestDueAt: string | null
  informationResponse: string | null
  decisionByName: string | null
  decisionReason: string | null
  closureReason: string | null
  salesOwner: string | null
  createdAt: string
}

function mapRow(row: Row): ReferralReviewRow {
  const status = str(row.status)
  return {
    id: str(row.id),
    referralReference: str(row.referral_reference),
    status,
    statusLabel: REFERRAL_STATUS_LABELS[status as ReferralStatus] ?? status,
    businessName: str(row.business_name),
    contactName: str(row.contact_name),
    phone: str(row.phone),
    email: str(row.email),
    country: str(row.country),
    state: str(row.state),
    city: str(row.city),
    businessType: str(row.business_type) || str(row.industry),
    estimatedBranches: (row.estimated_branches as number | null) ?? null,
    estimatedUsers: (row.estimated_users as number | null) ?? null,
    currentSystem: str(row.current_system),
    knownRequirement: str(row.known_requirement),
    relationshipSource: str(row.relationship_source),
    notes: str(row.notes),
    consentConfirmed: Boolean(row.consent_confirmed),
    consentAt: (row.consent_at as string | null) ?? null,
    partnerId: (row.partner_id as string | null) ?? null,
    partnerName: str(((row.partners as Row | undefined) || {})?.business_name) || null,
    submittedAt: (row.submitted_at as string | null) ?? null,
    acceptanceAt: (row.acceptance_at as string | null) ?? null,
    protectionExpiresAt: (row.protection_expires_at as string | null) ?? null,
    protectionStatus: str(row.protection_status),
    informationRequestMessage: (row.information_request_message as string | null) ?? null,
    informationRequestDueAt: (row.information_request_due_at as string | null) ?? null,
    informationResponse: (row.information_response as string | null) ?? null,
    decisionByName: (row.decision_by_name as string | null) ?? null,
    decisionReason: (row.decision_reason as string | null) ?? null,
    closureReason: (row.closure_reason as string | null) ?? null,
    salesOwner: (row.sales_owner as string | null) ?? null,
    createdAt: str(row.created_at),
  }
}

/**
 * The decision queue. Only rows created through the referral workflow carry a
 * referral_reference, which keeps legacy partner-lead pipeline rows out of it.
 */
export async function listReferralsForReview(
  filters: { status?: string | null; partnerId?: string | null; search?: string | null } = {}
): Promise<ReferralReviewRow[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase
    .from("partner_leads")
    .select("*, partners(business_name)")
    .not("referral_reference", "is", null)
    .order("created_at", { ascending: false })
    .limit(300)
  if (filters.status) q = q.eq("status", filters.status)
  if (filters.partnerId) q = q.eq("partner_id", filters.partnerId)
  const search = filters.search?.trim()
  if (search) {
    const safe = search.replace(/[,%]/g, "")
    q = q.or(`referral_reference.ilike.%${safe}%,business_name.ilike.%${safe}%,contact_name.ilike.%${safe}%`)
  }

  const { data } = await q
  return ((data || []) as Row[]).map(mapRow)
}

export interface ReferralReviewDetail {
  referral: ReferralReviewRow
  timeline: { previousStatus: string | null; status: string; actorType: string; actorName: string | null; reason: string | null; at: string }[]
  duplicate: DuplicateCheckResult
  earnings: { id: string; status: string; earningKind: string; commissionNaira: number; invoiceId: string | null }[]
}

/**
 * Full reviewer context for one referral, including the live duplicate re-check
 * with internal match detail. Never expose this shape to the partner portal.
 */
export async function getReferralReviewDetail(referralId: string): Promise<ReferralReviewDetail | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("partner_leads")
    .select("*, partners(business_name)")
    .eq("id", referralId)
    .maybeSingle()
  const row = data as Row | null
  if (!row || !str(row.referral_reference)) return null

  const [{ data: history }, duplicate, commissions] = await Promise.all([
    supabase
      .from("referral_status_history")
      .select("previous_status, new_status, actor_type, actor_name, reason, created_at")
      .eq("referral_id", referralId)
      .order("created_at", { ascending: true }),
    runReferralDuplicateCheck({
      businessName: str(row.business_name),
      phone: str(row.phone),
      email: str(row.email),
      partnerId: (row.partner_id as string | null) ?? null,
      excludeReferralId: referralId,
    }),
    supabase
      .from("partner_commissions")
      .select("id, status, earning_kind, commission_amount, invoice_id")
      .eq("referral_id", referralId),
  ])

  return {
    referral: mapRow(row),
    timeline: ((history || []) as Row[]).map((h) => ({
      previousStatus: (h.previous_status as string | null) ?? null,
      status: str(h.new_status),
      actorType: str(h.actor_type),
      actorName: (h.actor_name as string | null) ?? null,
      reason: (h.reason as string | null) ?? null,
      at: str(h.created_at),
    })),
    duplicate,
    earnings: (((commissions as { data?: Row[] }).data || []) as Row[]).map((c) => ({
      id: str(c.id),
      status: str(c.status),
      earningKind: str(c.earning_kind),
      commissionNaira: Number(c.commission_amount || 0),
      invoiceId: (c.invoice_id as string | null) ?? null,
    })),
  }
}
