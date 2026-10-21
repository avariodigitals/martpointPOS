import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "./audit"

/* ───────────────────────────  Quotation requests  ───────────────────────────
 * Blueprint: a partner requests a MartPoint-issued quote against a registered
 * lead. MartPoint Sales reviews and issues or declines; the partner does not
 * approve its own request.
 */

export type QuoteRequestStatus = "SUBMITTED" | "UNDER_REVIEW" | "ISSUED" | "DECLINED" | "EXPIRED"

export const QUOTE_REQUEST_STATUS_LABELS: Record<QuoteRequestStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  ISSUED: "Quote issued",
  DECLINED: "Declined",
  EXPIRED: "Expired",
}

function now() {
  return new Date().toISOString()
}

export interface QuoteRequestInput {
  partnerLeadId: string
  planId?: string
  planName?: string
  locations?: string
  usersEstimate?: string
  servicesRequested?: string
  assumptions?: string
  notes?: string
  dueDate?: string | null
}

export interface PartnerQuotePlan {
  id: string
  name: string
  code: string
  description: string | null
  billingType: string
  billingInterval: string
  currency: string
  basePrice: number
  includedBranches: number
  includedUsers: number
  onlineStoreIncluded: boolean
}

export async function listPartnerQuotePlans(): Promise<PartnerQuotePlan[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, code, description, billing_type, billing_interval, currency, base_price, included_branches, included_users, online_store_included")
    .eq("active", true)
    .order("name")
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    code: row.code as string,
    description: (row.description as string | null) ?? null,
    billingType: row.billing_type as string,
    billingInterval: row.billing_interval as string,
    currency: (row.currency as string) || "NGN",
    basePrice: Number(row.base_price) || 0,
    includedBranches: Number(row.included_branches) || 0,
    includedUsers: Number(row.included_users) || 0,
    onlineStoreIncluded: Boolean(row.online_store_included),
  }))
}

export async function createQuoteRequest(
  partnerId: string,
  user: { id: string; name: string },
  input: QuoteRequestInput
): Promise<{ ok: boolean; error?: string; request?: Record<string, unknown> }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  // The request must attach to a live lead owned by this partner.
  const { data: lead } = await supabase
    .from("partner_leads")
    .select("id, partner_id, status, protection_status")
    .eq("id", input.partnerLeadId)
    .single()
  if (!lead || lead.partner_id !== partnerId) return { ok: false, error: "Opportunity not found" }
  if (["LOST", "EXPIRED"].includes(lead.status as string)) {
    return { ok: false, error: "A quote cannot be requested on a lost or expired opportunity" }
  }
  if (lead.protection_status !== "PROTECTED") {
    return { ok: false, error: "MartPoint must protect this opportunity before a quote can be requested" }
  }

  let selectedPlanId: string | null = null
  let selectedPlanName = input.planName?.trim() || null
  if (!input.planId && !selectedPlanName) return { ok: false, error: "Select a plan before requesting a quote" }
  if (input.planId) {
    const { data: plan } = await supabase
      .from("plans")
      .select("id, name, active")
      .eq("id", input.planId)
      .maybeSingle()
    if (!plan || plan.active !== true) return { ok: false, error: "Select a current active plan" }
    selectedPlanId = plan.id as string
    selectedPlanName = plan.name as string
  }

  // One open request per lead.
  const { data: existing } = await supabase
    .from("partner_quote_requests")
    .select("id")
    .eq("partner_lead_id", input.partnerLeadId)
    .in("status", ["SUBMITTED", "UNDER_REVIEW"])
    .limit(1)
  if ((existing || []).length > 0) {
    return { ok: false, error: "A quote request is already open for this opportunity" }
  }

  const { data, error } = await supabase
    .from("partner_quote_requests")
    .insert({
      partner_id: partnerId,
      partner_lead_id: input.partnerLeadId,
      requested_by: user.id,
      plan_id: selectedPlanId,
      plan_name: selectedPlanName,
      locations: input.locations ?? null,
      users_estimate: input.usersEstimate ?? null,
      services_requested: input.servicesRequested ?? null,
      assumptions: input.assumptions ?? null,
      notes: input.notes ?? null,
      due_date: input.dueDate ?? null,
      status: "SUBMITTED",
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: "Failed to submit quote request" }

  await recordAudit(
    { actorType: "PARTNER", actorId: user.id },
    {
      action: AUDIT_ACTIONS.PARTNER_QUOTE_REQUEST_CREATED,
      entityType: AUDIT_ENTITIES.PARTNER_QUOTE_REQUEST,
      entityId: data.id as string,
      metadata: { partnerId, partnerLeadId: input.partnerLeadId, requestedByName: user.name },
    }
  )
  return { ok: true, request: data }
}

