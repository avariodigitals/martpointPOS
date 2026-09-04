import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { hashPassword, hashToken } from "./crypto"
import { sendEmail } from "./email"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import {
  createSignedDocUrl,
  validatePartnerFile,
  PARTNER_DOCUMENTS_BUCKET,
} from "./partner-documents"
import type {
  PartnerUserRecord,
  PartnerRecord,
  PartnerUserRole,
  PartnerOrgCapability,
  AccessLevel,
} from "./partner-auth"
import { PARTNER_TYPE_DEFAULT_CAPABILITIES } from "./partner-auth"
import type { PartnerType } from "./partners"

/* ───────────────────────────  Helpers  ─────────────────────────── */

function generateSecureToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("hex")
  const tokenHash = hashToken(token)
  return { token, tokenHash }
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
}

function mapPartnerUser(row: Record<string, unknown>): PartnerUserRecord {
  return {
    id: row.id as string,
    partnerId: row.partner_id as string,
    fullName: row.full_name as string,
    email: row.email as string,
    phone: (row.phone as string | null) ?? null,
    role: row.role as PartnerUserRole,
    status: row.status as PartnerUserRecord["status"],
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

function now(): string {
  return new Date().toISOString()
}

/* ───────────────────────────  Invitations  ─────────────────────────── */

export interface InvitationInput {
  partnerId: string
  fullName: string
  email: string
  role: PartnerUserRole
  invitedBy: string
  actorType: AuditContext["actorType"]
}

export async function createPartnerInvitation(
  input: InvitationInput
): Promise<{ ok: true; token: string; user: PartnerUserRecord; invitationId: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const normalizedEmail = input.email.trim().toLowerCase()
  const partner = await getPartnerById(input.partnerId)
  if (!partner) return { ok: false, error: "Partner not found" }
  if (partner.status !== "ACTIVE") return { ok: false, error: "Partner is not active" }

  // Email is globally unique among partner users in V1.
  const { data: existing } = await supabase
    .from("partner_users")
    .select("id, partner_id")
    .ilike("email", normalizedEmail)
    .maybeSingle()
  if (existing) {
    return { ok: false, error: "A partner user with this email already exists" }
  }

  const { token, tokenHash } = generateSecureToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() // 7 days

  const { data: user, error: userErr } = await supabase
    .from("partner_users")
    .insert({
      partner_id: input.partnerId,
      full_name: input.fullName.trim(),
      email: normalizedEmail,
      role: input.role,
      status: "INVITED",
      invited_at: now(),
      invited_by: input.invitedBy,
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single()

  if (userErr || !user) {
    return { ok: false, error: "Failed to create partner user" }
  }

  const { data: invitation, error: inviteErr } = await supabase
    .from("partner_invitations")
    .insert({
      partner_id: input.partnerId,
      partner_user_id: user.id,
      email: normalizedEmail,
      role: input.role,
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by: input.invitedBy,
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single()

  if (inviteErr || !invitation) {
    await supabase.from("partner_users").delete().eq("id", user.id)
    return { ok: false, error: "Failed to create invitation" }
  }

  const link = `${baseUrl()}/partner/invite/${token}`
  await sendEmail({
    to: normalizedEmail,
    subject: "Invitation to join the MartPoint Partner Portal",
    text: `Hi ${input.fullName.trim()},

You have been invited to join the MartPoint Partner Portal for ${partner.businessName}.

Click the link below to accept your invitation and set your password. This link expires in 7 days and can only be used once.

${link}

Welcome,
MartPoint Partner Team`,
  })

  const ctx: AuditContext = {
    actorType: input.actorType,
    actorId: input.invitedBy,
    actorName: undefined,
  }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_USER_INVITED,
    entityType: AUDIT_ENTITIES.PARTNER_INVITATION,
    entityId: invitation.id,
    metadata: {
      partnerId: input.partnerId,
      partnerUserId: user.id,
      email: normalizedEmail,
      role: input.role,
    },
  })

  return { ok: true, token, user: mapPartnerUser(user), invitationId: invitation.id }
}

export async function getPartnerInvitationByToken(
  token: string
): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) return null
  const tokenHash = hashToken(token)
  const { data, error } = await supabase
    .from("partner_invitations")
    .select("*, partner_users(*), partners(*)")
    .eq("token_hash", tokenHash)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now())
    .maybeSingle()
  if (error || !data) return null
  return data
}

export async function acceptPartnerInvitation(
  token: string,
  password: string
): Promise<PartnerUserRecord | null> {
  if (!isSupabaseConfigured()) return null
  const tokenHash = hashToken(token)

  const { data: invitation, error } = await supabase
    .from("partner_invitations")
    .select("*, partner_users(*)")
    .eq("token_hash", tokenHash)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now())
    .single()

  if (error || !invitation) return null

  const user = (invitation as Record<string, unknown>).partner_users as Record<string, unknown>
  if (!user || (user.status as string) !== "INVITED") return null

  const passwordHash = hashPassword(password)
  const acceptedAt = now()

  await supabase
    .from("partner_users")
    .update({
      status: "ACTIVE",
      password_hash: passwordHash,
      email_verified_at: acceptedAt,
      updated_at: acceptedAt,
    })
    .eq("id", user.id as string)

  await supabase
    .from("partner_invitations")
    .update({ accepted_at: acceptedAt, updated_at: acceptedAt })
    .eq("id", invitation.id as string)

  const ctx: AuditContext = { actorType: "SYSTEM" }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_USER_ACTIVATED,
    entityType: AUDIT_ENTITIES.PARTNER_USER,
    entityId: user.id as string,
    metadata: {
      partnerId: user.partner_id,
      invitationId: invitation.id,
    },
  })

  const updated = await supabase.from("partner_users").select("*").eq("id", user.id as string).single()
  return updated.data ? mapPartnerUser(updated.data) : null
}

