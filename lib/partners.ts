import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"

/* ───────────────────────────  Partner types & helpers  ─────────────────────────── */

export type ApplicantType = "INDIVIDUAL" | "COMPANY"
export type PartnerType =
  | "REFERRAL" | "CHANNEL" | "IMPLEMENTATION" | "CHANNEL_IMPLEMENTATION" | "TECHNOLOGY" | "PAYMENT"

export type ApplicationStatus =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "MORE_INFORMATION_REQUIRED" | "DISCOVERY_CALL"
  | "APPROVED_CONDITIONAL" | "APPROVED" | "AGREEMENT_PENDING" | "TRAINING"
  | "CERTIFICATION_PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED" | "INACTIVE"

export type PartnerStatus = "PENDING_ACTIVATION" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "TERMINATED"

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  REFERRAL: "Referral Partner",
  CHANNEL: "Channel Partner",
  IMPLEMENTATION: "Implementation Partner",
  CHANNEL_IMPLEMENTATION: "Channel + Implementation",
  TECHNOLOGY: "Technology Partner",
  PAYMENT: "Payment Partner",
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Application Received",
  UNDER_REVIEW: "Under Review",
  MORE_INFORMATION_REQUIRED: "More Information Required",
  DISCOVERY_CALL: "Discovery Call",
  APPROVED_CONDITIONAL: "Conditional Approval",
  APPROVED: "Approved",
  AGREEMENT_PENDING: "Agreement Pending",
  TRAINING: "Training",
  CERTIFICATION_PENDING: "Certification Pending",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  REJECTED: "Rejected",
  INACTIVE: "Inactive",
}

/* ───────────────────────────  Reference number generation  ───────────────────────────
 * Format: MPA-YYYY-XXXXX  e.g. MPA-2026-00001
 * Sequence is persisted in a small counter table (created below) to stay unique.
 */

export async function generateApplicationReference(): Promise<string> {
  const year = new Date().getFullYear()
  if (!isSupabaseConfigured()) {
    // Fallback for unconfigured environments (dev only)
    return `MPA-${year}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
  }
  // Atomic upsert-based counter using a single-row table.
  const { data, error } = await supabase.rpc("increment_partner_application_seq")
  if (error || !data) {
    // Fallback: derive from count (best-effort, may race)
    const { count } = await supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
    const seq = (count ?? 0) + 1
    return `MPA-${year}-${String(seq).padStart(5, "0")}`
  }
  return `MPA-${year}-${String(data as number).padStart(5, "0")}`
}

/* ───────────────────────────  Partner ID generation  ───────────────────────────
 * Format: MP-{COUNTRY_CODE}-{SEQUENCE}  e.g. MP-NG-00001
 * Unique and immutable, server-generated.
 */

export async function generatePartnerId(countryCode: string): Promise<string> {
  const cc = (countryCode || "NG").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "NG"
  if (!isSupabaseConfigured()) {
    return `MP-${cc}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
  }
  const { data, error } = await supabase.rpc("increment_partner_id_seq", { p_country: cc })
  if (error || !data) {
    const { count } = await supabase.from("partners").select("id", { count: "exact", head: true })
    const seq = (count ?? 0) + 1
    return `MP-${cc}-${String(seq).padStart(5, "0")}`
  }
  return `MP-${cc}-${String(data as number).padStart(5, "0")}`
}

/* ───────────────────────────  Status history  ─────────────────────────── */

export async function recordStatusHistory(
  applicationId: string | null,
  partnerId: string | null,
  previousStatus: string | null,
  newStatus: string,
  reason: string | null,
  changedBy: string | null
): Promise<void> {
  if (!isSupabaseConfigured()) return
  await supabase.from("partner_status_history").insert({
    application_id: applicationId,
    partner_id: partnerId,
    previous_status: previousStatus,
    new_status: newStatus,
    reason,
    changed_by: changedBy,
  })
}

/* ───────────────────────────  Public application submission  ─────────────────────────── */

export interface PublicApplicationInput {
  applicantType: ApplicantType
  requestedPartnerType: PartnerType
  fullName: string
  businessName: string
  email: string
  phone: string
  whatsapp: string
  country: string
  state: string
  city: string
  businessAddress: string
  website: string
  linkedin: string
  socialProfile: string
  registrationNumber: string
  yearEstablished: string
  teamSize: string
  estimatedCustomerBase: string
  industriesServed: string[]
  geographicCoverage: string[]
  currentProductsServices: string
  reasonForApplying: string
  relevantExperience: string
  expectedMonthlyOpportunities: string
  additionalAnswers: Record<string, string>
  declaration: boolean
}

export interface SubmissionResult {
  ok: boolean
  reference?: string
  error?: string
}

