import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import type { PartnerOrgCapability } from "./partner-permissions"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import { sendEmail, getEmailSettings, getEmailRoute } from "./email"
import { renderEmailTemplate } from "./email-templates"

/* ───────────────────────────  Partner types & helpers  ─────────────────────────── */

export type ApplicantType = "INDIVIDUAL" | "COMPANY"
export type PartnerType =
  | "REFERRAL" | "CHANNEL" | "IMPLEMENTATION" | "CHANNEL_IMPLEMENTATION" | "TECHNOLOGY" | "PAYMENT"

export type ApplicationStatus =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "MORE_INFORMATION_REQUIRED" | "COMPLIANCE_REQUIRED"
  | "DISCOVERY_CALL" | "APPROVED_CONDITIONAL" | "APPROVED" | "AGREEMENT_PENDING" | "TRAINING"
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
  COMPLIANCE_REQUIRED: "Compliance Documents Required",
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

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.martpoint.com.ng"

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

/* ───────────────────────────  Applicant email notifications  ─────────────────────────── */

export async function sendApplicationSubmittedEmail(email: string, fullName: string, reference: string): Promise<boolean> {
  const statusUrl = `${baseUrl}/partners/application-status`

  const applicant = await renderEmailTemplate("partner_application_received", {
    fullName, reference, statusUrl,
  })
  const applicantSent = await sendEmail({ to: email, subject: applicant.subject, text: applicant.text, html: applicant.html })

  const admin = await renderEmailTemplate("partner_application_admin", {
    fullName, reference, email,
  })

  const routeRecipients = await getEmailRoute("partner_application")
  if (routeRecipients.length > 0) {
    await sendEmail({
      to: routeRecipients,
      subject: admin.subject,
      text: admin.text,
      html: admin.html,
    })
  } else {
    const { notifyEmail } = await getEmailSettings()
    if (notifyEmail && notifyEmail.toLowerCase() !== email.toLowerCase()) {
      await sendEmail({
        to: notifyEmail,
        subject: admin.subject,
        text: admin.text,
        html: admin.html,
      })
    }
  }

  return applicantSent
}

export async function sendApplicationStatusEmail(
  email: string,
  fullName: string,
  reference: string,
  newStatus: ApplicationStatus,
  previousStatus?: string | null,
  message?: string | null
): Promise<boolean> {
  const statusLabel = APPLICATION_STATUS_LABELS[newStatus] || newStatus.replace(/_/g, " ")
  const previousLabel = previousStatus ? (APPLICATION_STATUS_LABELS[previousStatus as ApplicationStatus] || previousStatus.replace(/_/g, " ")) : ""
  const statusUrl = `${baseUrl}/partners/application-status`

  const tpl = await renderEmailTemplate("application_status_change", {
    fullName,
    reference,
    statusLabel,
    previousLabel,
    previousLabelBlock: previousLabel ? `\nPrevious status: ${previousLabel}` : "",
    message: message || "",
    messageBlock: message ? `\n\nMessage from MartPoint:\n${message}` : "",
    statusUrl,
  })

  return sendEmail({ to: email, subject: tpl.subject, text: tpl.text, html: tpl.html })
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
  publicEmail: string | null
  publicPhone: string | null
  publicAddress: string | null
  serviceAreas: string
  /** Human-readable authorised services (Sales, Training, Implementation…). */
  services: string[]
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
    publicEmail: (row.public_email as string) ?? null,
    publicPhone: (row.public_phone as string) ?? null,
    publicAddress: (row.public_address as string) ?? null,
    serviceAreas: (row.service_areas as string) || "",
    services: [],
    partnerSince: (row.partner_since as string) ?? null,
  }
}

/* Public-safe labels for granted capabilities. Capabilities like FIRST_LINE_SUPPORT
 * and PAYMENT are internal-facing and intentionally re-labelled. */
const PUBLIC_SERVICE_LABELS: Partial<Record<PartnerOrgCapability, string>> = {
  REFERRALS: "Product referrals",
  SALES: "Sales",
  IMPLEMENTATION: "Implementation",
  CUSTOMER_ONBOARDING: "Customer onboarding",
  TRAINING: "Training",
  TECHNOLOGY: "Technology integration",
  FIRST_LINE_SUPPORT: "Customer support",
}

