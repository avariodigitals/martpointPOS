import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "./supabase"
import { verifyPassword } from "./crypto"
import { signSession, verifySession } from "./session-secret"
import type { PartnerType } from "./partners"
import {
  type PartnerUserRole,
  type PartnerUserStatus,
  type PartnerOrgCapability,
  type PartnerPermission,
  type AccessLevel,
  partnerUserHasPermission,
  PARTNER_TYPE_DEFAULT_CAPABILITIES,
} from "./partner-permissions"

export type { PartnerUserRole, PartnerUserStatus, PartnerOrgCapability, PartnerPermission, AccessLevel }

export interface PartnerSession {
  partnerUserId: string
  partnerId: string
  role: PartnerUserRole
  name: string
  sessionVersion: number
}

export interface PartnerUserRecord {
  id: string
  partnerId: string
  fullName: string
  email: string
  phone: string | null
  role: PartnerUserRole
  status: PartnerUserStatus
  passwordHash: string | null
  emailVerifiedAt: string | null
  lastLoginAt: string | null
  invitedAt: string | null
  invitedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface PartnerRecord {
  id: string
  partnerId: string
  businessName: string
  displayName: string
  partnerType: PartnerType
  status: "PENDING_ACTIVATION" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "TERMINATED"
  country: string
  state: string
  city: string
  publicEmail: string | null
  publicPhone: string | null
  website: string | null
  logoUrl: string | null
  publicProfileEnabled: boolean
  partnerSince: string | null
  createdAt: string
  updatedAt: string
}

const PARTNER_COOKIE_NAME = "partner-session"
const SESSION_VERSION = 1

/* Re-export capability/permission helpers and constants. */
export { partnerUserHasPermission, PARTNER_TYPE_DEFAULT_CAPABILITIES }

/* ───────────────────────────  Session helpers  ─────────────────────────── */

function isPartnerSession(value: unknown): value is PartnerSession {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.partnerUserId === "string" &&
    typeof v.partnerId === "string" &&
    typeof v.role === "string" &&
    typeof v.name === "string" &&
    typeof v.sessionVersion === "number"
  )
}

export async function createPartnerSession(user: PartnerUserRecord): Promise<void> {
  const cookieStore = await cookies()
  const payload: PartnerSession = {
    partnerUserId: user.id,
    partnerId: user.partnerId,
    role: user.role,
    name: user.fullName,
    sessionVersion: SESSION_VERSION,
  }
  const token = signSession(payload)
  cookieStore.set(PARTNER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
}

export async function getPartnerSession(): Promise<PartnerSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(PARTNER_COOKIE_NAME)
  if (!token?.value) return null
  return verifySession(token.value, isPartnerSession)
}

export async function destroyPartnerSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(PARTNER_COOKIE_NAME)
}

export async function requirePartnerSession(): Promise<PartnerSession> {
  const session = await getPartnerSession()
  if (!session) {
    redirect("/partner/login")
  }
  const valid = await validatePartnerSession(session)
  if (!valid) {
    await destroyPartnerSession()
    redirect("/partner/login")
  }
  return session
}

/* ───────────────────────────  Data loading  ─────────────────────────── */

export async function getPartnerUserById(
  id: string
): Promise<PartnerUserRecord | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("partner_users")
    .select("*")
    .eq("id", id)
    .single()
  if (error || !data) return null
  return mapPartnerUser(data)
}

export async function getPartnerUserByEmail(
  email: string
): Promise<PartnerUserRecord | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("partner_users")
    .select("*")
    .ilike("email", email.trim().toLowerCase())
    .single()
  if (error || !data) return null
  return mapPartnerUser(data)
}

export async function getPartnerById(id: string): Promise<PartnerRecord | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase.from("partners").select("*").eq("id", id).single()
  if (error || !data) return null
  return mapPartner(data)
}

export async function getPartnerByPartnerId(
  partnerId: string
): Promise<PartnerRecord | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .eq("partner_id", partnerId.toUpperCase())
    .maybeSingle()
  if (error || !data) return null
  return mapPartner(data)
}