export async function submitPartnerApplication(
  input: PublicApplicationInput
): Promise<SubmissionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Application system not configured" }
  }
  if (!input.declaration) {
    return { ok: false, error: "Declaration must be confirmed" }
  }

  const reference = await generateApplicationReference()
  const now = new Date().toISOString()

  const row = {
    reference_number: reference,
    applicant_type: input.applicantType,
    requested_partner_type: input.requestedPartnerType,
    full_name: input.fullName,
    business_name: input.businessName,
    email: input.email,
    phone: input.phone,
    whatsapp: input.whatsapp,
    country: input.country,
    state: input.state,
    city: input.city,
    business_address: input.businessAddress,
    website: input.website,
    linkedin: input.linkedin,
    social_profile: input.socialProfile,
    registration_number: input.registrationNumber,
    year_established: input.yearEstablished,
    team_size: input.teamSize,
    estimated_customer_base: input.estimatedCustomerBase,
    industries_served: input.industriesServed,
    geographic_coverage: input.geographicCoverage,
    current_products_services: input.currentProductsServices,
    reason_for_applying: input.reasonForApplying,
    relevant_experience: input.relevantExperience,
    expected_monthly_opportunities: input.expectedMonthlyOpportunities || null,
    additional_answers: input.additionalAnswers,
    status: "SUBMITTED",
    submitted_at: now,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from("partner_applications")
    .insert(row)
    .select("id")
    .single()

  if (error || !data) {
    console.error("[partner] submission failed:", error?.message)
    return { ok: false, error: "Failed to submit application" }
  }

  const applicationId = data.id
  await recordStatusHistory(applicationId, null, null, "SUBMITTED", null, null)

  const systemCtx: AuditContext = { actorType: "SYSTEM" }
  await recordAudit(systemCtx, {
    action: AUDIT_ACTIONS.PARTNER_APPLICATION_SUBMITTED,
    entityType: AUDIT_ENTITIES.PARTNER_APPLICATION,
    entityId: applicationId,
    metadata: { reference, partnerType: input.requestedPartnerType, email: input.email },
  })

  return { ok: true, reference }
}

/* ───────────────────────────  Public directory / verify  ─────────────────────────── */

export interface PublicPartner {
  id: string
  partnerId: string
  businessName: string
  displayName: string
  partnerType: PartnerType
  country: string
  state: string
  city: string
  website: string | null
  logoUrl: string | null
  partnerSince: string | null
}

function mapPublicPartner(row: Record<string, unknown>): PublicPartner {
  return {
    id: row.id as string,
    partnerId: row.partner_id as string,
    businessName: row.business_name as string,
    displayName: (row.display_name as string) || (row.business_name as string),
    partnerType: row.partner_type as PartnerType,
    country: (row.country as string) || "",
    state: (row.state as string) || "",
    city: (row.city as string) || "",
    website: (row.website as string) ?? null,
    logoUrl: (row.logo_url as string) ?? null,
    partnerSince: (row.partner_since as string) ?? null,
  }
}

/** Only ACTIVE + public_profile_enabled partners (enforced also by RLS). */
export async function listPublicPartners(filters?: {
  country?: string
  state?: string
  city?: string
  partnerType?: string
  query?: string
}): Promise<PublicPartner[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase
    .from("partners")
    .select("id, partner_id, business_name, display_name, partner_type, country, state, city, website, logo_url, partner_since")
    .eq("status", "ACTIVE")
    .eq("public_profile_enabled", true)

  if (filters?.country) q = q.eq("country", filters.country)
  if (filters?.state) q = q.eq("state", filters.state)
  if (filters?.city) q = q.ilike("city", `%${filters.city}%`)
  if (filters?.partnerType) q = q.eq("partner_type", filters.partnerType)
  if (filters?.query) {
    q = q.or(`partner_id.ilike.%${filters.query}%,business_name.ilike.%${filters.query}%,display_name.ilike.%${filters.query}%`)
  }
  const { data } = await q.order("partner_since", { ascending: false })
  return (data || []).map(mapPublicPartner)
}

/** Public verify: by partner ID. Returns public info regardless of public_profile_enabled,
 * but the caller must adjust messaging based on status. */
export async function getPublicPartnerByPartnerId(partnerId: string): Promise<{
  partnerId: string
  businessName: string
  displayName: string
  partnerType: PartnerType
  status: PartnerStatus
  country: string
  state: string
  city: string
  website: string | null
  partnerSince: string | null
  publicProfileEnabled: boolean
} | null> {
  if (!isSupabaseConfigured()) return null
  // RLS only exposes ACTIVE+public. For verify we need to see any status to show
  // the "not currently listed" message, so we rely on service role (server-side).
  const { data } = await supabase
    .from("partners")
    .select("partner_id, business_name, display_name, partner_type, status, country, state, city, website, partner_since, public_profile_enabled")
    .eq("partner_id", partnerId)
    .maybeSingle()
  if (!data) return null
  return {
    partnerId: data.partner_id,
    businessName: data.business_name,
    displayName: data.display_name || data.business_name,
    partnerType: data.partner_type,
    status: data.status,
    country: data.country || "",
    state: data.state || "",
    city: data.city || "",
    website: data.website ?? null,
    partnerSince: data.partner_since ?? null,
    publicProfileEnabled: data.public_profile_enabled ?? false,
  }
}