export async function resendPartnerInvitation(
  invitationId: string,
  invitedBy: string,
  actorType: AuditContext["actorType"]
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: invitation, error } = await supabase
    .from("partner_invitations")
    .select("*, partner_users(*), partners(*)")
    .eq("id", invitationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .single()

  if (error || !invitation) return { ok: false, error: "Invitation not found" }

  const { token, tokenHash } = generateSecureToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()

  await supabase
    .from("partner_invitations")
    .update({ token_hash: tokenHash, expires_at: expiresAt, updated_at: now() })
    .eq("id", invitationId)

  const partner = (invitation as Record<string, unknown>).partners as Record<string, unknown>
  const user = (invitation as Record<string, unknown>).partner_users as Record<string, unknown>

  const link = `${baseUrl()}/partner/invite/${token}`
  await sendEmail({
    to: user.email as string,
    subject: "Your MartPoint Partner Portal invitation",
    text: `Hi ${user.full_name as string},

Here is your new invitation link to join the MartPoint Partner Portal for ${partner.business_name as string}.

${link}

This link expires in 7 days and can only be used once.

MartPoint Partner Team`,
  })

  const ctx: AuditContext = { actorType, actorId: invitedBy }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_USER_INVITATION_RESENT,
    entityType: AUDIT_ENTITIES.PARTNER_INVITATION,
    entityId: invitationId,
    metadata: { partnerId: partner.id, partnerUserId: user.id },
  })

  return { ok: true, token }
}

export async function revokePartnerInvitation(
  invitationId: string,
  revokedBy: string,
  actorType: AuditContext["actorType"]
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: invitation, error } = await supabase
    .from("partner_invitations")
    .select("*, partner_users(*)")
    .eq("id", invitationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .single()

  if (error || !invitation) return { ok: false, error: "Invitation not found" }

  const user = (invitation as Record<string, unknown>).partner_users as Record<string, unknown>

  await supabase
    .from("partner_invitations")
    .update({ revoked_at: now(), updated_at: now() })
    .eq("id", invitationId)

  await supabase
    .from("partner_users")
    .update({ status: "DISABLED", updated_at: now() })
    .eq("id", user.id as string)

  const ctx: AuditContext = { actorType, actorId: revokedBy }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_USER_INVITATION_REVOKED,
    entityType: AUDIT_ENTITIES.PARTNER_INVITATION,
    entityId: invitationId,
    metadata: { partnerId: user.partner_id, partnerUserId: user.id },
  })

  return { ok: true }
}

/* ───────────────────────────  Password reset  ─────────────────────────── */

