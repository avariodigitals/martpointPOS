import crypto from "node:crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import { partnerHasCapability } from "./partner-auth"
import { notifyAllAdmins } from "./admin-notifications"
import { notifyPartnerLeadUpdated } from "./partner-notifications"
import { REPLY_TO } from "./email"

export type PartnerLeadStatus =
  | "REGISTERED"
  | "UNDER_REVIEW"
  | "QUALIFIED"
  | "DEMO"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST"
  | "EXPIRED"

export type ProtectionStatus = "PENDING" | "PROTECTED" | "REJECTED" | "EXPIRED"

/** Partners allowed to register leads: sales/referral partners, plus implementation
 * partners who bring in the clients they install for. */
export async function partnerCanRegisterLeads(partnerId: string): Promise<boolean> {
  const capabilities = await Promise.all(
    (["SALES", "REFERRALS", "IMPLEMENTATION", "CUSTOMER_ONBOARDING"] as const).map((c) =>
      partnerHasCapability(partnerId, c)
    )
  )
  return capabilities.some(Boolean)
}

export interface PartnerLeadInput {
  businessName: string
  contactName: string
  phone: string
  email: string
  country: string
  state: string
  city: string
  industry: string
  businessType: string
  estimatedBranches?: number | null
  estimatedUsers?: number | null
  interestedProduct: string
  estimatedDealValue?: number | null
  notes?: string | null
}

export interface PartnerLeadRecord {
  id: string
  partnerId: string | null
  submittedByPartnerUserId: string | null
  businessName: string
  contactName: string
  phone: string | null
  email: string | null
  country: string
  state: string
  city: string
  industry: string
  businessType: string
  estimatedBranches: number | null
  estimatedUsers: number | null
  interestedProduct: string
  estimatedDealValue: number | null
  notes: string | null
  status: PartnerLeadStatus
  protectionStatus: ProtectionStatus
  protectionExpiresAt: string | null
  matchedLeadId: string | null
  matchedBusinessId: string | null
  invitedAt: string | null
  createdAt: string
  updatedAt: string
}

function now() {
  return new Date().toISOString()
}

function normalisePhone(phone: string): string {
  return (phone || "").replace(/[^\d]/g, "")
}

function normaliseEmail(email: string): string {
  return (email || "").trim().toLowerCase()
}

