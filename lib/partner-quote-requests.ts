import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "./audit"
import { notifyAllAdmins } from "./admin-notifications"
import { REPLY_TO } from "./email"
import { notifyPartnerCustomerEvent, notifyPartnerQuoteIssued } from "./partner-notifications"
import { nextQuoteNumber, recalculateQuote } from "./finance-commercial"
import { getPublicSiteSettings } from "./settings"
import { resolveQuoteTemplate } from "./quote-templates"

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
    .select("id, partner_id, status, protection_status, business_name, contact_name, industry, business_type")
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
  let selectedPlan: { id: string; name: string; active: boolean; base_price: number; currency: string } | null = null
  if (!input.planId && !selectedPlanName) return { ok: false, error: "Select a plan before requesting a quote" }
  if (input.planId) {
    const { data: plan } = await supabase
      .from("plans")
      .select("id, name, active, base_price, currency")
      .eq("id", input.planId)
      .maybeSingle()
    if (!plan || plan.active !== true) return { ok: false, error: "Select a current active plan" }
    selectedPlan = {
      id: String(plan.id),
      name: String(plan.name),
      active: Boolean(plan.active),
      base_price: Number(plan.base_price) || 0,
      currency: String(plan.currency || "NGN"),
    }
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

  // Every new partner request is also a normal commercial quote from the
  // moment it enters the system. The request row remains the partner-facing
  // workflow envelope, while Finance works the linked quote like any other.
  const quoteNumber = await nextQuoteNumber()
  const industry = (lead.industry as string | null) || (lead.business_type as string | null) || null
  const template = resolveQuoteTemplate(industry)
  const siteSettings = await getPublicSiteSettings()
  const quoteTotal = Number(selectedPlan?.base_price || 0)
  const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      quote_number: quoteNumber,
      business_id: null,
      partner_id: partnerId,
      partner_lead_id: input.partnerLeadId,
      partner_quote_request_id: data.id,
      quote_origin: "PARTNER_REQUEST",
      plan_id: selectedPlanId,
      status: "DRAFT",
      currency: selectedPlan?.currency || "NGN",
      subtotal: quoteTotal,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: quoteTotal,
      valid_until: validUntil,
      notes_public: template.publicNotes,
      notes_internal: [
        "Created from a partner quote request.",
        input.locations ? `Locations: ${input.locations}` : null,
        input.usersEstimate ? `Estimated users: ${input.usersEstimate}` : null,
        input.servicesRequested ? `Services requested: ${input.servicesRequested}` : null,
        input.assumptions ? `Assumptions: ${input.assumptions}` : null,
        input.notes ? `Partner notes: ${input.notes}` : null,
      ].filter(Boolean).join("\n"),
      payment_terms: template.paymentTerms,
      bank_details: siteSettings.accountNumber.trim() || null,
      template_industry: industry,
      created_by: user.id,
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single()

  if (quoteError || !quote) {
    await supabase.from("partner_quote_requests").delete().eq("id", data.id)
    return { ok: false, error: "The request was received but its Finance quote could not be created" }
  }

  const { error: itemError } = await supabase.from("quote_items").insert({
    quote_id: quote.id,
    item_type: "PLAN",
    reference_id: selectedPlanId,
    description: selectedPlanName || "Requested plan",
    quantity: 1,
    unit_price: quoteTotal,
    discount: 0,
    tax: 0,
    tax_rate: 0,
    line_total: quoteTotal,
  })
  if (itemError) {
    await supabase.from("quotes").delete().eq("id", quote.id)
    await supabase.from("partner_quote_requests").delete().eq("id", data.id)
    return { ok: false, error: "The request was received but its Finance quote could not be prepared" }
  }
  await recalculateQuote(quote.id)

  const { error: linkError } = await supabase
    .from("partner_quote_requests")
    .update({ quote_id: quote.id, updated_at: now() })
    .eq("id", data.id)
  if (linkError) {
    await supabase.from("quotes").delete().eq("id", quote.id)
    await supabase.from("partner_quote_requests").delete().eq("id", data.id)
    return { ok: false, error: "The request was received but could not be linked to Finance" }
  }

  await recordAudit(
    { actorType: "PARTNER", actorId: user.id },
    {
      action: AUDIT_ACTIONS.PARTNER_QUOTE_REQUEST_CREATED,
      entityType: AUDIT_ENTITIES.PARTNER_QUOTE_REQUEST,
      entityId: data.id as string,
      metadata: { partnerId, partnerLeadId: input.partnerLeadId, requestedByName: user.name },
    }
  )

  await notifyAllAdmins({
    type: "PARTNER_QUOTE_REQUEST_SUBMITTED",
    title: "New partner quote request",
    message: `${selectedPlanName || "Quote request"} · partner ${partnerId} · lead ${input.partnerLeadId}`,
    deep_link: "/admin/partners/quotes?tab=requests",
    source_type: "partner_quote_request",
    source_id: data.id as string,
    roles: ["Admin", "Sales", "Finance"],
    email: {
      route: "partner_quote_request",
      subject: `New Partner Quote Request — ${selectedPlanName || "Review required"}`,
      text: `A partner has submitted a quote request that needs review.

Partner: ${partnerId}
Opportunity: ${input.partnerLeadId}
Plan: ${selectedPlanName || "Not specified"}
Due date: ${input.dueDate || "Not specified"}

Open Partner Quotes in the Admin Portal:
/admin/partners/quotes`,
      replyTo: REPLY_TO.partners,
    },
  })
  return { ok: true, request: { ...data, quote_id: quote.id, quote_number: quote.quote_number } }
}

