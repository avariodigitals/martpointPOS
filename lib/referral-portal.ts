/* ───────────────────────────  Referral portal reads (partner-safe)  ───────────────────────────
 * One place decides what a Referral Partner may see about their own referrals.
 * Both the portal pages and /api/partner/referrals* use these loaders, so a
 * field can never be added to one path and forgotten in the other.
 *
 * Never returned: internal duplicate match detail, another partner's identity,
 * sales notes, decision internals or any figure before COMMISSION_ELIGIBLE.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import {
  toPartnerSafeReferral,
  canPartnerAccessReferral,
  showsPayableCommission,
  REFERRAL_STATUS_LABELS,
  type PartnerSafeReferral,
} from "./referral-status"
import { listPartnerReferralCommissions } from "./referral-finance"
import { listGeneratedDocuments, GENERATED_DOC_TYPE_LABELS } from "./partner-generated-docs"

type Row = Record<string, unknown>

const str = (v: unknown) => (v == null ? "" : String(v))

export interface PartnerReferralListItem extends PartnerSafeReferral {
  id: string
}

/** Payable amount per referral — only APPROVED/PAID earnings count, and only
 *  when the referral's own status permits a payable figure. */
async function payableByReferral(partnerId: string): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for (const row of await listPartnerReferralCommissions(partnerId)) {
    const rid = str(row.referral_id)
    if (!rid) continue
    if (!["APPROVED", "PAID"].includes(str(row.status))) continue
    map.set(rid, (map.get(rid) || 0) + Number(row.commission_amount || 0))
  }
  return map
}

function project(row: Row, payable: number): PartnerReferralListItem {
  const status = str(row.status) || "SUBMITTED"
  return {
    id: str(row.id),
    ...toPartnerSafeReferral(str(row.referral_reference), str(row.business_name), (row.submitted_at as string) ?? null, {
      status,
      acceptanceDate: (row.acceptance_at as string) ?? null,
      protectionExpiresAt: (row.protection_expires_at as string) ?? null,
      requiredAction: (row.information_request_message as string) ?? null,
      informationRequestDue: (row.information_request_due_at as string) ?? null,
      closureReason: (row.closure_reason as string) ?? null,
      payableCommissionNaira: showsPayableCommission(status) ? payable : 0,
    }),
  }
}

export async function listPartnerReferrals(partnerId: string): Promise<PartnerReferralListItem[]> {
  if (!isSupabaseConfigured() || !partnerId) return []
  const [{ data }, payable] = await Promise.all([
    supabase
      .from("partner_leads")
      .select("*")
      .eq("partner_id", partnerId)
      .not("referral_reference", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
    payableByReferral(partnerId),
  ])
  return ((data || []) as Row[]).map((r) => project(r, payable.get(str(r.id)) || 0))
}

export interface PartnerReferralDocument {
  id: string
  label: string
  issuedAt: string
}

export interface PartnerReferralTimelineEntry {
  status: string
  statusLabel: string
  at: string
}

export interface PartnerReferralDetail {
  referral: PartnerReferralListItem
  /** The partner's own submitted answers — safe to echo back to their author. */
  submitted: {
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
    informationResponse: string | null
  }
  timeline: PartnerReferralTimelineEntry[]
  documents: PartnerReferralDocument[]
}

export async function getPartnerReferralDetail(
  partnerId: string,
  referralId: string
): Promise<PartnerReferralDetail | null> {
  if (!isSupabaseConfigured() || !partnerId || !referralId) return null

  const { data } = await supabase.from("partner_leads").select("*").eq("id", referralId).maybeSingle()
  const row = data as Row | null
  if (!row || !canPartnerAccessReferral(str(row.partner_id) || null, partnerId)) return null
  if (!str(row.referral_reference)) return null

  const payable = await payableByReferral(partnerId)
  const [{ data: history }, documents] = await Promise.all([
    supabase
      .from("referral_status_history")
      .select("new_status, created_at")
      .eq("referral_id", referralId)
      .order("created_at", { ascending: true }),
    listGeneratedDocuments(partnerId),
  ])

  return {
    referral: project(row, payable.get(referralId) || 0),
    submitted: {
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
      informationResponse: (row.information_response as string | null) ?? null,
    },
    // Status and date only — reasons arrive as controlled documents.
    timeline: ((history || []) as Row[]).map((h) => ({
      status: str(h.new_status),
      statusLabel: REFERRAL_STATUS_LABELS[str(h.new_status) as keyof typeof REFERRAL_STATUS_LABELS] ?? str(h.new_status),
      at: str(h.created_at),
    })),
    documents: documents
      .filter((d) => d.sourceRecordId === referralId)
      .map((d) => ({
        id: d.id,
        label: GENERATED_DOC_TYPE_LABELS[d.documentType] ?? d.title,
        issuedAt: d.generatedAt,
      })),
  }
}

/* ─── Payout batches (Finance records, partner-safe projection) ─── */

export interface PartnerPayoutItem {
  reference: string
  amountNaira: number
  currency: string
  status: string
  approvedAt: string | null
  paidAt: string | null
  paymentReference: string | null
}

/**
 * Only payouts Finance has approved or paid reach the portal. Internal notes are
 * never selected, and the bank reference is disclosed once the money has left.
 */
export async function listPartnerPayouts(partnerId: string): Promise<PartnerPayoutItem[]> {
  if (!isSupabaseConfigured() || !partnerId) return []
  const { data } = await supabase
    .from("commission_payouts")
    .select("payout_reference, amount, currency, status, approved_at, paid_at, bank_reference")
    .eq("partner_id", partnerId)
    .in("status", ["APPROVED", "PAID"])
    .order("paid_at", { ascending: false })
    .limit(24)
  return ((data || []) as Row[]).map((p) => ({
    reference: str(p.payout_reference),
    amountNaira: Number(p.amount) || 0,
    currency: str(p.currency) || "NGN",
    status: str(p.status),
    approvedAt: p.approved_at ? str(p.approved_at) : null,
    paidAt: p.paid_at ? str(p.paid_at) : null,
    paymentReference: str(p.status) === "PAID" ? str(p.bank_reference) || null : null,
  }))
}