function normaliseBusinessName(name: string): string {
  return (name || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")
}

const PARTNER_LEAD_TERMINAL_STATUSES = ["LOST", "EXPIRED", "WON"]
const LEAD_IDENTITY_FIELDS = ["businessName", "contactName", "phone", "email", "country", "state", "city"] as const

function toDbKey(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

function formatLeadField(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase())
}

/** An issued/sent quote is a commercial snapshot. Lead identity may still be
 * corrected, but changing the lead must never silently change quote totals,
 * tax, bank details, payment terms or line items. */
async function isPartnerLeadCommerciallyLocked(leadId: string): Promise<boolean> {
  const { data: request } = await supabase
    .from("partner_quote_requests")
    .select("status, quote_id")
    .eq("partner_lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (String(request?.status || "") === "ISSUED") return true
  if (!request?.quote_id) return false

  const { data: quote } = await supabase.from("quotes").select("status").eq("id", request.quote_id).maybeSingle()
  return ["SENT", "ACCEPTED", "DECLINED", "EXPIRED", "CONVERTED"].includes(String(quote?.status || ""))
}

export async function getPartnerLeadEditPolicy(lead: Pick<PartnerLeadRecord, "id" | "status">): Promise<{
  canEdit: boolean
  commercialLocked: boolean
}> {
  return {
    canEdit: !PARTNER_LEAD_TERMINAL_STATUSES.includes(String(lead.status)),
    commercialLocked: await isPartnerLeadCommerciallyLocked(lead.id),
  }
}

async function syncCanonicalLeadIdentity(lead: Record<string, unknown>, updates: Record<string, unknown>): Promise<void> {
  const matchedLeadId = typeof lead.matched_lead_id === "string" ? lead.matched_lead_id : null
  const canonical: Record<string, unknown> = { updated_at: now() }
  if (updates.business_name !== undefined) canonical.business_name = updates.business_name
  if (updates.contact_name !== undefined) canonical.full_name = updates.contact_name
  if (updates.phone !== undefined) canonical.phone = updates.phone
  if (updates.email !== undefined) canonical.email = updates.email
  if (updates.industry !== undefined) canonical.industry = updates.industry
  if (updates.business_type !== undefined) canonical.business_type = updates.business_type
  if (matchedLeadId && Object.keys(canonical).length > 1) {
    const { error } = await supabase.from("leads").update(canonical).eq("id", matchedLeadId)
    if (error) console.error("[partner-leads] canonical lead sync failed:", error.message)
  }

  // If the opportunity has already been converted, keep the customer master
  // record aligned with the corrected lead identity too. This does not touch
  // invoices, quote totals, payment terms or any other commercial snapshot.
  const businessUpdate: Record<string, unknown> = { updated_at: now() }
  if (updates.business_name !== undefined) businessUpdate.business_name = updates.business_name
  if (updates.contact_name !== undefined) businessUpdate.primary_contact_name = updates.contact_name
  if (updates.phone !== undefined) businessUpdate.primary_phone = updates.phone
  if (updates.email !== undefined) businessUpdate.primary_email = updates.email
  if (updates.country !== undefined) businessUpdate.country = updates.country
  if (updates.state !== undefined) businessUpdate.state = updates.state
  if (updates.city !== undefined) businessUpdate.city = updates.city
  if (updates.industry !== undefined) businessUpdate.industry = updates.industry
  if (updates.business_type !== undefined) businessUpdate.business_type = updates.business_type
  if (Object.keys(businessUpdate).length === 1) return

  const { error: businessError } = await supabase
    .from("businesses")
    .update(businessUpdate)
    .eq("partner_lead_id", lead.id)
  if (businessError) console.error("[partner-leads] converted business sync failed:", businessError.message)
}

export interface LeadDuplicateCheck {
  possibleDuplicate: boolean
  matchedBusinessId: string | null
  matchedLeadId: string | null
  matchedPartnerLeadId: string | null
  message: string
}

export async function checkLeadDuplicate(input: {
  businessName: string
  phone: string
  email: string
}): Promise<LeadDuplicateCheck> {
  if (!isSupabaseConfigured()) return { possibleDuplicate: false, matchedBusinessId: null, matchedLeadId: null, matchedPartnerLeadId: null, message: "" }

  const phone = normalisePhone(input.phone)
  const email = normaliseEmail(input.email)
  const name = normaliseBusinessName(input.businessName)

  // Existing canonical business
  const { data: business } = await supabase
    .from("businesses")
    .select("id, business_name, primary_email, primary_phone")
    .or(`business_name.ilike.${name},primary_email.ilike.${email},primary_phone.ilike.${phone}`)
    .limit(1)
    .maybeSingle()

  if (business) {
    return {
      possibleDuplicate: true,
      matchedBusinessId: business.id as string,
      matchedLeadId: null,
      matchedPartnerLeadId: null,
      message: "This business may already exist in the MartPoint pipeline. Our team will review the registration.",
    }
  }

  // Existing lead (CRM leads table)
  const { data: lead } = await supabase
    .from("leads")
    .select("id, business_name, email, phone")
    .or(`business_name.ilike.${name},email.ilike.${email},phone.ilike.${phone}`)
    .limit(1)
    .maybeSingle()

  if (lead) {
    return {
      possibleDuplicate: true,
      matchedBusinessId: null,
      matchedLeadId: lead.id as string,
      matchedPartnerLeadId: null,
      message: "This business may already exist in the MartPoint pipeline. Our team will review the registration.",
    }
  }

  // Other partner lead
  const { data: pLead } = await supabase
    .from("partner_leads")
    .select("id, business_name, email, phone")
    .or(`business_name.ilike.${name},email.ilike.${email},phone.ilike.${phone}`)
    .limit(1)
    .maybeSingle()

  if (pLead) {
    return {
      possibleDuplicate: true,
      matchedBusinessId: null,
      matchedLeadId: null,
      matchedPartnerLeadId: pLead.id as string,
      message: "This business may already exist in the MartPoint pipeline. Our team will review the registration.",
    }
  }

  return {
    possibleDuplicate: false,
    matchedBusinessId: null,
    matchedLeadId: null,
    matchedPartnerLeadId: null,
    message: "",
  }
}

export async function getProtectionDays(): Promise<number> {
  if (!isSupabaseConfigured()) return 30
  const { data } = await supabase.from("partner_lead_settings").select("default_protection_days").single()
  return (data?.default_protection_days as number) ?? 30
}

export async function createPartnerLead(
  input: PartnerLeadInput,
  partnerId: string | null,
  submittedBy: string | null,
  ctx: AuditContext
): Promise<{ ok: true; lead: PartnerLeadRecord; warning: string | null } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const dup = await checkLeadDuplicate(input)

  const status: ProtectionStatus = dup.possibleDuplicate ? "PENDING" : "PROTECTED"
  const protectionExpiresAt = status === "PROTECTED" ? getFutureDate(await getProtectionDays()) : null

  const { data, error } = await supabase
    .from("partner_leads")
    .insert({
      partner_id: partnerId,
      submitted_by_partner_user_id: submittedBy,
      business_name: input.businessName.trim(),
      contact_name: input.contactName.trim(),
      phone: normalisePhone(input.phone),
      email: normaliseEmail(input.email),
      country: input.country,
      state: input.state,
      city: input.city,
      industry: input.industry,
      business_type: input.businessType,
      estimated_branches: input.estimatedBranches ?? null,
      estimated_users: input.estimatedUsers ?? null,
      interested_product: input.interestedProduct,
      estimated_deal_value: input.estimatedDealValue ?? null,
      notes: input.notes ?? null,
      status: "REGISTERED",
      protection_status: status,
      protection_expires_at: protectionExpiresAt,
      matched_lead_id: dup.matchedLeadId,
      matched_business_id: dup.matchedBusinessId,
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single()

  if (error || !data) {
    console.error("[partner-leads] create failed:", error?.message)
    return { ok: false, error: "Failed to register lead" }
  }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_LEAD_REGISTERED,
    entityType: AUDIT_ENTITIES.PARTNER_LEAD,
    entityId: data.id as string,
    metadata: {
      partnerId,
      businessName: input.businessName,
      protectionStatus: status,
      possibleDuplicate: dup.possibleDuplicate,
    },
  })

  if (partnerId) {
    await notifyAllAdmins({
      type: "PARTNER_LEAD_REGISTERED",
      title: "New partner opportunity",
      message: `${input.businessName} · ${input.contactName} · ${input.email}`,
      deep_link: "/admin/partners/leads",
      source_type: "partner_lead",
      source_id: data.id as string,
      roles: ["Admin", "Sales"],
      email: {
        route: "partner_lead_registration",
        subject: `New Partner Opportunity — ${input.businessName}`,
        text: `A partner has registered a new opportunity.

Business: ${input.businessName}
Contact: ${input.contactName}
Email: ${input.email}
Phone: ${input.phone}
Industry: ${input.industry}

Open Partner Leads in the Admin Portal:
/admin/partners/leads`,
        replyTo: REPLY_TO.partners,
      },
    })
  }

  return { ok: true, lead: mapLead(data), warning: dup.possibleDuplicate ? dup.message : null }
}

export async function listPartnerLeads(partnerId: string): Promise<PartnerLeadRecord[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("partner_leads")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(mapLead)
}

export async function getPartnerLeadById(id: string): Promise<PartnerLeadRecord | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase.from("partner_leads").select("*").eq("id", id).single()
  if (error || !data) return null
  return mapLead(data)
}