export async function createPartnerPasswordReset(
  email: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const normalizedEmail = email.trim().toLowerCase()
  const { data: user } = await supabase
    .from("partner_users")
    .select("*")
    .ilike("email", normalizedEmail)
    .single()

  // Always return success, even if the email does not exist, to prevent enumeration.
  if (!user) {
    return { ok: true, token: "" }
  }

  const { token, tokenHash } = generateSecureToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString() // 1 hour

  await supabase.from("partner_password_resets").insert({
    partner_user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_at: now(),
  })

  const link = `${baseUrl()}/partner/reset-password/${token}`
  await sendEmail({
    to: normalizedEmail,
    subject: "Reset your MartPoint Partner Portal password",
    text: `Hi ${user.full_name as string},

You requested a password reset for your MartPoint Partner Portal account.

Click the link below to set a new password. This link expires in 1 hour and can only be used once.

${link}

If you did not request this, please ignore this email.

MartPoint Partner Team`,
  })

  return { ok: true, token }
}

export async function resetPartnerPassword(
  token: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const tokenHash = hashToken(token)

  const { data: row, error } = await supabase
    .from("partner_password_resets")
    .select("*, partner_users(*)")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", now())
    .single()

  if (error || !row) return { ok: false, error: "Invalid or expired token" }

  const user = (row as Record<string, unknown>).partner_users as Record<string, unknown>
  const passwordHash = hashPassword(password)

  await supabase
    .from("partner_users")
    .update({ password_hash: passwordHash, updated_at: now() })
    .eq("id", user.id as string)

  await supabase
    .from("partner_password_resets")
    .update({ used_at: now() })
    .eq("id", row.id as string)

  return { ok: true }
}

/* ───────────────────────────  Partner users (scoped)  ─────────────────────────── */

export async function listPartnerInvitations(partnerId: string): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("partner_invitations")
    .select("*, partner_users(*)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((row) => {
    const user = (row.partner_users as Record<string, unknown> | undefined) || {}
    return {
      ...row,
      full_name: user.full_name,
      fullName: user.full_name,
    }
  })
}

export async function listPartnerUsers(partnerId: string): Promise<PartnerUserRecord[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("partner_users")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: true })
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(mapPartnerUser)
}

export async function updatePartnerUserStatus(
  partnerUserId: string,
  status: PartnerUserRecord["status"],
  actor: { id: string; type: AuditContext["actorType"] }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: current } = await supabase
    .from("partner_users")
    .select("*")
    .eq("id", partnerUserId)
    .single()

  if (!current) return { ok: false, error: "User not found" }

  await supabase
    .from("partner_users")
    .update({ status, updated_at: now() })
    .eq("id", partnerUserId)

  const action =
    status === "SUSPENDED"
      ? AUDIT_ACTIONS.PARTNER_USER_SUSPENDED
      : status === "DISABLED"
        ? AUDIT_ACTIONS.PARTNER_USER_DISABLED
        : AUDIT_ACTIONS.PARTNER_USER_ACTIVATED

  const ctx: AuditContext = { actorType: actor.type, actorId: actor.id }
  await recordAudit(ctx, {
    action,
    entityType: AUDIT_ENTITIES.PARTNER_USER,
    entityId: partnerUserId,
    metadata: { partnerId: current.partner_id, newStatus: status },
  })

  return { ok: true }
}

/* ───────────────────────────  Partner data  ─────────────────────────── */

export async function getPartnerById(id: string): Promise<PartnerRecord | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase.from("partners").select("*").eq("id", id).single()
  if (error || !data) return null
  return mapPartner(data)
}

export async function updatePartnerProfile(
  partnerId: string,
  updates: Partial<{
    businessName: string
    displayName: string
    publicEmail: string
    publicPhone: string
    website: string
    logoUrl: string
    city: string
    state: string
    country: string
  }>,
  actor: { id: string; type: AuditContext["actorType"] }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const updateData: Record<string, unknown> = { updated_at: now() }
  if (updates.businessName !== undefined) updateData.business_name = updates.businessName
  if (updates.displayName !== undefined) updateData.display_name = updates.displayName
  if (updates.publicEmail !== undefined) updateData.public_email = updates.publicEmail
  if (updates.publicPhone !== undefined) updateData.public_phone = updates.publicPhone
  if (updates.website !== undefined) updateData.website = updates.website
  if (updates.logoUrl !== undefined) updateData.logo_url = updates.logoUrl
  if (updates.city !== undefined) updateData.city = updates.city
  if (updates.state !== undefined) updateData.state = updates.state
  if (updates.country !== undefined) updateData.country = updates.country

  const { error } = await supabase.from("partners").update(updateData).eq("id", partnerId)
  if (error) return { ok: false, error: "Update failed" }

  const ctx: AuditContext = { actorType: actor.type, actorId: actor.id }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_PROFILE_UPDATED,
    entityType: AUDIT_ENTITIES.PARTNER,
    entityId: partnerId,
    metadata: { updatedFields: Object.keys(updates) },
  })

  return { ok: true }
}

