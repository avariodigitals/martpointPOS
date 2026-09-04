import crypto from "node:crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import type { PartnerUserRecord } from "./partner-auth"

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
  partnerId: string
  submittedByPartnerUserId: string
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
  partnerId: string,
  submittedBy: string,
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
  partnerId: string
): Promise<PartnerLeadRecord | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("partner_leads")
    .select("*")
    .eq("id", id)
    .eq("partner_id", partnerId)
    .single()
  if (error || !data) return null
  return mapLead(data)
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
    .eq("partner_id", partnerId)
    .single()

  if (!current) return { ok: false, error: "Lead not found" }
  if (!["REGISTERED", "UNDER_REVIEW"].includes(current.status as string)) {
    return { ok: false, error: "Lead can no longer be edited by partner" }
  }

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

  for (const k of allowed) {
    if (updates[k] !== undefined) {
      const dbKey = k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
      updateData[dbKey] =
        k === "phone" ? normalisePhone(updates[k] as string)
        : k === "email" ? normaliseEmail(updates[k] as string)
        : k === "businessName" ? (updates[k] as string).trim()
        : k === "contactName" ? (updates[k] as string).trim()
        : updates[k]
    }
  }

  const { data, error } = await supabase
    .from("partner_leads")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error || !data) return { ok: false, error: "Update failed" }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_LEAD_UPDATED,
    entityType: AUDIT_ENTITIES.PARTNER_LEAD,
    entityId: id,
    metadata: { partnerId, submittedBy, updatedFields: Object.keys(updateData).filter((k) => k !== "updated_at") },
  })

  return { ok: true, lead: mapLead(data) }
}

export interface AdminLeadDecision {
  status?: PartnerLeadStatus
  protectionStatus?: ProtectionStatus
  protectionDays?: number
  matchedLeadId?: string | null
  matchedBusinessId?: string | null
  notes?: string
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

  const { data, error } = await supabase
    .from("partner_leads")
    .update(updateData)
    .eq("id", leadId)
    .select()
    .single()

  if (error || !data) return { ok: false, error: "Update failed" }

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
    metadata: { decision, adminId },
  })

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
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string; business?: Record<string, unknown> }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const lead = await getPartnerLeadById(leadId)
  if (!lead) return { ok: false, error: "Lead not found" }
  if (lead.status !== "WON") return { ok: false, error: "Lead must be WON before conversion" }

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
    partnerId: row.partner_id as string,
    submittedByPartnerUserId: row.submitted_by_partner_user_id as string,
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
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function getFutureDate(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}