export async function listPartnerQuoteRequests(partnerId: string): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("partner_quote_requests")
    .select("*, partner_leads(business_name, contact_name, status)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
  return (data || []) as Record<string, unknown>[]
}

/** Load one request and its issued Finance quote, if Sales has linked one. */
export async function getPartnerQuoteRequestForPartner(
  requestId: string,
  partnerId: string,
): Promise<{ request: Record<string, unknown>; lead: Record<string, unknown> | null; quote: Record<string, unknown> | null } | null> {
  if (!isSupabaseConfigured()) return null
  const { data: request } = await supabase
    .from("partner_quote_requests")
    .select("*, partner_leads(*)")
    .eq("id", requestId)
    .eq("partner_id", partnerId)
    .maybeSingle()
  if (!request) return null

  const leadRaw = request.partner_leads as Record<string, unknown> | Record<string, unknown>[] | null
  const lead = Array.isArray(leadRaw) ? leadRaw[0] || null : leadRaw
  const ref = typeof request.issued_quote_ref === "string" ? request.issued_quote_ref.trim() : ""
  if (!ref) return { request: request as Record<string, unknown>, lead, quote: null }

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, quote_items(*)")
    .eq("quote_number", ref)
    .maybeSingle()

  // An admin may issue an older quote that has no partner linkage. If linkage
  // exists, it must still point to this partner/request before it is exposed.
  if (quote && (
    (quote.partner_id && quote.partner_id !== partnerId) ||
    (quote.partner_lead_id && quote.partner_lead_id !== request.partner_lead_id)
  )) {
    return { request: request as Record<string, unknown>, lead, quote: null }
  }

  return { request: request as Record<string, unknown>, lead, quote: (quote as Record<string, unknown> | null) || null }
}

export async function listQuoteRequestsForAdmin(partnerId?: string): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase
    .from("partner_quote_requests")
    .select("*, partners(business_name, partner_id), partner_leads(business_name, contact_name)")
    .order("created_at", { ascending: false })
  if (partnerId) q = q.eq("partner_id", partnerId)
  const { data } = await q
  return (data || []) as Record<string, unknown>[]
}

/**
 * Repair a quote request created before plan selection was introduced. The
 * request can be repaired with only a plan, or with the old Finance quote
 * number as well. A business/customer is never created by this operation.
 */
export async function repairPartnerQuoteRequest(
  quoteRequestId: string,
  planId: string,
  quoteRef: string | null,
  repairedBy: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: plan } = await supabase.from("plans").select("id, name, active").eq("id", planId).maybeSingle()
  if (!plan || plan.active !== true) return { ok: false, error: "Select a current active plan" }

  const { data: qr } = await supabase.from("partner_quote_requests").select("*").eq("id", quoteRequestId).maybeSingle()
  if (!qr) return { ok: false, error: "Quote request not found" }

  type RepairQuote = { id: string; quote_number: string; status: string; partner_id: string | null; partner_lead_id: string | null }
  let quote: RepairQuote | null = null
  const ref = (quoteRef || (qr.issued_quote_ref as string) || "").trim()
  if (ref) {
    const result = await supabase
      .from("quotes")
      .select("id, quote_number, status, partner_id, partner_lead_id")
      .eq("quote_number", ref)
      .maybeSingle()
    if (result.error || !result.data) return { ok: false, error: "Finance quote not found. Check the quote number and try again." }
    quote = result.data as RepairQuote
    if (quote.partner_id && quote.partner_id !== qr.partner_id) return { ok: false, error: "That quote belongs to another partner" }
    if (quote.partner_lead_id && quote.partner_lead_id !== qr.partner_lead_id) return { ok: false, error: "That quote is linked to another opportunity" }

    const quoteUpdate: Record<string, unknown> = {
      plan_id: plan.id,
      updated_at: now(),
    }
    if (!quote.partner_id) quoteUpdate.partner_id = qr.partner_id
    if (!quote.partner_lead_id) quoteUpdate.partner_lead_id = qr.partner_lead_id
    const { error } = await supabase.from("quotes").update(quoteUpdate).eq("id", quote.id)
    if (error) return { ok: false, error: "The legacy quote could not be repaired. Apply migration 115 and try again." }
  }

  const requestUpdate: Record<string, unknown> = {
    plan_id: plan.id,
    plan_name: plan.name,
    updated_at: now(),
  }
  if (quote) {
    requestUpdate.issued_quote_ref = quote.quote_number
    // A quote already sent/accepted is ready for the partner. A draft remains
    // draft so Sales can still use the normal Issue linked quote action.
    if (["SENT", "ACCEPTED"].includes(quote.status) && ["SUBMITTED", "UNDER_REVIEW"].includes(qr.status as string)) {
      requestUpdate.status = "ISSUED"
      requestUpdate.decided_by = repairedBy
      requestUpdate.decided_at = now()
      requestUpdate.decision_reason = "Legacy quote repaired and linked"
    }
  }
  const { error } = await supabase.from("partner_quote_requests").update(requestUpdate).eq("id", quoteRequestId)
  if (error) return { ok: false, error: "The quote request could not be repaired" }

  await recordAudit(
    { actorType: "ADMIN", actorId: repairedBy },
    {
      action: AUDIT_ACTIONS.PARTNER_QUOTE_REQUEST_DECIDED,
      entityType: AUDIT_ENTITIES.PARTNER_QUOTE_REQUEST,
      entityId: quoteRequestId,
      metadata: { planId: plan.id, quoteRef: quote?.quote_number || null, legacyRepair: true },
    }
  )
  return { ok: true }
}