export async function listPartnerQuoteRequests(partnerId: string): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("partner_quote_requests")
    .select("*, partner_leads(business_name, contact_name, status), quotes:quote_id(status)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
  return (data || []).map((request) => {
    const value = request.quotes as { status?: string } | { status?: string }[] | null
    const quote = Array.isArray(value) ? value[0] : value
    return request.status === "ISSUED" && quote?.status === "DRAFT"
      ? { ...request, status: "UNDER_REVIEW", decision_reason: "Your quote is being revised. We will notify you when it is ready." }
      : request
  }) as Record<string, unknown>[]
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
  const quoteId = typeof request.quote_id === "string" ? request.quote_id.trim() : ""
  if (!quoteId && !ref) return { request: request as Record<string, unknown>, lead, quote: null }

  const quoteQuery = supabase.from("quotes").select("*, quote_items(*)")
  const { data: quote } = quoteId
    ? await quoteQuery.eq("id", quoteId).maybeSingle()
    : await quoteQuery.eq("quote_number", ref).maybeSingle()

  // An admin may issue an older quote that has no partner linkage. If linkage
  // exists, it must still point to this partner/request before it is exposed.
  if (quote && (
    (quote.partner_id && quote.partner_id !== partnerId) ||
    (quote.partner_lead_id && quote.partner_lead_id !== request.partner_lead_id)
  )) {
    return { request: request as Record<string, unknown>, lead, quote: null }
  }

  // Draft terms are working documents, including withdrawn issued quotes.
  // Existing email links must not expose changes before Finance reissues them.
  if (quote?.status === "DRAFT") {
    return { request: { ...request, status: "UNDER_REVIEW" }, lead, quote: null }
  }

  let accountNumber = ""
  let invoice: Record<string, unknown> | null = null
  if (quote) {
    const { data: settings } = await supabase.from("settings").select("data").eq("id", 1).maybeSingle()
    const settingsData = (settings?.data as Record<string, unknown> | null) || null
    const general = (settingsData?.general as Record<string, unknown> | null) || null
    accountNumber = typeof general?.accountNumber === "string" ? general.accountNumber : ""
    const { data: invoiceRow } = await supabase
      .from("invoices")
      .select("id, invoice_number, status, total_amount, currency, due_date, invoice_email_sent_at")
      .eq("quote_id", quote.id)
      .maybeSingle()
    invoice = (invoiceRow as Record<string, unknown> | null) || null
  }

  return {
    request: request as Record<string, unknown>,
    lead,
    quote: quote ? { ...(quote as Record<string, unknown>), account_number: accountNumber, invoice } : null,
  }
}