export async function getPartnerLeadByIdForPartner(
  id: string,
  partnerId: string,
  partnerUserId?: string
): Promise<PartnerLeadRecord | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("partner_leads")
    .select("*")
    .eq("id", id)
    .single()
  if (error || !data) return null

  const lead = mapLead(data)
  // partner_id is the canonical tenant boundary. The submitter fallback keeps
  // older leads readable when their partner_id was not populated consistently,
  // without allowing a user from another partner to open the record.
  if (lead.partnerId === partnerId || (partnerUserId && lead.submittedByPartnerUserId === partnerUserId)) {
    return lead
  }
  return null
}

export async function updatePartnerLead(
  id: string,
  partnerId: string,
  submittedBy: string,
  updates: Partial<PartnerLeadInput>,
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string; lead?: PartnerLeadRecord }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: current } = await supabase
    .from("partner_leads")
    .select("*")
    .eq("id", id)
    .or(`partner_id.eq.${partnerId},submitted_by_partner_user_id.eq.${submittedBy}`)
    .single()

  if (!current) return { ok: false, error: "Lead not found" }
  if (PARTNER_LEAD_TERMINAL_STATUSES.includes(String(current.status))) {
    return { ok: false, error: "This lead is closed and can no longer be edited by partner" }
  }

  const commercialLocked = await isPartnerLeadCommerciallyLocked(id)

  const updateData: Record<string, unknown> = { updated_at: now() }
  const allowed = [
    "businessName",
    "contactName",
    "phone",
    "email",
    "country",
    "state",
    "city",
    "industry",
    "businessType",
    "estimatedBranches",
    "estimatedUsers",
    "interestedProduct",
    "estimatedDealValue",
    "notes",
  ] as const

  const lockedFields = new Set<string>(LEAD_IDENTITY_FIELDS)

  for (const k of allowed) {
    if (updates[k] !== undefined) {
      if (commercialLocked && !lockedFields.has(k)) continue
      const dbKey = k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
      updateData[dbKey] =
        k === "phone" ? normalisePhone(updates[k] as string)
        : k === "email" ? normaliseEmail(updates[k] as string)
        : k === "businessName" ? (updates[k] as string).trim()
        : k === "contactName" ? (updates[k] as string).trim()
        : updates[k]
    }
  }

  const updatedFields = Object.keys(updateData).filter((k) => k !== "updated_at")
  if (updatedFields.length === 0) {
    return {
      ok: false,
      error: commercialLocked
        ? "This quote has been issued. Only customer identity and contact details can be corrected."
        : "No lead details were supplied",
    }
  }

  const { data, error } = await supabase
    .from("partner_leads")
    .update(updateData)
    .eq("id", id)
    .or(`partner_id.eq.${partnerId},submitted_by_partner_user_id.eq.${submittedBy}`)
    .select()
    .single()

  if (error || !data) return { ok: false, error: "Update failed" }

  await syncCanonicalLeadIdentity(current as Record<string, unknown>, updateData)

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_LEAD_UPDATED,
    entityType: AUDIT_ENTITIES.PARTNER_LEAD,
    entityId: id,
    metadata: { partnerId, submittedBy, updatedFields, commercialLocked, identityCorrection: commercialLocked },
  })

  if (commercialLocked && current.partner_id) {
    await Promise.all([
      notifyPartnerLeadUpdated(String(current.partner_id), {
        leadId: id,
        businessName: String(data.business_name || current.business_name || "Partner opportunity"),
        updatedFields: updatedFields.map((field) => formatLeadField(field.replace(/_([a-z])/g, (_, c) => String(c).toUpperCase()))),
      }).catch((error) => console.error("[partner-leads] partner correction notification failed", error)),
      notifyAllAdmins({
        type: "PARTNER_LEAD_DETAILS_UPDATED",
        title: "Partner lead details corrected",
        message: `${data.business_name || current.business_name} · ${updatedFields.join(", ")}`,
        deep_link: "/admin/partners/leads",
        source_type: "partner_lead",
        source_id: id,
        roles: ["Admin", "Sales", "Finance"],
      }),
    ])
  }

  return { ok: true, lead: mapLead(data) }
}