/** MartPoint Sales decision: UNDER_REVIEW → ISSUED (with quote ref) or DECLINED. */
export async function decideQuoteRequest(
  quoteRequestId: string,
  decision: "ISSUED" | "DECLINED" | "UNDER_REVIEW",
  opts: { issuedQuoteRef?: string | null; decisionReason?: string | null },
  decidedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  if (decision === "ISSUED" && !opts.issuedQuoteRef?.trim()) {
    return { ok: false, error: "A quote reference is required when issuing" }
  }

  const { data: qr } = await supabase.from("partner_quote_requests").select("*").eq("id", quoteRequestId).single()
  if (!qr) return { ok: false, error: "Quote request not found" }
  if (!["SUBMITTED", "UNDER_REVIEW"].includes(qr.status as string)) {
    return { ok: false, error: "Quote request already decided" }
  }

  if (decision === "ISSUED") {
    const { data: quote } = await supabase
      .from("quotes")
      .select("id, status, partner_id, partner_lead_id")
      .eq("quote_number", opts.issuedQuoteRef!.trim())
      .maybeSingle()
    if (!quote) return { ok: false, error: "Create the Finance quote first, then enter its quote number here" }
    if (quote.partner_id && quote.partner_id !== qr.partner_id) return { ok: false, error: "That quote belongs to another partner" }
    if (quote.partner_lead_id && quote.partner_lead_id !== qr.partner_lead_id) return { ok: false, error: "That quote is linked to another opportunity" }
    if (["DECLINED", "EXPIRED", "CONVERTED"].includes(quote.status as string)) {
      return { ok: false, error: `The Finance quote is already ${String(quote.status).toLowerCase()}` }
    }
    if (quote.status === "DRAFT") {
      await supabase.from("quotes").update({ status: "SENT", updated_at: now() }).eq("id", quote.id)
    }
  }

  const { error } = await supabase
    .from("partner_quote_requests")
    .update({
      status: decision,
      issued_quote_ref: decision === "ISSUED" ? opts.issuedQuoteRef!.trim() : null,
      decided_by: decidedBy,
      decided_at: now(),
      decision_reason: opts.decisionReason ?? null,
      updated_at: now(),
    })
    .eq("id", quoteRequestId)
  if (error) return { ok: false, error: "Failed to record decision" }

  await recordAudit(
    { actorType: "ADMIN", actorId: decidedBy },
    {
      action: AUDIT_ACTIONS.PARTNER_QUOTE_REQUEST_DECIDED,
      entityType: AUDIT_ENTITIES.PARTNER_QUOTE_REQUEST,
      entityId: quoteRequestId,
      metadata: { partnerId: qr.partner_id, partnerLeadId: qr.partner_lead_id, decision, issuedQuoteRef: opts.issuedQuoteRef },
    }
  )
  return { ok: true }
}