/* ───────────────────────────  Capabilities  ─────────────────────────── */

export async function seedPartnerCapabilities(
  partnerId: string,
  partnerType: PartnerType,
  grantedBy?: string
): Promise<void> {
  if (!isSupabaseConfigured()) return
  const caps = PARTNER_TYPE_DEFAULT_CAPABILITIES[partnerType] || []
  const rows = caps.map((cap) => ({
    partner_id: partnerId,
    capability: cap,
    enabled: true,
    granted_at: now(),
    granted_by: grantedBy ?? null,
    created_at: now(),
    updated_at: now(),
  }))
  if (rows.length > 0) {
    await supabase.from("partner_capabilities").upsert(rows, { onConflict: "partner_id,capability" })
  }
}

export async function listPartnerCapabilities(
  partnerId: string
): Promise<PartnerOrgCapability[]> {
  if (!isSupabaseConfigured()) return []
  const t = now()
  const { data, error } = await supabase
    .from("partner_capabilities")
    .select("capability")
    .eq("partner_id", partnerId)
    .eq("enabled", true)
    .or(`expires_at.is.null,expires_at.gt.${t}`)
  if (error || !data) return []
  return (data as { capability: PartnerOrgCapability }[]).map((d) => d.capability)
}

export async function grantPartnerCapability(
  partnerId: string,
  capability: PartnerOrgCapability,
  grantedBy: string,
  expiresAt?: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { error } = await supabase.from("partner_capabilities").upsert(
    {
      partner_id: partnerId,
      capability,
      enabled: true,
      granted_at: now(),
      granted_by: grantedBy,
      expires_at: expiresAt ?? null,
      created_at: now(),
      updated_at: now(),
    },
    { onConflict: "partner_id,capability" }
  )

  if (error) return { ok: false, error: "Failed to grant capability" }

  const ctx: AuditContext = { actorType: "ADMIN", actorId: grantedBy }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_CAPABILITY_GRANTED,
    entityType: AUDIT_ENTITIES.PARTNER_CAPABILITY,
    entityId: partnerId,
    metadata: { capability, expiresAt },
  })

  return { ok: true }
}

export async function revokePartnerCapability(
  partnerId: string,
  capability: PartnerOrgCapability,
  revokedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { error } = await supabase
    .from("partner_capabilities")
    .update({ enabled: false, updated_at: now() })
    .eq("partner_id", partnerId)
    .eq("capability", capability)

  if (error) return { ok: false, error: "Failed to revoke capability" }

  const ctx: AuditContext = { actorType: "ADMIN", actorId: revokedBy }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_CAPABILITY_REVOKED,
    entityType: AUDIT_ENTITIES.PARTNER_CAPABILITY,
    entityId: partnerId,
    metadata: { capability },
  })

  return { ok: true }
}

/* ───────────────────────────  Profile update requests  ─────────────────────────── */

export async function submitPartnerProfileUpdateRequest(
  partnerId: string,
  requestedBy: string,
  changes: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { error } = await supabase.from("partner_profile_update_requests").insert({
    partner_id: partnerId,
    requested_by: requestedBy,
    changes,
    status: "PENDING",
    created_at: now(),
    updated_at: now(),
  })

  if (error) return { ok: false, error: "Failed to submit request" }
  return { ok: true }
}

export async function listPartnerProfileUpdateRequests(
  partnerId: string,
  status?: "PENDING" | "APPROVED" | "REJECTED"
): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase.from("partner_profile_update_requests").select("*").eq("partner_id", partnerId)
  if (status) q = q.eq("status", status)
  const { data, error } = await q.order("created_at", { ascending: false })
  if (error || !data) return []
  return data as Record<string, unknown>[]
}

