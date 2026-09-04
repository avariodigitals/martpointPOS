import { supabase, isSupabaseConfigured } from "./supabase"
import type { SessionPayload } from "./admin-types"

/* ───────────────────────────  Audit Logger  ───────────────────────────
 * Server-side only. Never rely on client-side logging.
 * Writes to the audit_logs table via the service role client.
 */

export type ActorType = "ADMIN" | "SYSTEM" | "PARTNER"

export interface AuditContext {
  actorType: ActorType
  actorId?: string | null
  actorName?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface AuditEntry {
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown> | null
}

/** Build an audit context from an admin session and request headers. */
export function auditContextFromSession(
  session: SessionPayload | null,
  request?: Request
): AuditContext {
  const headers = request?.headers
  const forwarded = headers?.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : headers?.get("cf-connecting-ip") || null
  return {
    actorType: session ? "ADMIN" : "SYSTEM",
    actorId: session?.userId ?? null,
    actorName: session?.name ?? session?.username ?? null,
    ipAddress: ip,
    userAgent: headers?.get("user-agent") || null,
  }
}

/**
 * Record a single audit event. Failures are logged but never throw,
 * so audit logging cannot break the calling business operation.
 */
export async function recordAudit(
  ctx: AuditContext,
  entry: AuditEntry
): Promise<void> {
  try {
    if (!isSupabaseConfigured()) return
    const { error } = await supabase.from("audit_logs").insert({
      actor_type: ctx.actorType,
      actor_id: ctx.actorId ?? null,
      actor_name: ctx.actorName ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
      ip_address: ctx.ipAddress ?? null,
      user_agent: ctx.userAgent ?? null,
    })
    if (error) {
      console.error("[audit] insert failed:", error.message)
    }
  } catch (err) {
    console.error("[audit] unexpected error:", err)
  }
}

/** Record multiple audit events in one insert. */
export async function recordAuditBatch(
  ctx: AuditContext,
  entries: AuditEntry[]
): Promise<void> {
  if (entries.length === 0) return
  try {
    if (!isSupabaseConfigured()) return
    const rows = entries.map((entry) => ({
      actor_type: ctx.actorType,
      actor_id: ctx.actorId ?? null,
      actor_name: ctx.actorName ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
      ip_address: ctx.ipAddress ?? null,
      user_agent: ctx.userAgent ?? null,
    }))
    const { error } = await supabase.from("audit_logs").insert(rows)
    if (error) console.error("[audit] batch insert failed:", error.message)
  } catch (err) {
    console.error("[audit] unexpected error:", err)
  }
}

/** Build an audit context from a partner session and request headers. */
export function auditContextFromPartnerSession(
  session: { partnerUserId: string; partnerId: string; role: string; name?: string | null } | null,
  request?: Request
): AuditContext {
  const headers = request?.headers
  const forwarded = headers?.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : headers?.get("cf-connecting-ip") || null
  return {
    actorType: session ? "PARTNER" : "SYSTEM",
    actorId: session?.partnerUserId ?? null,
    actorName: session?.name ?? null,
    ipAddress: ip,
    userAgent: headers?.get("user-agent") || null,
  }
}

/* ───────────────────────────  Canonical Actions  ─────────────────────────── */
export const AUDIT_ACTIONS = {
  BUSINESS_CREATED: "BUSINESS_CREATED",
  BUSINESS_UPDATED: "BUSINESS_UPDATED",
  PARTNER_APPLICATION_SUBMITTED: "PARTNER_APPLICATION_SUBMITTED",
  PARTNER_APPLICATION_STATUS_CHANGED: "PARTNER_APPLICATION_STATUS_CHANGED",
  PARTNER_APPLICATION_INFORMATION_REQUESTED: "PARTNER_APPLICATION_INFORMATION_REQUESTED",
  PARTNER_CREATED: "PARTNER_CREATED",
  PARTNER_UPDATED: "PARTNER_UPDATED",
  PARTNER_ACTIVATED: "PARTNER_ACTIVATED",
  PARTNER_SUSPENDED: "PARTNER_SUSPENDED",
  PARTNER_REJECTED: "PARTNER_REJECTED",
  PARTNER_DOCUMENT_ACCESSED: "PARTNER_DOCUMENT_ACCESSED",
  ADMIN_USER_CREATED: "ADMIN_USER_CREATED",
  ADMIN_USER_UPDATED: "ADMIN_USER_UPDATED",
  ADMIN_USER_DISABLED: "ADMIN_USER_DISABLED",
  PARTNER_USER_INVITED: "PARTNER_USER_INVITED",
  PARTNER_USER_INVITATION_RESENT: "PARTNER_USER_INVITATION_RESENT",
  PARTNER_USER_INVITATION_REVOKED: "PARTNER_USER_INVITATION_REVOKED",
  PARTNER_USER_ACTIVATED: "PARTNER_USER_ACTIVATED",
  PARTNER_USER_LOGIN: "PARTNER_USER_LOGIN",
  PARTNER_USER_LOGIN_FAILED: "PARTNER_USER_LOGIN_FAILED",
  PARTNER_USER_LOGOUT: "PARTNER_USER_LOGOUT",
  PARTNER_USER_SUSPENDED: "PARTNER_USER_SUSPENDED",
  PARTNER_USER_DISABLED: "PARTNER_USER_DISABLED",
  PARTNER_CAPABILITY_GRANTED: "PARTNER_CAPABILITY_GRANTED",
  PARTNER_CAPABILITY_REVOKED: "PARTNER_CAPABILITY_REVOKED",
  PARTNER_CUSTOMER_ASSIGNED: "PARTNER_CUSTOMER_ASSIGNED",
  PARTNER_CUSTOMER_ASSIGNMENT_REVOKED: "PARTNER_CUSTOMER_ASSIGNMENT_REVOKED",
  PARTNER_PROFILE_UPDATED: "PARTNER_PROFILE_UPDATED",
  PARTNER_COMPLIANCE_DOCUMENT_SUBMITTED: "PARTNER_COMPLIANCE_DOCUMENT_SUBMITTED",
  PARTNER_RESOURCE_CREATED: "PARTNER_RESOURCE_CREATED",
  PARTNER_RESOURCE_UPDATED: "PARTNER_RESOURCE_UPDATED",
  PARTNER_RESOURCE_DELETED: "PARTNER_RESOURCE_DELETED",
  PARTNER_LEAD_REGISTERED: "PARTNER_LEAD_REGISTERED",
  PARTNER_LEAD_UPDATED: "PARTNER_LEAD_UPDATED",
  PARTNER_LEAD_PROTECTION_APPROVED: "PARTNER_LEAD_PROTECTION_APPROVED",
  PARTNER_LEAD_PROTECTION_REJECTED: "PARTNER_LEAD_PROTECTION_REJECTED",
  PARTNER_LEAD_PROTECTION_EXTENDED: "PARTNER_LEAD_PROTECTION_EXTENDED",
  PARTNER_LEAD_PROTECTION_EXPIRED: "PARTNER_LEAD_PROTECTION_EXPIRED",
  PARTNER_LEAD_LINKED_TO_CRM: "PARTNER_LEAD_LINKED_TO_CRM",
  PARTNER_LEAD_WON: "PARTNER_LEAD_WON",
  PARTNER_LEAD_LOST: "PARTNER_LEAD_LOST",
  BUSINESS_PARTNER_ATTRIBUTION_SET: "BUSINESS_PARTNER_ATTRIBUTION_SET",
  PARTNER_CUSTOMER_VIEWED: "PARTNER_CUSTOMER_VIEWED",
  PARTNER_ONBOARDING_STARTED: "PARTNER_ONBOARDING_STARTED",
  PARTNER_ONBOARDING_TASK_UPDATED: "PARTNER_ONBOARDING_TASK_UPDATED",
  PARTNER_ONBOARDING_COMPLETED: "PARTNER_ONBOARDING_COMPLETED",
  PARTNER_ONBOARDING_REOPENED: "PARTNER_ONBOARDING_REOPENED",
  PARTNER_ONBOARDING_VERIFIED: "PARTNER_ONBOARDING_VERIFIED",
  CUSTOMER_TRAINING_RECORDED: "CUSTOMER_TRAINING_RECORDED",
  BUSINESS_ENTITLEMENT_UPDATED: "BUSINESS_ENTITLEMENT_UPDATED",
  BUSINESS_DEPLOYMENT_STATUS_UPDATED: "BUSINESS_DEPLOYMENT_STATUS_UPDATED",
} as const

export const AUDIT_ENTITIES = {
  BUSINESS: "business",
  PARTNER_APPLICATION: "partner_application",
  PARTNER: "partner",
  PARTNER_DOCUMENT: "partner_document",
  ADMIN_USER: "admin_user",
  PARTNER_USER: "partner_user",
  PARTNER_INVITATION: "partner_invitation",
  PARTNER_CAPABILITY: "partner_capability",
  PARTNER_CUSTOMER_ASSIGNMENT: "partner_customer_assignment",
  PARTNER_RESOURCE: "partner_resource",
  PARTNER_PROFILE_UPDATE_REQUEST: "partner_profile_update_request",
  PARTNER_LEAD: "partner_lead",
  PARTNER_ONBOARDING_TASK: "partner_onboarding_task",
  CUSTOMER_TRAINING_RECORD: "customer_training_record",
  BUSINESS_ENTITLEMENT: "business_entitlement",
  BUSINESS_DEPLOYMENT: "business_deployment",
} as const