export interface AdminLeadDecision {
  status?: PartnerLeadStatus
  protectionStatus?: ProtectionStatus
  protectionDays?: number
  matchedLeadId?: string | null
  matchedBusinessId?: string | null
  notes?: string
  updates?: Partial<PartnerLeadInput>
}

export async function adminUpdateLead(
  leadId: string,
  decision: AdminLeadDecision,
  adminId: string,
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string; lead?: PartnerLeadRecord }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: current } = await supabase.from("partner_leads").select("*").eq("id", leadId).single()
  if (!current) return { ok: false, error: "Lead not found" }

  const updateData: Record<string, unknown> = { updated_at: now() }

  const commercialLocked = await isPartnerLeadCommerciallyLocked(leadId)
  const sourceUpdates = decision.updates || {}
  const editableFields = Object.keys(sourceUpdates) as (keyof PartnerLeadInput)[]
  for (const k of editableFields) {
    if (sourceUpdates[k] === undefined) continue
    if (commercialLocked && !(LEAD_IDENTITY_FIELDS as readonly string[]).includes(k)) continue
    updateData[toDbKey(k)] =
      k === "phone" ? normalisePhone(sourceUpdates[k] as string)
      : k === "email" ? normaliseEmail(sourceUpdates[k] as string)
      : ["businessName", "contactName"].includes(k) ? String(sourceUpdates[k]).trim()
      : sourceUpdates[k]
  }

  if (decision.status) {
    updateData.status = decision.status
  }

  if (decision.protectionStatus) {
    updateData.protection_status = decision.protectionStatus
    if (decision.protectionStatus === "PROTECTED") {
      const days = decision.protectionDays ?? (await getProtectionDays())
      updateData.protection_expires_at = getFutureDate(days)
    } else if (decision.protectionStatus === "EXPIRED" || decision.protectionStatus === "REJECTED") {
      updateData.protection_expires_at = null
    }
  }

  if (decision.matchedLeadId !== undefined) updateData.matched_lead_id = decision.matchedLeadId
  if (decision.matchedBusinessId !== undefined) updateData.matched_business_id = decision.matchedBusinessId

  const updatedFields = Object.keys(updateData).filter((k) => k !== "updated_at")
  if (updatedFields.length === 0 && Object.keys(decision).length === 1 && decision.updates) {
    return {
      ok: false,
      error: commercialLocked
        ? "This quote has been issued. Only customer identity and contact details can be corrected."
        : "No lead details were supplied",
    }
  }

  const { data, error } = await supabase
    .from("partner_leads")
    .update(updateData)
    .eq("id", leadId)
    .select()
    .single()

  if (error || !data) return { ok: false, error: "Update failed" }

  await syncCanonicalLeadIdentity(current as Record<string, unknown>, updateData)

  const action =
    decision.protectionStatus === "PROTECTED" ? AUDIT_ACTIONS.PARTNER_LEAD_PROTECTION_APPROVED
    : decision.protectionStatus === "REJECTED" ? AUDIT_ACTIONS.PARTNER_LEAD_PROTECTION_REJECTED
    : decision.protectionStatus === "EXPIRED" ? AUDIT_ACTIONS.PARTNER_LEAD_PROTECTION_EXPIRED
    : decision.status === "WON" ? AUDIT_ACTIONS.PARTNER_LEAD_WON
    : decision.status === "LOST" ? AUDIT_ACTIONS.PARTNER_LEAD_LOST
    : AUDIT_ACTIONS.PARTNER_LEAD_UPDATED

  await recordAudit(ctx, {
    action,
    entityType: AUDIT_ENTITIES.PARTNER_LEAD,
    entityId: leadId,
    metadata: { decision, adminId, commercialLocked, updatedFields },
  })

  if (updatedFields.some((field) => ["business_name", "contact_name", "phone", "email", "country", "state", "city", "industry", "business_type"].includes(field))) {
    const partnerId = String(data.partner_id || current.partner_id || "")
    await Promise.all([
      partnerId
        ? notifyPartnerLeadUpdated(partnerId, {
            leadId,
            businessName: String(data.business_name || current.business_name || "Partner opportunity"),
            updatedFields: updatedFields
              .filter((field) => field !== "status" && field !== "protection_status")
              .map((field) => formatLeadField(field.replace(/_([a-z])/g, (_, c) => String(c).toUpperCase()))),
          }).catch((error) => console.error("[partner-leads] partner correction notification failed", error))
        : Promise.resolve(),
      notifyAllAdmins({
        type: "PARTNER_LEAD_DETAILS_UPDATED",
        title: "Partner lead details corrected",
        message: `${data.business_name || current.business_name} · ${updatedFields.join(", ")}`,
        deep_link: "/admin/partners/leads",
        source_type: "partner_lead",
        source_id: leadId,
        exclude_admin_user_id: adminId,
        roles: ["Admin", "Sales", "Finance"],
      }),
    ])
  }

  return { ok: true, lead: mapLead(data) }
}

