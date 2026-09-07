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
  onboardingStages: OnboardingStages
  onboardingOwner: string | null
  onboardingHealth: "On Track" | "At Risk" | "Blocked"
  onboardingWaitingOn: "None" | "Customer" | "MartPoint" | "Partner"
  blockerReason: string | null
  blockerSince: string | null
  targetGoLive: string | null
  onboardingStartedAt: string | null
  onboardingProgress: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/* ── Onboarding Kanban stages ──
 * Customer journey to becoming operational. Stored as a JSONB map on
 * businesses.onboarding_stages: { STAGE_KEY: { completedAt, completedBy, ... } }
 */
export const ONBOARDING_STAGES = [
  { key: "INTAKE_RECEIVED", label: "Intake Received" },
  { key: "SETUP_REVIEW", label: "Setup Review" },
  { key: "AWAITING_PAYMENT", label: "Awaiting Payment" },
  { key: "PROVISIONING", label: "Provisioning" },
  { key: "BUSINESS_SETUP", label: "Business Setup" },
  { key: "READY_FOR_TRAINING", label: "Ready for Training" },
  { key: "TRAINING_IN_PROGRESS", label: "Training in Progress" },
  { key: "ONBOARDING_COMPLETE", label: "Onboarding Complete" },
] as const

export type OnboardingStageKey = (typeof ONBOARDING_STAGES)[number]["key"]

export interface OnboardingStageProgress {
  completedAt: string
  completedBy: string | null
  approved?: boolean
  needsClarification?: boolean
}

export interface SetupReviewData {
  businessProfileConfirmed: boolean
  planAppropriate: boolean
  branchRequirementConfirmed: boolean
  userRequirementConfirmed: boolean
  productRequirementConfirmed: boolean
  addonsConfirmed: boolean
  hardwareRequirementsExplained: boolean
  onlineStoreConfirmed: boolean
  specialRequirementsReviewed: boolean
  deploymentApproachConfirmed: boolean
  trainingApproachConfirmed: boolean
}

export type OnboardingStages = Partial<Record<OnboardingStageKey, OnboardingStageProgress>>

export interface BusinessBranch {
  id: string
  businessId: string
  name: string
  address: string
  city: string
  state: string
  country: string
  phone: string
  isHeadquarters: boolean
  status: "ACTIVE" | "INACTIVE"
  createdAt: string
}

export interface BusinessUser {
  id: string
  businessId: string
  fullName: string
  email: string
  phone: string
  role: "OWNER" | "MANAGER" | "CASHIER" | "STAFF" | "ACCOUNTANT"
  branchId: string | null
  status: "INVITED" | "ACTIVE" | "SUSPENDED"
  createdAt: string
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
    onboardingStages: (row.onboarding_stages as OnboardingStages) ?? {},
    onboardingOwner: (row.onboarding_owner as string) ?? null,
    onboardingHealth: (row.onboarding_health as Business["onboardingHealth"]) ?? "On Track",
    onboardingWaitingOn: (row.onboarding_waiting_on as Business["onboardingWaitingOn"]) ?? "None",
    blockerReason: (row.blocker_reason as string) ?? null,
    blockerSince: (row.blocker_since as string) ?? null,
    targetGoLive: (row.target_go_live as string | null) ? String(row.target_go_live) : null,
    onboardingStartedAt: (row.onboarding_started_at as string) ?? null,
    onboardingProgress: Number(row.onboarding_progress ?? 0),
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
    businessName: string
    legalName: string
    primaryContactName: string
    primaryEmail: string
    primaryPhone: string
    businessType: string
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

  // 2. Load the lead with questionnaire responses.
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("*, questionnaire_responses, questionnaire_fields")
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

