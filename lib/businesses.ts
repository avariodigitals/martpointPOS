import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"

/* ───────────────────────────  Canonical Businesses  ───────────────────────────
 * A business is a real MartPoint customer/tenant. Leads remain sales history.
 * Conversion is controlled and idempotent — a lead can only be converted once.
 */

export type BusinessStatus =
  | "PROSPECT" | "ONBOARDING" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "CHURNED"

export type BusinessSource =
  | "DIRECT" | "PARTNER" | "REFERRAL" | "WEBSITE" | "SOCIAL" | "CAMPAIGN" | "OTHER"

export interface Business {
  id: string
  businessName: string
  legalName: string | null
  primaryContactName: string
  primaryEmail: string
  primaryPhone: string
  businessType: string
  industry: string
  country: string
  state: string
  city: string
  address: string
  website: string | null
  status: BusinessStatus
  source: BusinessSource
  sourceLeadId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface LeadRow {
  id: string
  full_name: string
  business_name: string
  email: string
  phone: string
  business_type: string
  product_interest: string
  source: string
  status: string
}

function mapBusiness(row: Record<string, unknown>): Business {
  return {
    id: row.id as string,
    businessName: row.business_name as string,
    legalName: (row.legal_name as string) ?? null,
    primaryContactName: row.primary_contact_name as string,
    primaryEmail: row.primary_email as string,
    primaryPhone: row.primary_phone as string,
    businessType: (row.business_type as string) ?? "",
    industry: (row.industry as string) ?? "",
    country: (row.country as string) ?? "",
    state: (row.state as string) ?? "",
    city: (row.city as string) ?? "",
    address: (row.address as string) ?? "",
    website: (row.website as string) ?? null,
    status: row.status as BusinessStatus,
    source: row.source as BusinessSource,
    sourceLeadId: (row.source_lead_id as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

/** Map a lead source string to a canonical BusinessSource. */
function normalizeSource(source: string): BusinessSource {
  const s = (source || "").toUpperCase()
  if (["DIRECT", "PARTNER", "REFERRAL", "WEBSITE", "SOCIAL", "CAMPAIGN", "OTHER"].includes(s)) {
    return s as BusinessSource
  }
  // Common lead sources like "website", "manual", "referral" etc.
  if (s === "MANUAL") return "DIRECT"
  return "OTHER"
}

export interface ConversionResult {
  ok: boolean
  business?: Business
  error?: string
  alreadyExists?: boolean
}

/**
 * Convert a Won lead into a canonical business. Idempotent: if a business already
 * exists for this lead, returns it without creating a duplicate. Does NOT delete
 * the lead. Records a BUSINESS_CREATED audit event.
 */
export async function convertLeadToBusiness(
  leadId: string,
  actor: AuditContext,
  overrides?: Partial<{
    legalName: string
    industry: string
    country: string
    state: string
    city: string
    address: string
    website: string
    status: BusinessStatus
  }>
): Promise<ConversionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Database not configured" }
  }

  // 1. Check for an existing business linked to this lead.
  const { data: existing } = await supabase
    .from("businesses")
    .select("*")
    .eq("source_lead_id", leadId)
    .maybeSingle()
  if (existing) {
    return { ok: true, alreadyExists: true, business: mapBusiness(existing) }
  }

  // 2. Load the lead.
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single()
  if (leadErr || !lead) {
    return { ok: false, error: "Lead not found" }
  }
  if ((lead as LeadRow).status !== "Won") {
    return { ok: false, error: "Only Won leads can be converted to a business" }
  }

  // 3. Detect possible duplicate by email + business name (warn, do not block).
  const { data: dup } = await supabase
    .from("businesses")
    .select("id, business_name, primary_email")
    .eq("primary_email", (lead as LeadRow).email)
    .maybeSingle()

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const row = lead as LeadRow
  const insert = {
    id,
    business_name: row.business_name,
    legal_name: overrides?.legalName ?? null,
    primary_contact_name: row.full_name,
    primary_email: row.email,
    primary_phone: row.phone,
    business_type: row.business_type,
    industry: overrides?.industry ?? "",
    country: overrides?.country ?? "",
    state: overrides?.state ?? "",
    city: overrides?.city ?? "",
    address: overrides?.address ?? "",
    website: overrides?.website ?? null,
    status: overrides?.status ?? "ONBOARDING",
    source: normalizeSource(row.source),
    source_lead_id: row.id,
    created_by: actor.actorId ?? null,
    created_at: now,
    updated_at: now,
  }

  const { data: created, error } = await supabase
    .from("businesses")
    .insert(insert)
    .select()
    .single()
  if (error || !created) {
    return { ok: false, error: "Failed to create business" }
  }

  const business = mapBusiness(created)
  await recordAudit(actor, {
    action: AUDIT_ACTIONS.BUSINESS_CREATED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: business.id,
    metadata: {
      leadId: row.id,
      businessName: business.businessName,
      duplicateWarning: dup ? { id: dup.id, businessName: dup.business_name } : null,
    },
  })

  return { ok: true, business }
}

/** Fetch a single business by id. */
export async function getBusinessById(id: string): Promise<Business | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.from("businesses").select("*").eq("id", id).single()
  return data ? mapBusiness(data) : null
}

/** List all businesses, newest first. */
export async function listBusinesses(): Promise<Business[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false })
  return (data || []).map(mapBusiness)
}

/** Search businesses by name, email or contact for assignment selection. */
export async function searchBusinesses(query: string): Promise<Business[]> {
  if (!isSupabaseConfigured() || !query.trim()) return []
  const q = `%${query.trim()}%`
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .or(`business_name.ilike.${q},primary_email.ilike.${q},primary_contact_name.ilike.${q}`)
    .order("created_at", { ascending: false })
    .limit(20)
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(mapBusiness)
}

/** Update editable business fields. Records a BUSINESS_UPDATED audit event. */
export async function updateBusiness(
  id: string,
  updates: Partial<Omit<Business, "id" | "createdAt" | "updatedAt" | "sourceLeadId">>,
  actor: AuditContext
): Promise<Business | null> {
  if (!isSupabaseConfigured()) return null
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.businessName !== undefined) updateData.business_name = updates.businessName
  if (updates.legalName !== undefined) updateData.legal_name = updates.legalName
  if (updates.primaryContactName !== undefined) updateData.primary_contact_name = updates.primaryContactName
  if (updates.primaryEmail !== undefined) updateData.primary_email = updates.primaryEmail
  if (updates.primaryPhone !== undefined) updateData.primary_phone = updates.primaryPhone
  if (updates.businessType !== undefined) updateData.business_type = updates.businessType
  if (updates.industry !== undefined) updateData.industry = updates.industry
  if (updates.country !== undefined) updateData.country = updates.country
  if (updates.state !== undefined) updateData.state = updates.state
  if (updates.city !== undefined) updateData.city = updates.city
  if (updates.address !== undefined) updateData.address = updates.address
  if (updates.website !== undefined) updateData.website = updates.website
  if (updates.status !== undefined) updateData.status = updates.status
  if (updates.source !== undefined) updateData.source = updates.source

  const { data, error } = await supabase
    .from("businesses")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()
  if (error || !data) return null

  const business = mapBusiness(data)
  await recordAudit(actor, {
    action: AUDIT_ACTIONS.BUSINESS_UPDATED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: id,
    metadata: { updatedFields: Object.keys(updateData).filter((k) => k !== "updated_at") },
  })
  return business
}
