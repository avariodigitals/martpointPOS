import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import { canPartnerAccessBusiness, type PartnerUserRecord } from "./partner-auth"
import type { Business } from "./businesses"

export type AssignmentRelationship = "REFERRED" | "SOLD" | "IMPLEMENTATION" | "SUPPORT" | "ACCOUNT_MANAGER"
export type AccessLevel = "VIEW_ONLY" | "SALES" | "ONBOARDING_MANAGER" | "SUPPORT"

export interface PartnerCustomerRecord {
  id: string
  partnerId: string
  businessId: string
  relationship: AssignmentRelationship
  accessLevel: AccessLevel
  status: "ACTIVE" | "EXPIRED" | "REVOKED"
  startsAt: string | null
  expiresAt: string | null
  business: Business
}

export interface CustomerDetail {
  business: Business
  assignment: PartnerCustomerRecord
  deployment: Record<string, unknown> | null
  entitlement: Record<string, unknown> | null
}

export async function listPartnerCustomers(partnerId: string): Promise<PartnerCustomerRecord[]> {
  if (!isSupabaseConfigured()) return []
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("partner_customer_assignments")
    .select("*, businesses(*)")
    .eq("partner_id", partnerId)
    .eq("status", "ACTIVE")
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(mapAssignment)
}

export async function getPartnerCustomerDetail(
  partnerId: string,
  businessId: string,
  partnerUser: PartnerUserRecord,
  requiredAccessLevel?: AccessLevel,
  ctx?: AuditContext
): Promise<{ ok: true; detail: CustomerDetail } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const access = await canPartnerAccessBusiness(partnerId, businessId, {
    partnerUserId: partnerUser.id,
    userPermission: requiredAccessLevel === "ONBOARDING_MANAGER" ? "onboarding:manage_assigned" : "customers:view_assigned",
    orgCapability: "CUSTOMER_ONBOARDING",
    requiredAccessLevel,
  })

  if (!access.allowed) return { ok: false, error: "Access denied" }

  const { data, error } = await supabase
    .from("partner_customer_assignments")
    .select("*, businesses(*)")
    .eq("partner_id", partnerId)
    .eq("business_id", businessId)
    .eq("status", "ACTIVE")
    .maybeSingle()

  if (error || !data) return { ok: false, error: "Customer not found" }

  const mapped = mapAssignment(data)
  const [deployment, entitlement] = await Promise.all([
    getBusinessDeployment(mapped.businessId),
    getBusinessEntitlement(mapped.businessId),
  ])

  if (ctx) {
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.PARTNER_CUSTOMER_VIEWED,
      entityType: AUDIT_ENTITIES.BUSINESS,
      entityId: mapped.businessId,
      metadata: { partnerId, partnerUserId: partnerUser.id, accessLevel: mapped.accessLevel },
    })
  }

  return { ok: true, detail: { business: mapped.business, assignment: mapped, deployment, entitlement } }
}

export async function createCustomerAssignment(
  input: {
    partnerId: string
    businessId: string
    relationship: AssignmentRelationship
    accessLevel: AccessLevel
    assignedBy: string
    startsAt?: string | null
    expiresAt?: string | null
    notes?: string
  },
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string; assignment?: Record<string, unknown> }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: existing } = await supabase
    .from("partner_customer_assignments")
    .select("id")
    .eq("partner_id", input.partnerId)
    .eq("business_id", input.businessId)
    .eq("status", "ACTIVE")
    .maybeSingle()

  if (existing) return { ok: false, error: "An active assignment already exists" }

  const { data, error } = await supabase
    .from("partner_customer_assignments")
    .insert({
      partner_id: input.partnerId,
      business_id: input.businessId,
      relationship_type: input.relationship,
      access_level: input.accessLevel,
      assigned_by: input.assignedBy,
      starts_at: input.startsAt ?? null,
      expires_at: input.expiresAt ?? null,
      notes: input.notes ?? null,
      status: "ACTIVE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !data) {
    console.error("[partner-customers] create assignment failed:", error?.message)
    return { ok: false, error: "Failed to create assignment" }
  }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_CUSTOMER_ASSIGNED,
    entityType: AUDIT_ENTITIES.PARTNER_CUSTOMER_ASSIGNMENT,
    entityId: data.id as string,
    metadata: {
      partnerId: input.partnerId,
      businessId: input.businessId,
      relationship: input.relationship,
      accessLevel: input.accessLevel,
    },
  })

  return { ok: true, assignment: data }
}

export async function getBusinessEntitlement(businessId: string): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("business_entitlements")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle()
  if (error || !data) return null
  return data
}

export async function getBusinessDeployment(businessId: string): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("business_deployments")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle()
  if (error || !data) return null
  return data
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
    status: row.status as Business["status"],
    source: row.source as Business["source"],
    sourceLeadId: (row.source_lead_id as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapAssignment(row: Record<string, unknown>): PartnerCustomerRecord {
  const businessRow = (row.businesses as Record<string, unknown>) || {}
  return {
    id: row.id as string,
    partnerId: row.partner_id as string,
    businessId: row.business_id as string,
    relationship: row.relationship_type as AssignmentRelationship,
    accessLevel: row.access_level as AccessLevel,
    status: row.status as "ACTIVE" | "EXPIRED" | "REVOKED",
    startsAt: (row.starts_at as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    business: mapBusiness(businessRow),
  }
}