function mapPartnerUser(row: Record<string, unknown>): PartnerUserRecord {
  return {
    id: row.id as string,
    partnerId: row.partner_id as string,
    fullName: row.full_name as string,
    email: row.email as string,
    phone: (row.phone as string | null) ?? null,
    role: row.role as PartnerUserRole,
    status: row.status as PartnerUserStatus,
    passwordHash: (row.password_hash as string | null) ?? null,
    emailVerifiedAt: (row.email_verified_at as string | null) ?? null,
    lastLoginAt: (row.last_login_at as string | null) ?? null,
    invitedAt: (row.invited_at as string | null) ?? null,
    invitedBy: (row.invited_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapPartner(row: Record<string, unknown>): PartnerRecord {
  return {
    id: row.id as string,
    partnerId: row.partner_id as string,
    businessName: row.business_name as string,
    displayName: row.display_name as string,
    partnerType: row.partner_type as PartnerType,
    status: row.status as PartnerRecord["status"],
    country: (row.country as string) || "",
    state: (row.state as string) || "",
    city: (row.city as string) || "",
    publicEmail: (row.public_email as string | null) ?? null,
    publicPhone: (row.public_phone as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    logoUrl: (row.logo_url as string | null) ?? null,
    publicProfileEnabled: (row.public_profile_enabled as boolean) ?? false,
    partnerSince: (row.partner_since as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

async function validatePartnerSession(session: PartnerSession): Promise<boolean> {
  if (session.sessionVersion !== SESSION_VERSION) return false
  const [user, partner] = await Promise.all([
    getPartnerUserById(session.partnerUserId),
    getPartnerById(session.partnerId),
  ])
  if (!user || !partner) return false
  if (user.partnerId !== partner.id) return false
  if (user.status !== "ACTIVE") return false
  if (user.role !== session.role) return false
  if (partner.status !== "ACTIVE") return false
  return true
}

/* ───────────────────────────  Authentication  ─────────────────────────── */

export async function authenticatePartner(
  email: string,
  password: string
): Promise<PartnerUserRecord | null> {
  if (!isSupabaseConfigured()) return null
  const user = await getPartnerUserByEmail(email)
  if (!user) return null
  if (user.status !== "ACTIVE") return null
  if (!user.passwordHash) return null
  if (!verifyPassword(password, user.passwordHash)) return null

  await supabase
    .from("partner_users")
    .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", user.id)

  return user
}

/* ───────────────────────────  RBAC helpers  ─────────────────────────── */

export async function getPartnerCapabilities(
  partnerId: string
): Promise<PartnerOrgCapability[]> {
  if (!isSupabaseConfigured()) return []
  const t = new Date().toISOString()
  const { data, error } = await supabase
    .from("partner_capabilities")
    .select("capability")
    .eq("partner_id", partnerId)
    .eq("enabled", true)
    .or(`expires_at.is.null,expires_at.gt.${t}`)
  if (error || !data) return []
  return (data as { capability: PartnerOrgCapability }[]).map((d) => d.capability)
}

export async function partnerHasCapability(
  partnerId: string,
  capability: PartnerOrgCapability
): Promise<boolean> {
  const caps = await getPartnerCapabilities(partnerId)
  return caps.includes(capability)
}

export interface AuthorizationResult {
  authorized: boolean
  response: Response | null
  user: PartnerUserRecord | null
  partner: PartnerRecord | null
}

export async function authorizePartner(options: {
  session: PartnerSession | null
  permission: PartnerPermission
  capability?: PartnerOrgCapability | null
}): Promise<AuthorizationResult> {
  const { session, permission, capability = null } = options
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
      partner: null,
    }
  }

  const [user, partner] = await Promise.all([
    getPartnerUserById(session.partnerUserId),
    getPartnerById(session.partnerId),
  ])

  if (!user || !partner) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user,
      partner,
    }
  }

  if (user.partnerId !== partner.id || user.role !== session.role) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user,
      partner,
    }
  }

  if (user.status !== "ACTIVE" || partner.status !== "ACTIVE") {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Account suspended" }, { status: 403 }),
      user,
      partner,
    }
  }

  if (!partnerUserHasPermission(user.role, permission)) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      user,
      partner,
    }
  }

  if (capability && !(await partnerHasCapability(partner.id, capability))) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      user,
      partner,
    }
  }

  return { authorized: true, response: null, user, partner }
}

/* ───────────────────────────  Object-level authorization  ─────────────────────────── */

export async function canPartnerAccessBusiness(
  partnerId: string,
  businessId: string,
  options: {
    partnerUserId?: string
    requiredAccessLevel?: AccessLevel
    userPermission?: PartnerPermission | null
    orgCapability?: PartnerOrgCapability | null
  } = {}
): Promise<{ allowed: boolean; reason: string }> {
  const partner = await getPartnerById(partnerId)
  if (!partner || partner.status !== "ACTIVE") {
    return { allowed: false, reason: "inactive_partner" }
  }

  if (options.partnerUserId) {
    const user = await getPartnerUserById(options.partnerUserId)
    if (!user || user.status !== "ACTIVE" || user.partnerId !== partnerId) {
      return { allowed: false, reason: "inactive_partner_user" }
    }
    if (
      options.userPermission &&
      !partnerUserHasPermission(user.role, options.userPermission)
    ) {
      return { allowed: false, reason: "missing_user_permission" }
    }
  }

  if (
    options.orgCapability &&
    !(await partnerHasCapability(partnerId, options.orgCapability))
  ) {
    return { allowed: false, reason: "missing_organisation_capability" }
  }

  const { data: assignment, error } = await supabase
    .from("partner_customer_assignments")
    .select("*")
    .eq("partner_id", partnerId)
    .eq("business_id", businessId)
    .eq("status", "ACTIVE")
    .maybeSingle()

  if (error || !assignment) {
    return { allowed: false, reason: "no_active_assignment" }
  }

  const now = new Date().toISOString()
  if (assignment.expires_at && assignment.expires_at < now) {
    return { allowed: false, reason: "assignment_expired" }
  }
  if (assignment.starts_at && assignment.starts_at > now) {
    return { allowed: false, reason: "assignment_not_started" }
  }

  if (options.requiredAccessLevel) {
    const levels: AccessLevel[] = ["VIEW_ONLY", "SALES", "ONBOARDING_MANAGER", "SUPPORT"]
    const requiredIndex = levels.indexOf(options.requiredAccessLevel)
    const actualIndex = levels.indexOf(assignment.access_level as AccessLevel)
    if (actualIndex < requiredIndex) {
      return { allowed: false, reason: "insufficient_access_level" }
    }
  }

  return { allowed: true, reason: "ok" }
}