export async function extendProtection(
  leadId: string,
  days: number,
  adminId: string,
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const lead = await getPartnerLeadById(leadId)
  if (!lead) return { ok: false, error: "Lead not found" }

  const base = lead.protectionExpiresAt ? new Date(lead.protectionExpiresAt) : new Date()
  const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from("partner_leads")
    .update({ protection_expires_at: newExpiry, updated_at: now() })
    .eq("id", leadId)

  if (error) return { ok: false, error: "Extension failed" }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_LEAD_PROTECTION_EXTENDED,
    entityType: AUDIT_ENTITIES.PARTNER_LEAD,
    entityId: leadId,
    metadata: { days, newExpiry, adminId },
  })

  return { ok: true }
}

export async function convertPartnerLeadToBusiness(
  leadId: string,
  adminId: string,
  ctx: AuditContext,
  options?: { allowQuoteAccepted?: boolean }
): Promise<{ ok: boolean; error?: string; business?: Record<string, unknown> }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const lead = await getPartnerLeadById(leadId)
  if (!lead) return { ok: false, error: "Lead not found" }

  // A lead-backed quote is a controlled customer-conversion path. Once the
  // partner has accepted that quote, the quote itself authorises customer
  // setup even if the older partner-lead workflow has not yet reached WON.
  // Keep this idempotent so retrying the quote action cannot create a second
  // business for the same partner lead.
  const { data: existingBusiness } = await supabase
    .from("businesses")
    .select("*")
    .eq("partner_lead_id", leadId)
    .maybeSingle()
  if (existingBusiness) return { ok: true, business: existingBusiness as Record<string, unknown> }

  // Older partner conversions may have only stored the reverse pointer on the
  // lead. Reuse that business too, rather than creating a duplicate customer.
  const { data: leadLink } = await supabase
    .from("partner_leads")
    .select("converted_business_id")
    .eq("id", leadId)
    .maybeSingle()
  if (leadLink?.converted_business_id) {
    const { data: linkedBusiness } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", leadLink.converted_business_id)
      .maybeSingle()
    if (linkedBusiness) return { ok: true, business: linkedBusiness as Record<string, unknown> }
  }

  const { data: workflow } = await supabase
    .from("partner_leads")
    .select("referral_reference, status")
    .eq("id", leadId)
    .maybeSingle()
  const isReferral = Boolean((workflow as Record<string, unknown> | null)?.referral_reference)
  const workflowStatus = String((workflow as Record<string, unknown> | null)?.status || "")
  // A legacy lead converts once it is WON; a referral converts at acceptance or
  // qualification and lands in CONVERTED_UNPAID — no money has cleared yet, so
  // nothing about the commission clock starts here.
  const convertible = options?.allowQuoteAccepted === true || (isReferral
    ? ["ACCEPTED", "QUALIFIED"].includes(workflowStatus)
    : lead.status === "WON")
  if (!convertible) {
    return {
      ok: false,
      error: isReferral
        ? "Only an accepted or qualified referral can be converted to a customer"
        : "Lead must be WON before conversion",
    }
  }

  const id = crypto.randomUUID()
  const created = now()

  const insert = {
    id,
    business_name: lead.businessName,
    legal_name: null,
    primary_contact_name: lead.contactName,
    primary_email: lead.email,
    primary_phone: lead.phone,
    business_type: lead.businessType,
    industry: lead.industry,
    country: lead.country,
    state: lead.state,
    city: lead.city,
    address: "",
    website: null,
    status: "ONBOARDING",
    source: "PARTNER",
    source_lead_id: lead.matchedLeadId,
    originating_partner_id: lead.partnerId,
    partner_lead_id: lead.id,
    acquisition_source: "PARTNER",
    created_by: adminId,
    created_at: created,
    updated_at: created,
  }

  const { data, error } = await supabase.from("businesses").insert(insert).select().single()
  if (error || !data) {
    console.error("[partner-leads] conversion failed:", error?.message)
    return { ok: false, error: "Failed to create business" }
  }

  // Seed default entitlements and deployment tracking
  await supabase.from("business_entitlements").insert({
    business_id: id,
    plan_code: null,
    max_branches: 1,
    max_users: 1,
    online_store_enabled: false,
    implementation_enabled: true,
    subscription_status: "ACTIVE",
    effective_from: created,
    created_by: adminId,
    created_at: created,
    updated_at: created,
  })

  await supabase.from("business_deployments").insert({
    business_id: id,
    status: "PENDING",
    created_at: created,
    updated_at: created,
  })

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.BUSINESS_PARTNER_ATTRIBUTION_SET,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: id,
    metadata: { partnerId: lead.partnerId, partnerLeadId: lead.id, acquisitionSource: "PARTNER" },
  })

  await supabase.from("partner_leads").update({ converted_business_id: id, updated_at: created }).eq("id", leadId)

  if (isReferral) {
    const { transitionReferral } = await import("./referral")
    await transitionReferral(
      leadId,
      "CONVERTED_UNPAID",
      { actorType: "ADMIN", actorId: adminId, actorName: null },
      { reason: "Converted to a MartPoint customer — no eligible payment collected yet", metadata: { convertedBusinessId: id }, patch: { converted_business_id: id } }
    )
    const { emitReferralNotification } = await import("./referral-notifications")
    await emitReferralNotification({
      event: "REFERRAL_CONVERTED_TO_CUSTOMER",
      title: `Referral converted: ${lead.businessName}`,
      body: "The business is now a MartPoint customer. A commission is only created once an eligible payment clears, their licence is activated and the holding period completes.",
      partnerId: (lead.partnerId as string) || null,
      link: `/partner/referrals/${leadId}`,
      sourceType: "referral",
      sourceId: leadId,
      emailTo: null,
    })
  }

  return { ok: true, business: data }
}