  const responses = (lead as LeadRow & { questionnaire_responses?: Record<string, unknown> }).questionnaire_responses || {}
  const fields = (lead as LeadRow & { questionnaire_fields?: unknown[] }).questionnaire_fields || []

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const row = lead as LeadRow
  const insert = {
    id,
    business_name: overrides?.businessName ?? (responses.businessName as string) ?? row.business_name,
    legal_name: overrides?.legalName ?? (responses.legalName as string) ?? null,
    primary_contact_name: overrides?.primaryContactName ?? (responses.contactPerson as string) ?? row.full_name,
    primary_email: overrides?.primaryEmail ?? row.email,
    primary_phone: overrides?.primaryPhone ?? (responses.phone as string) ?? row.phone,
    business_type: overrides?.businessType ?? (responses.businessType as string) ?? row.business_type,
    industry: overrides?.industry ?? (responses.industry as string) ?? "",
    country: overrides?.country ?? (responses.country as string) ?? "",
    state: overrides?.state ?? (responses.state as string) ?? "",
    city: overrides?.city ?? (responses.city as string) ?? "",
    address: overrides?.address ?? (responses.address as string) ?? "",
    website: overrides?.website ?? (responses.website as string) ?? null,
    status: overrides?.status ?? "ONBOARDING",
    source: normalizeSource(row.source),
    source_lead_id: row.id,
    onboarding_stages: {
      INTAKE_RECEIVED: { completedAt: now, completedBy: actor.actorName ?? actor.actorId ?? null, questionnaire: fields.length > 0 ? { responses, fields } : undefined },
    },
    onboarding_started_at: now,
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

/** Create a business manually from admin input. Records a BUSINESS_CREATED audit event. */
export async function createBusiness(
  input: Omit<Business, "id" | "createdAt" | "updatedAt" | "sourceLeadId" | "createdBy" | "onboardingStages">,
  actor: AuditContext
): Promise<{ ok: boolean; business?: Business; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const { data: created, error } = await supabase
    .from("businesses")
    .insert({
      id,
      business_name: input.businessName,
      legal_name: input.legalName,
      primary_contact_name: input.primaryContactName,
      primary_email: input.primaryEmail,
      primary_phone: input.primaryPhone,
      business_type: input.businessType,
      industry: input.industry,
      country: input.country,
      state: input.state,
      city: input.city,
      address: input.address,
      website: input.website,
      status: input.status || "ONBOARDING",
      source: input.source || "DIRECT",
      source_lead_id: null,
      onboarding_stages: { INTAKE_RECEIVED: { completedAt: now, completedBy: actor.actorId ?? null } },
      onboarding_owner: input.onboardingOwner ?? null,
      onboarding_health: input.onboardingHealth ?? "On Track",
      onboarding_waiting_on: input.onboardingWaitingOn ?? "None",
      blocker_reason: input.blockerReason ?? null,
      blocker_since: input.blockerSince ?? null,
      target_go_live: input.targetGoLive ?? null,
      onboarding_started_at: now,
      onboarding_progress: input.onboardingProgress ?? 0,
      created_by: actor.actorId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (error || !created) {
    console.error("[createBusiness]", error)
    return { ok: false, error: "Failed to create business" }
  }

  const business = mapBusiness(created)
  await recordAudit(actor, {
    action: AUDIT_ACTIONS.BUSINESS_CREATED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: business.id,
    metadata: { businessName: business.businessName, source: business.source },
  })
  return { ok: true, business }
}

/** Permanently delete a business. Records a BUSINESS_DELETED audit event. */
export async function deleteBusiness(id: string, actor: AuditContext): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from("businesses").delete().eq("id", id)
  if (error) {
    console.error("[deleteBusiness]", error)
    return false
  }
  await recordAudit(actor, {
    action: AUDIT_ACTIONS.BUSINESS_DELETED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: id,
    metadata: { deletedBy: actor.actorId },
  })
  return true
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
  if (updates.onboardingOwner !== undefined) updateData.onboarding_owner = updates.onboardingOwner
  if (updates.onboardingHealth !== undefined) updateData.onboarding_health = updates.onboardingHealth
  if (updates.onboardingWaitingOn !== undefined) updateData.onboarding_waiting_on = updates.onboardingWaitingOn
  if (updates.blockerReason !== undefined) updateData.blocker_reason = updates.blockerReason
  if (updates.blockerSince !== undefined) updateData.blocker_since = updates.blockerSince
  if (updates.targetGoLive !== undefined) updateData.target_go_live = updates.targetGoLive
  if (updates.onboardingProgress !== undefined) updateData.onboarding_progress = updates.onboardingProgress

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

/* ───────────────────────────  Onboarding stage tracker  ─────────────────────────── */

/** Mark an onboarding stage complete (or reopen it) for a business. */
export async function setOnboardingStage(
  businessId: string,
  stage: OnboardingStageKey,
  completed: boolean,
  actor: AuditContext,
  opts?: { force?: boolean; paymentConfirmed?: boolean }
): Promise<{ ok: boolean; stages?: OnboardingStages; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: row } = await supabase
    .from("businesses")
    .select("onboarding_stages, status")
    .eq("id", businessId)
    .single()
  if (!row) return { ok: false, error: "Business not found" }

  const stages: OnboardingStages = { ...((row.onboarding_stages as OnboardingStages) || {}) }
  const idx = ONBOARDING_STAGES.findIndex((s) => s.key === stage)

  // Gate critical transitions server-side unless force-override is provided.
  if (completed && stage === "PROVISIONING") {
    const prev = stages["AWAITING_PAYMENT"]
    if (!prev?.completedAt && !opts?.paymentConfirmed && !opts?.force) {
      return { ok: false, error: "Required payment must be confirmed before provisioning" }
    }
  }

  if (completed) {
    stages[stage] = { completedAt: new Date().toISOString(), completedBy: actor.actorName ?? actor.actorId ?? null }
    // Auto-complete earlier stages in the pipeline so the tracker stays ordered.
    for (const s of ONBOARDING_STAGES.slice(0, idx)) {
      if (!stages[s.key]) {
        stages[s.key] = { completedAt: new Date().toISOString(), completedBy: actor.actorName ?? actor.actorId ?? null }
      }
    }
  } else {
    delete stages[stage]
    // Reopening a stage also reopens any later stages so the pipeline stays honest.
    for (const s of ONBOARDING_STAGES.slice(idx + 1)) {
      delete stages[s.key]
    }
  }

  const completedCount = ONBOARDING_STAGES.filter((s) => stages[s.key]).length
  const progress = Math.round((completedCount / ONBOARDING_STAGES.length) * 100)

  const statusUpdate: Record<string, unknown> = { onboarding_stages: stages, onboarding_progress: progress, updated_at: new Date().toISOString() }
  if (stage === "ONBOARDING_COMPLETE" && completed) {
    statusUpdate.status = "ACTIVE"
  } else if (completed && row.status === "PROSPECT") {
    statusUpdate.status = "ONBOARDING"
  }

  const { error } = await supabase.from("businesses").update(statusUpdate).eq("id", businessId)
  if (error) return { ok: false, error: "Failed to update onboarding stage" }

  await recordAudit(actor, {
    action: AUDIT_ACTIONS.BUSINESS_UPDATED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: businessId,
    metadata: { onboardingStage: stage, completed, force: opts?.force },
  })
  return { ok: true, stages }
}

/** Update onboarding health / waiting-on / blocker metadata. */
export async function setOnboardingHealth(
  businessId: string,
  updates: Partial<Pick<Business, "onboardingHealth" | "onboardingWaitingOn" | "blockerReason" | "blockerSince" | "onboardingOwner" | "targetGoLive">>,
  actor: AuditContext
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.onboardingHealth !== undefined) updateData.onboarding_health = updates.onboardingHealth
  if (updates.onboardingWaitingOn !== undefined) updateData.onboarding_waiting_on = updates.onboardingWaitingOn
  if (updates.blockerReason !== undefined) updateData.blocker_reason = updates.blockerReason
  if (updates.blockerSince !== undefined) updateData.blocker_since = updates.blockerSince
  if (updates.onboardingOwner !== undefined) updateData.onboarding_owner = updates.onboardingOwner
  if (updates.targetGoLive !== undefined) updateData.target_go_live = updates.targetGoLive

  const { error } = await supabase.from("businesses").update(updateData).eq("id", businessId)
  if (error) return { ok: false, error: "Failed to update onboarding health" }

  await recordAudit(actor, {
    action: AUDIT_ACTIONS.BUSINESS_UPDATED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: businessId,
    metadata: { onboardingHealthUpdate: Object.keys(updateData).filter((k) => k !== "updated_at") },
  })
  return { ok: true }
}

/** Start onboarding for a PROSPECT business. */
export async function initiateOnboarding(
  businessId: string,
  actor: AuditContext
): Promise<{ ok: boolean; business?: Business; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: row } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single()
  if (!row) return { ok: false, error: "Business not found" }

  const now = new Date().toISOString()
  const stages: OnboardingStages = (row.onboarding_stages as OnboardingStages) || {}
  if (!stages.INTAKE_RECEIVED) {
    stages.INTAKE_RECEIVED = { completedAt: now, completedBy: actor.actorName ?? actor.actorId ?? null }
  }

  const { data, error } = await supabase
    .from("businesses")
    .update({
      status: "ONBOARDING",
      onboarding_stages: stages,
      onboarding_started_at: row.onboarding_started_at ?? now,
      updated_at: now,
    })
    .eq("id", businessId)
    .select()
    .single()
  if (error || !data) return { ok: false, error: "Failed to initiate onboarding" }

  await recordAudit(actor, {
    action: AUDIT_ACTIONS.BUSINESS_UPDATED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: businessId,
    metadata: { action: "initiate_onboarding" },
  })
  return { ok: true, business: mapBusiness(data) }
}

/* ───────────────────────────  Branches  ─────────────────────────── */

function mapBranch(row: Record<string, unknown>): BusinessBranch {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    name: row.name as string,
    address: (row.address as string) ?? "",
    city: (row.city as string) ?? "",
    state: (row.state as string) ?? "",
    country: (row.country as string) ?? "",
    phone: (row.phone as string) ?? "",
    isHeadquarters: (row.is_headquarters as boolean) ?? false,
    status: row.status as BusinessBranch["status"],
    createdAt: row.created_at as string,
  }
}

