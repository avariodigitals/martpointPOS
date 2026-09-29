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
  planName?: string
  locations?: string
  usersEstimate?: string
  servicesRequested?: string
  assumptions?: string
  notes?: string
  dueDate?: string | null
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
    .select("id, partner_id, status")
    .eq("id", input.partnerLeadId)
    .single()
  if (!lead || lead.partner_id !== partnerId) return { ok: false, error: "Opportunity not found" }
  if (["LOST", "EXPIRED"].includes(lead.status as string)) {
    return { ok: false, error: "A quote cannot be requested on a lost or expired opportunity" }
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
      plan_name: input.planName ?? null,
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
    .select("*, partner_leads(company_name, contact_name, status)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
  return (data || []) as Record<string, unknown>[]
}

export async function listQuoteRequestsForAdmin(partnerId?: string): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase
    .from("partner_quote_requests")
    .select("*, partners(business_name, partner_id), partner_leads(company_name, contact_name)")
    .order("created_at", { ascending: false })
  if (partnerId) q = q.eq("partner_id", partnerId)
  const { data } = await q
  return (data || []) as Record<string, unknown>[]
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