export interface PartnerLeadWithPartner extends PartnerLeadRecord {
  partnerName: string | null
  partnerCode: string | null
}

export async function listAllPartnerLeads(
  filters: { status?: PartnerLeadStatus | null; protectionStatus?: ProtectionStatus | null } = {}
): Promise<PartnerLeadWithPartner[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase
    .from("partner_leads")
    .select("*, partners(business_name, partner_id)")
    .order("created_at", { ascending: false })
  if (filters.status) q = q.eq("status", filters.status)
  if (filters.protectionStatus) q = q.eq("protection_status", filters.protectionStatus)

  const { data, error } = await q
  if (error || !data) return []

  return (data as unknown as Array<Record<string, unknown> & { partners?: Record<string, unknown> }>).map((row) => {
    const partner = row.partners || {}
    return {
      ...mapLead(row),
      partnerName: (partner.business_name as string) ?? null,
      partnerCode: (partner.partner_id as string) ?? null,
    }
  })
}

function mapLead(row: Record<string, unknown>): PartnerLeadRecord {
  return {
    id: row.id as string,
    partnerId: (row.partner_id as string | null) ?? null,
    submittedByPartnerUserId: (row.submitted_by_partner_user_id as string | null) ?? null,
    businessName: row.business_name as string,
    contactName: row.contact_name as string,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    country: (row.country as string) || "",
    state: (row.state as string) || "",
    city: (row.city as string) || "",
    industry: (row.industry as string) || "",
    businessType: (row.business_type as string) || "",
    estimatedBranches: (row.estimated_branches as number | null) ?? null,
    estimatedUsers: (row.estimated_users as number | null) ?? null,
    interestedProduct: (row.interested_product as string) || "",
    estimatedDealValue: (row.estimated_deal_value as number | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    status: row.status as PartnerLeadStatus,
    protectionStatus: row.protection_status as ProtectionStatus,
    protectionExpiresAt: (row.protection_expires_at as string | null) ?? null,
    matchedLeadId: (row.matched_lead_id as string | null) ?? null,
    matchedBusinessId: (row.matched_business_id as string | null) ?? null,
    invitedAt: (row.invited_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function getFutureDate(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

/* ───────────────────────────  Partner application invites  ───────────────────────────
 * Admin invites a lead to complete the public partner application form.
 * The invite token prefills the form and links the submitted application
 * back to the lead (partner_applications.partner_lead_id).
 */

export async function createLeadInvite(
  leadId: string,
  ctx: AuditContext
): Promise<{ ok: true; token: string; lead: PartnerLeadRecord } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const lead = await getPartnerLeadById(leadId)
  if (!lead) return { ok: false, error: "Lead not found" }
  if (!lead.email) return { ok: false, error: "Lead has no email address" }
  if (lead.partnerId) {
    return { ok: false, error: "This is a customer referral owned by an existing partner, not a partner prospect" }
  }

  const token = crypto.randomBytes(24).toString("hex")

  const { data, error } = await supabase
    .from("partner_leads")
    .update({ invite_token: token, invited_at: now(), updated_at: now() })
    .eq("id", leadId)
    .select()
    .single()

  if (error || !data) return { ok: false, error: "Failed to create invite" }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_LEAD_UPDATED,
    entityType: AUDIT_ENTITIES.PARTNER_LEAD,
    entityId: leadId,
    metadata: { invite: "partner_application", email: lead.email },
  })

  return { ok: true, token, lead: mapLead(data) }
}

export async function getLeadByInviteToken(token: string): Promise<PartnerLeadRecord | null> {
  if (!isSupabaseConfigured() || !token) return null
  const { data, error } = await supabase
    .from("partner_leads")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle()
  if (error || !data) return null
  // Partner-owned leads are customer referrals, not partner prospects. This
  // also invalidates any old invite token that may have been issued before the
  // distinction was enforced in the admin UI.
  if (data.partner_id) return null
  return mapLead(data)
}