export async function listBusinessBranches(businessId: string): Promise<BusinessBranch[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("business_branches")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true })
  return (data || []).map(mapBranch)
}

export async function addBusinessBranch(
  businessId: string,
  input: { name: string; address?: string; city?: string; state?: string; country?: string; phone?: string; isHeadquarters?: boolean },
  actor: AuditContext
): Promise<{ ok: boolean; branch?: BusinessBranch; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  if (!input.name.trim()) return { ok: false, error: "Branch name is required" }
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("business_branches")
    .insert({
      business_id: businessId,
      name: input.name.trim(),
      address: input.address || "",
      city: input.city || "",
      state: input.state || "",
      country: input.country || "",
      phone: input.phone || "",
      is_headquarters: input.isHeadquarters ?? false,
      created_by: actor.actorId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: "Failed to add branch" }
  await recordAudit(actor, {
    action: AUDIT_ACTIONS.BUSINESS_UPDATED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: businessId,
    metadata: { branchAdded: input.name },
  })
  return { ok: true, branch: mapBranch(data) }
}

export async function deleteBusinessBranch(branchId: string, actor: AuditContext): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from("business_branches").delete().eq("id", branchId)
  if (error) return false
  await recordAudit(actor, {
    action: AUDIT_ACTIONS.BUSINESS_UPDATED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: null,
    metadata: { branchDeleted: branchId },
  })
  return true
}