/** Batch-load enabled capabilities → public service labels keyed by partner id. */
async function loadPublicServices(partnerIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (!partnerIds.length) return map
  const nowIso = new Date().toISOString()
  const { data } = await supabase
    .from("partner_capabilities")
    .select("partner_id, capability")
    .in("partner_id", partnerIds)
    .eq("enabled", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  for (const row of data || []) {
    const label = PUBLIC_SERVICE_LABELS[row.capability as PartnerOrgCapability]
    if (!label) continue
    const list = map.get(row.partner_id as string) ?? []
    if (!list.includes(label)) list.push(label)
    map.set(row.partner_id as string, list)
  }
  return map
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
    .select("id, partner_id, business_name, display_name, partner_type, country, state, city, website, logo_url, public_email, public_phone, public_address, service_areas, partner_since")
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
  const partners = (data || []).map(mapPublicPartner)
  const services = await loadPublicServices(partners.map((p) => p.id))
  return partners.map((p) => ({ ...p, services: services.get(p.id) ?? [] }))
}

/** Public verify: by partner ID. Returns public info regardless of public_profile_enabled,
 * but the caller must adjust messaging based on status. */
export async function getPublicPartnerByPartnerId(partnerId: string): Promise<{
  id: string
  partnerId: string
  businessName: string
  displayName: string
  partnerType: PartnerType
  status: PartnerStatus
  country: string
  state: string
  city: string
  website: string | null
  publicEmail: string | null
  publicPhone: string | null
  publicAddress: string | null
  serviceAreas: string
  services: string[]
  partnerSince: string | null
  publicProfileEnabled: boolean
} | null> {
  if (!isSupabaseConfigured()) return null
  // RLS only exposes ACTIVE+public. For verify we need to see any status to show
  // the "not currently listed" message, so we rely on service role (server-side).
  const { data } = await supabase
    .from("partners")
    .select("id, partner_id, business_name, display_name, partner_type, status, country, state, city, website, public_email, public_phone, public_address, service_areas, partner_since, public_profile_enabled")
    .eq("partner_id", partnerId)
    .maybeSingle()
  if (!data) return null
  const services = await loadPublicServices([data.id as string])
  return {
    id: data.id,
    partnerId: data.partner_id,
    businessName: data.business_name,
    displayName: data.display_name || data.business_name,
    partnerType: data.partner_type,
    status: data.status,
    country: data.country || "",
    state: data.state || "",
    city: data.city || "",
    website: data.website ?? null,
    publicEmail: data.public_email ?? null,
    publicPhone: data.public_phone ?? null,
    publicAddress: data.public_address ?? null,
    serviceAreas: (data.service_areas as string) || "",
    services: services.get(data.id as string) ?? [],
    partnerSince: data.partner_since ?? null,
    publicProfileEnabled: data.public_profile_enabled ?? false,
  }
}

/* ───────────────────────────  Public engagement tracking  ───────────────────────────
 * Anonymous events from the public directory / verification pages.
 * No IPs, no cookies — just counts per partner & event type.
 */

export type PartnerEventType =
  | "directory_click"
  | "profile_view"
  | "verify_lookup"
  | "website_click"
  | "phone_click"
  | "email_click"
  | "sales_cta_click"

export const PARTNER_EVENT_TYPES: PartnerEventType[] = [
  "directory_click",
  "profile_view",
  "verify_lookup",
  "website_click",
  "phone_click",
  "email_click",
  "sales_cta_click",
]

/** Record a public engagement event for a partner (identified by partner_code like MP-NG-00001). */
export async function recordPartnerEvent(
  partnerCode: string,
  eventType: PartnerEventType,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!isSupabaseConfigured()) return
  const code = partnerCode.toUpperCase().trim()
  if (!/^MP-[A-Z]{2,3}-\d{1,6}$/.test(code)) return
  const { data: partner } = await supabase
    .from("partners")
    .select("id")
    .eq("partner_id", code)
    .maybeSingle()
  await supabase.from("partner_profile_events").insert({
    partner_id: (partner?.id as string) ?? null,
    partner_code: code,
    event_type: eventType,
    metadata: metadata ?? {},
  })
}