export async function approvePartnerProfileUpdateRequest(
  requestId: string,
  approvedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: req, error } = await supabase
    .from("partner_profile_update_requests")
    .select("*")
    .eq("id", requestId)
    .single()

  if (error || !req) return { ok: false, error: "Request not found" }
  if ((req.status as string) !== "PENDING") return { ok: false, error: "Request already processed" }

  const changes = (req.changes as Record<string, unknown>) || {}
  const updateData: Record<string, unknown> = { updated_at: now() }
  const fieldMap: Record<string, string> = {
    publicEmail: "public_email",
    publicPhone: "public_phone",
    website: "website",
    logoUrl: "logo_url",
    city: "city",
    state: "state",
    country: "country",
    displayName: "display_name",
  }
  for (const [k, dbKey] of Object.entries(fieldMap)) {
    if (changes[k] !== undefined) updateData[dbKey] = changes[k]
  }

  await supabase.from("partners").update(updateData).eq("id", req.partner_id as string)
  await supabase
    .from("partner_profile_update_requests")
    .update({ status: "APPROVED", reviewed_by: approvedBy, reviewed_at: now(), updated_at: now() })
    .eq("id", requestId)

  const ctx: AuditContext = { actorType: "ADMIN", actorId: approvedBy }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_PROFILE_UPDATED,
    entityType: AUDIT_ENTITIES.PARTNER_PROFILE_UPDATE_REQUEST,
    entityId: requestId,
    metadata: { partnerId: req.partner_id, changes },
  })

  return { ok: true }
}

export async function rejectPartnerProfileUpdateRequest(
  requestId: string,
  rejectedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { error } = await supabase
    .from("partner_profile_update_requests")
    .update({ status: "REJECTED", reviewed_by: rejectedBy, reviewed_at: now(), updated_at: now() })
    .eq("id", requestId)

  if (error) return { ok: false, error: "Failed to reject request" }
  return { ok: true }
}

/* ───────────────────────────  Compliance documents  ─────────────────────────── */

export async function listPartnerComplianceDocuments(
  partnerId: string
): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("partner_documents")
    .select("id, document_type, verification_status, uploaded_at, storage_path, original_filename, mime_type, file_size, notes")
    .eq("partner_id", partnerId)
    .order("uploaded_at", { ascending: false })
  if (error || !data) return []
  return data as Record<string, unknown>[]
}

export async function requestComplianceDocument(
  partnerId: string,
  documentType: string,
  requestedBy: string
): Promise<{ ok: boolean; error?: string; doc?: Record<string, unknown> }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data, error } = await supabase
    .from("partner_documents")
    .insert({
      partner_id: partnerId,
      document_type: documentType,
      verification_status: "REQUESTED",
      storage_path: "",
      original_filename: "",
      mime_type: "",
      file_size: 0,
      requested_by: requestedBy,
      uploaded_at: now(),
    })
    .select()
    .single()

  if (error || !data) return { ok: false, error: "Failed to request document" }
  return { ok: true, doc: data }
}