/* ───────────────────────────  Business users  ─────────────────────────── */

function mapBusinessUser(row: Record<string, unknown>): BusinessUser {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    fullName: row.full_name as string,
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? "",
    role: row.role as BusinessUser["role"],
    branchId: (row.branch_id as string) ?? null,
    status: row.status as BusinessUser["status"],
    createdAt: row.created_at as string,
  }
}

export async function listBusinessUsers(businessId: string): Promise<BusinessUser[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("business_users")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true })
  return (data || []).map(mapBusinessUser)
}

export async function addBusinessUser(
  businessId: string,
  input: { fullName: string; email?: string; phone?: string; role?: BusinessUser["role"]; branchId?: string | null },
  actor: AuditContext
): Promise<{ ok: boolean; user?: BusinessUser; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  if (!input.fullName.trim()) return { ok: false, error: "Full name is required" }
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("business_users")
    .insert({
      business_id: businessId,
      full_name: input.fullName.trim(),
      email: input.email || "",
      phone: input.phone || "",
      role: input.role || "STAFF",
      branch_id: input.branchId || null,
      status: "ACTIVE",
      created_by: actor.actorId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: "Failed to add user" }
  await recordAudit(actor, {
    action: AUDIT_ACTIONS.BUSINESS_UPDATED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: businessId,
    metadata: { businessUserAdded: input.fullName },
  })
  return { ok: true, user: mapBusinessUser(data) }
}

export async function deleteBusinessUser(userId: string, actor: AuditContext): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from("business_users").delete().eq("id", userId)
  if (error) return false
  await recordAudit(actor, {
    action: AUDIT_ACTIONS.BUSINESS_UPDATED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: null,
    metadata: { businessUserDeleted: userId },
  })
  return true
}