export async function listQuoteRequestsForAdmin(partnerId?: string): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase
    .from("partner_quote_requests")
    .select("*, partners(business_name, partner_id), partner_leads(business_name, contact_name, email, phone, industry, business_type, city, state, status), quotes:quote_id(id, quote_number, status, total_amount, currency, quote_origin)")
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
  const { data: qr } = await supabase.from("partner_quote_requests").select("*").eq("id", quoteRequestId).single()
  if (!qr) return { ok: false, error: "Quote request not found" }
  if (!["SUBMITTED", "UNDER_REVIEW"].includes(qr.status as string)) {
    return { ok: false, error: "Quote request already decided" }
  }

  if (decision === "ISSUED" && !opts.issuedQuoteRef?.trim() && !qr.quote_id) {
    return { ok: false, error: "Create the Finance quote first, then issue it from the Quotes workspace" }
  }

  let issuedQuoteRef = opts.issuedQuoteRef?.trim() || null
  if (decision === "ISSUED") {
    const quoteQuery = supabase.from("quotes").select("id, quote_number, status, partner_id, partner_lead_id")
    const { data: quote } = qr.quote_id
      ? await quoteQuery.eq("id", qr.quote_id).maybeSingle()
      : await quoteQuery.eq("quote_number", opts.issuedQuoteRef!.trim()).maybeSingle()
    if (!quote) return { ok: false, error: "Create the Finance quote first, then enter its quote number here" }
    if (quote.partner_id && quote.partner_id !== qr.partner_id) return { ok: false, error: "That quote belongs to another partner" }
    if (quote.partner_lead_id && quote.partner_lead_id !== qr.partner_lead_id) return { ok: false, error: "That quote is linked to another opportunity" }
    if (["DECLINED", "EXPIRED", "CONVERTED"].includes(quote.status as string)) {
      return { ok: false, error: `The Finance quote is already ${String(quote.status).toLowerCase()}` }
    }
    issuedQuoteRef = quote.quote_number as string
    if (quote.status === "DRAFT") {
      await supabase.from("quotes").update({ status: "SENT", updated_at: now() }).eq("id", quote.id)
    }
  } else if (decision === "DECLINED" && qr.quote_id) {
    await supabase
      .from("quotes")
      .update({ status: "DECLINED", updated_at: now() })
      .eq("id", qr.quote_id)
      .in("status", ["DRAFT", "SENT"])
  }

  const { error } = await supabase
    .from("partner_quote_requests")
    .update({
      status: decision,
      issued_quote_ref: decision === "ISSUED" ? issuedQuoteRef : null,
      decided_by: decidedBy,
      decided_at: now(),
      decision_reason: opts.decisionReason ?? null,
      updated_at: now(),
    })
    .eq("id", quoteRequestId)
  if (error) return { ok: false, error: "Failed to record decision" }

  if (decision === "ISSUED" && qr.quote_id) {
    const { data: issuedQuote } = await supabase
      .from("quotes")
      .select("quote_number, total_amount, currency")
      .eq("id", qr.quote_id)
      .maybeSingle()
    if (issuedQuote) {
      await notifyPartnerQuoteIssued(qr.partner_id as string, {
        quoteNumber: issuedQuote.quote_number as string,
        total: Number(issuedQuote.total_amount) || 0,
        currency: (issuedQuote.currency as string) || "NGN",
        link: "/partner/quotes",
      }).catch((notifyError) => console.error("[partner quote] issue email", notifyError))
    }
  }

  if (decision === "DECLINED" || decision === "UNDER_REVIEW") {
    const { data: partnerLead } = await supabase
      .from("partner_leads")
      .select("business_name")
      .eq("id", qr.partner_lead_id)
      .maybeSingle()
    await notifyPartnerCustomerEvent(qr.partner_id as string, {
      subject: decision === "DECLINED" ? "Quote request declined" : "Quote request under review",
      title: decision === "DECLINED" ? "Quote request declined" : "Quote request under review",
      businessName: String(partnerLead?.business_name || "Partner opportunity"),
      body:
        decision === "DECLINED"
          ? (opts.decisionReason?.trim() || "MartPoint Finance has declined this quote request. Please contact the team if you need clarification.")
          : "MartPoint Finance is reviewing this quote request. We will update you when the commercial quote is ready.",
      link: "/partner/quotes",
    }).catch((notifyError) => console.error("[partner quote] decision notification", notifyError))
  }

  await notifyAllAdmins({
    type: `PARTNER_QUOTE_REQUEST_${decision}`,
    title: `Partner quote request ${decision === "UNDER_REVIEW" ? "under review" : decision.toLowerCase()}`,
    message: `Partner ${qr.partner_id} · opportunity ${qr.partner_lead_id}`,
    deep_link: decision === "ISSUED" ? "/admin/partners/quotes?tab=issued" : "/admin/partners/quotes?tab=requests",
    source_type: "partner_quote_request",
    source_id: quoteRequestId,
    exclude_admin_user_id: decidedBy,
    roles: ["Admin", "Sales", "Finance"],
  })

  await recordAudit(
    { actorType: "ADMIN", actorId: decidedBy },
    {
      action: AUDIT_ACTIONS.PARTNER_QUOTE_REQUEST_DECIDED,
      entityType: AUDIT_ENTITIES.PARTNER_QUOTE_REQUEST,
      entityId: quoteRequestId,
      metadata: { partnerId: qr.partner_id, partnerLeadId: qr.partner_lead_id, decision, issuedQuoteRef, quoteId: qr.quote_id || null },
    }
  )
  return { ok: true }
}