export async function submitComplianceDocument(
  docId: string,
  partnerUserId: string,
  file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: doc, error } = await supabase
    .from("partner_documents")
    .select("*, partners(id)")
    .eq("id", docId)
    .single()

  if (error || !doc) return { ok: false, error: "Document not found" }
  if ((doc.verification_status as string) === "VERIFIED" || (doc.verification_status as string) === "REJECTED") {
    return { ok: false, error: "Document already reviewed" }
  }

  const partnerId = doc.partner_id as string
  const fileBytes = await file.arrayBuffer()

  const validation = validatePartnerFile({ type: file.type, size: fileBytes.byteLength })
  if (validation) return { ok: false, error: validation }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "document"
  const storagePath = `${partnerId}/compliance/${docId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase
    .storage
    .from(PARTNER_DOCUMENTS_BUCKET)
    .upload(storagePath, fileBytes, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error("[partner-compliance] upload failed:", uploadError.message)
    return { ok: false, error: "Failed to upload document" }
  }

  await supabase
    .from("partner_documents")
    .update({
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type,
      file_size: fileBytes.byteLength,
      verification_status: "SUBMITTED",
      uploaded_at: now(),
      requested_by: doc.requested_by || partnerUserId,
    })
    .eq("id", docId)

  const ctx: AuditContext = { actorType: "PARTNER", actorId: partnerUserId }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_COMPLIANCE_DOCUMENT_SUBMITTED,
    entityType: AUDIT_ENTITIES.PARTNER_DOCUMENT,
    entityId: docId,
    metadata: { partnerId, storagePath },
  })

  return { ok: true }
}

export async function createSignedComplianceDocUrl(
  storagePath: string
): Promise<string | null> {
  return createSignedDocUrl(storagePath, 300) // 5 minutes
}

/* ───────────────────────────  Resources  ─────────────────────────── */

export interface ResourceInput {
  title: string
  description?: string
  category: string
  fileUrl?: string
  storagePath?: string
  externalUrl?: string
  visibility: "ALL" | "TYPES" | "CAPABILITIES"
  allowedPartnerTypes?: PartnerType[]
  allowedCapabilities?: PartnerOrgCapability[]
  active?: boolean
  publishedAt?: string | null
}

export async function listAllPartnerResources(): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("partner_resources")
    .select("*")
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return data as Record<string, unknown>[]
}

export async function listPartnerResourcesForPartner(
  partnerType: PartnerType,
  capabilities: PartnerOrgCapability[]
): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("partner_resources")
    .select("*")
    .eq("active", true)
    .lte("published_at", now())
    .or("published_at.is.null")
    .order("created_at", { ascending: false })

  if (error || !data) return []

  return (data as Record<string, unknown>[]).filter((r) => {
    const visibility = r.visibility as string
    if (visibility === "ALL") return true
    if (visibility === "TYPES") {
      const allowed = (r.allowed_partner_types as string[]) || []
      return allowed.includes(partnerType)
    }
    if (visibility === "CAPABILITIES") {
      const allowed = (r.allowed_capabilities as string[]) || []
      return capabilities.some((c) => allowed.includes(c))
    }
    return false
  })
}

export async function createPartnerResource(
  input: ResourceInput,
  createdBy: string
): Promise<{ ok: boolean; error?: string; resource?: Record<string, unknown> }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data, error } = await supabase
    .from("partner_resources")
    .insert({
      title: input.title,
      description: input.description ?? "",
      category: input.category,
      file_url: input.fileUrl ?? null,
      storage_path: input.storagePath ?? null,
      external_url: input.externalUrl ?? null,
      visibility: input.visibility,
      allowed_partner_types: input.allowedPartnerTypes ?? [],
      allowed_capabilities: input.allowedCapabilities ?? [],
      active: input.active ?? true,
      published_at: input.publishedAt ?? null,
      created_by: createdBy,
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single()

  if (error || !data) return { ok: false, error: "Failed to create resource" }

  const ctx: AuditContext = { actorType: "ADMIN", actorId: createdBy }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_RESOURCE_CREATED,
    entityType: AUDIT_ENTITIES.PARTNER_RESOURCE,
    entityId: data.id as string,
    metadata: { title: input.title, category: input.category },
  })

  return { ok: true, resource: data }
}

export async function updatePartnerResource(
  id: string,
  input: Partial<ResourceInput>,
  updatedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const updateData: Record<string, unknown> = { updated_at: now() }
  if (input.title !== undefined) updateData.title = input.title
  if (input.description !== undefined) updateData.description = input.description
  if (input.category !== undefined) updateData.category = input.category
  if (input.fileUrl !== undefined) updateData.file_url = input.fileUrl
  if (input.storagePath !== undefined) updateData.storage_path = input.storagePath
  if (input.externalUrl !== undefined) updateData.external_url = input.externalUrl
  if (input.visibility !== undefined) updateData.visibility = input.visibility
  if (input.allowedPartnerTypes !== undefined) updateData.allowed_partner_types = input.allowedPartnerTypes
  if (input.allowedCapabilities !== undefined) updateData.allowed_capabilities = input.allowedCapabilities
  if (input.active !== undefined) updateData.active = input.active
  if (input.publishedAt !== undefined) updateData.published_at = input.publishedAt

  const { error } = await supabase.from("partner_resources").update(updateData).eq("id", id)
  if (error) return { ok: false, error: "Failed to update resource" }

  const ctx: AuditContext = { actorType: "ADMIN", actorId: updatedBy }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_RESOURCE_UPDATED,
    entityType: AUDIT_ENTITIES.PARTNER_RESOURCE,
    entityId: id,
    metadata: { updatedFields: Object.keys(updateData).filter((k) => k !== "updated_at") },
  })

  return { ok: true }
}

export async function deletePartnerResource(
  id: string,
  deletedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { error } = await supabase.from("partner_resources").delete().eq("id", id)
  if (error) return { ok: false, error: "Failed to delete resource" }

  const ctx: AuditContext = { actorType: "ADMIN", actorId: deletedBy }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_RESOURCE_DELETED,
    entityType: AUDIT_ENTITIES.PARTNER_RESOURCE,
    entityId: id,
    metadata: {},
  })

  return { ok: true }
}

export async function getSignedResourceUrl(
  resource: Record<string, unknown>
): Promise<string | null> {
  if (resource.storage_path && typeof resource.storage_path === "string") {
    return createSignedDocUrl(resource.storage_path, 300)
  }
  if (resource.file_url && typeof resource.file_url === "string") return resource.file_url
  if (resource.external_url && typeof resource.external_url === "string") return resource.external_url
  return null
}

/* ───────────────────────────  Customer assignments  ─────────────────────────── */

export interface AssignmentInput {
  partnerId: string
  businessId: string
  relationshipType: "REFERRED" | "SOLD" | "IMPLEMENTATION" | "SUPPORT" | "ACCOUNT_MANAGER"
  accessLevel: AccessLevel
  assignedBy: string
  startsAt?: string | null
  expiresAt?: string | null
  notes?: string
}

export async function createPartnerCustomerAssignment(
  input: AssignmentInput
): Promise<{ ok: boolean; error?: string; assignment?: Record<string, unknown> }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data, error } = await supabase
    .from("partner_customer_assignments")
    .insert({
      partner_id: input.partnerId,
      business_id: input.businessId,
      relationship_type: input.relationshipType,
      access_level: input.accessLevel,
      assigned_by: input.assignedBy,
      starts_at: input.startsAt ?? null,
      expires_at: input.expiresAt ?? null,
      notes: input.notes ?? null,
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single()

  if (error || !data) return { ok: false, error: "Failed to create assignment" }

  const ctx: AuditContext = { actorType: "ADMIN", actorId: input.assignedBy }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_CUSTOMER_ASSIGNED,
    entityType: AUDIT_ENTITIES.PARTNER_CUSTOMER_ASSIGNMENT,
    entityId: data.id as string,
    metadata: {
      partnerId: input.partnerId,
      businessId: input.businessId,
      relationshipType: input.relationshipType,
      accessLevel: input.accessLevel,
    },
  })

  return { ok: true, assignment: data }
}

export async function revokePartnerCustomerAssignment(
  assignmentId: string,
  revokedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: current, error } = await supabase
    .from("partner_customer_assignments")
    .select("*")
    .eq("id", assignmentId)
    .single()

  if (error || !current) return { ok: false, error: "Assignment not found" }

  await supabase
    .from("partner_customer_assignments")
    .update({ status: "REVOKED", revoked_at: now(), revoked_by: revokedBy, updated_at: now() })
    .eq("id", assignmentId)

  const ctx: AuditContext = { actorType: "ADMIN", actorId: revokedBy }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_CUSTOMER_ASSIGNMENT_REVOKED,
    entityType: AUDIT_ENTITIES.PARTNER_CUSTOMER_ASSIGNMENT,
    entityId: assignmentId,
    metadata: {
      partnerId: current.partner_id,
      businessId: current.business_id,
      relationshipType: current.relationship_type,
    },
  })

  return { ok: true }
}

export async function listPartnerCustomerAssignments(
  partnerId: string
): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("partner_customer_assignments")
    .select("*, businesses(*)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return data as Record<string, unknown>[]
}

/* ───────────────────────────  Activity feed  ─────────────────────────── */

export async function getPartnerActivity(partnerId: string, limit = 50): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .or(`entity_id.eq.${partnerId},metadata->>partnerId.eq.${partnerId}`)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as Record<string, unknown>[]
}
