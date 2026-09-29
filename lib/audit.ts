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
  BUSINESS_DELETED: "BUSINESS_DELETED",
  PARTNER_APPLICATION_SUBMITTED: "PARTNER_APPLICATION_SUBMITTED",
  PARTNER_APPLICATION_STATUS_CHANGED: "PARTNER_APPLICATION_STATUS_CHANGED",
  PARTNER_APPLICATION_INFORMATION_REQUESTED: "PARTNER_APPLICATION_INFORMATION_REQUESTED",
  PARTNER_APPLICATION_NOTE_ADDED: "PARTNER_APPLICATION_NOTE_ADDED",
  PARTNER_CREATED: "PARTNER_CREATED",
  PARTNER_UPDATED: "PARTNER_UPDATED",
  PARTNER_ACTIVATED: "PARTNER_ACTIVATED",
  PARTNER_SUSPENDED: "PARTNER_SUSPENDED",
  PARTNER_REJECTED: "PARTNER_REJECTED",
  PARTNER_AGREEMENT_GENERATED: "PARTNER_AGREEMENT_GENERATED",
  PARTNER_DOCUMENT_ACCESSED: "PARTNER_DOCUMENT_ACCESSED",
  PARTNER_DOCUMENT_GENERATED: "PARTNER_DOCUMENT_GENERATED",
  PARTNER_DOCUMENT_ACKNOWLEDGED: "PARTNER_DOCUMENT_ACKNOWLEDGED",
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
  PARTNER_BRANDING_REQUEST_FULFILLED: "PARTNER_BRANDING_REQUEST_FULFILLED",
  PARTNER_LEAD_REGISTERED: "PARTNER_LEAD_REGISTERED",
  PARTNER_LEAD_UPDATED: "PARTNER_LEAD_UPDATED",
  PARTNER_LEAD_PROTECTION_APPROVED: "PARTNER_LEAD_PROTECTION_APPROVED",
  PARTNER_LEAD_PROTECTION_REJECTED: "PARTNER_LEAD_PROTECTION_REJECTED",
  PARTNER_LEAD_PROTECTION_EXTENDED: "PARTNER_LEAD_PROTECTION_EXTENDED",
  PARTNER_LEAD_PROTECTION_EXPIRED: "PARTNER_LEAD_PROTECTION_EXPIRED",
  PARTNER_LEAD_LINKED_TO_CRM: "PARTNER_LEAD_LINKED_TO_CRM",
  PARTNER_LEAD_WON: "PARTNER_LEAD_WON",
  PARTNER_LEAD_LOST: "PARTNER_LEAD_LOST",
  PARTNER_PROSPECT_CREATED: "PARTNER_PROSPECT_CREATED",
  PARTNER_PROSPECT_UPDATED: "PARTNER_PROSPECT_UPDATED",
  PARTNER_PROSPECT_INVITED: "PARTNER_PROSPECT_INVITED",
  PARTNER_PROSPECT_DELETED: "PARTNER_PROSPECT_DELETED",
  PARTNER_PAYOUT_REQUESTED: "PARTNER_PAYOUT_REQUESTED",
  PARTNER_PAYOUT_REQUEST_REVIEWED: "PARTNER_PAYOUT_REQUEST_REVIEWED",
  BUSINESS_PARTNER_ATTRIBUTION_SET: "BUSINESS_PARTNER_ATTRIBUTION_SET",
  PARTNER_CUSTOMER_VIEWED: "PARTNER_CUSTOMER_VIEWED",
  PARTNER_ONBOARDING_STARTED: "PARTNER_ONBOARDING_STARTED",
  PARTNER_ONBOARDING_TASK_UPDATED: "PARTNER_ONBOARDING_TASK_UPDATED",
  PARTNER_ONBOARDING_COMPLETED: "PARTNER_ONBOARDING_COMPLETED",
  PARTNER_ONBOARDING_REOPENED: "PARTNER_ONBOARDING_REOPENED",
  PARTNER_ONBOARDING_VERIFIED: "PARTNER_ONBOARDING_VERIFIED",
  PARTNER_HANDOVER_EMAIL_SENT: "PARTNER_HANDOVER_EMAIL_SENT",
  CUSTOMER_TRAINING_RECORDED: "CUSTOMER_TRAINING_RECORDED",
  BUSINESS_ENTITLEMENT_UPDATED: "BUSINESS_ENTITLEMENT_UPDATED",
  BUSINESS_DEPLOYMENT_STATUS_UPDATED: "BUSINESS_DEPLOYMENT_STATUS_UPDATED",
  LEAD_UPDATED: "LEAD_UPDATED",
  QUESTIONNAIRE_SENT: "QUESTIONNAIRE_SENT",
  QUESTIONNAIRE_SUBMITTED: "QUESTIONNAIRE_SUBMITTED",
  CAREER_VACANCY_CREATED: "CAREER_VACANCY_CREATED",
  CAREER_VACANCY_UPDATED: "CAREER_VACANCY_UPDATED",
  CAREER_VACANCY_PUBLISHED: "CAREER_VACANCY_PUBLISHED",
  CAREER_VACANCY_STATUS_CHANGED: "CAREER_VACANCY_STATUS_CHANGED",
  CAREER_VACANCY_DUPLICATED: "CAREER_VACANCY_DUPLICATED",
  CAREER_APPLICATION_SUBMITTED: "CAREER_APPLICATION_SUBMITTED",
  CAREER_APPLICATION_STATUS_CHANGED: "CAREER_APPLICATION_STATUS_CHANGED",
  CAREER_APPLICATION_OFFER_SENT: "CAREER_APPLICATION_OFFER_SENT",
  CAREER_APPLICATION_NOTE_ADDED: "CAREER_APPLICATION_NOTE_ADDED",
  CAREER_APPLICATION_DELETED: "CAREER_APPLICATION_DELETED",
  CAREER_APPLICATIONS_EXPORTED: "CAREER_APPLICATIONS_EXPORTED",
  CAREER_DOCUMENT_ACCESSED: "CAREER_DOCUMENT_ACCESSED",
  CAREER_CANDIDATE_CREATED: "CAREER_CANDIDATE_CREATED",
  CAREER_CANDIDATE_UPDATED: "CAREER_CANDIDATE_UPDATED",
  CAREER_ASSESSMENT_CREATED: "CAREER_ASSESSMENT_CREATED",
  CAREER_ASSESSMENT_SCORED: "CAREER_ASSESSMENT_SCORED",
  CAREER_DEPLOYMENT_CREATED: "CAREER_DEPLOYMENT_CREATED",
  CAREER_DEPLOYMENT_UPDATED: "CAREER_DEPLOYMENT_UPDATED",
  PARTNER_WORK_ORDER_CREATED: "PARTNER_WORK_ORDER_CREATED",
  PARTNER_WORK_ORDER_ISSUED: "PARTNER_WORK_ORDER_ISSUED",
  PARTNER_WORK_ORDER_ACCEPTED: "PARTNER_WORK_ORDER_ACCEPTED",
  PARTNER_WORK_ORDER_STARTED: "PARTNER_WORK_ORDER_STARTED",
  PARTNER_WORK_ORDER_CLOSED: "PARTNER_WORK_ORDER_CLOSED",
  PARTNER_MILESTONE_SUBMITTED: "PARTNER_MILESTONE_SUBMITTED",
  PARTNER_MILESTONE_ACCEPTED: "PARTNER_MILESTONE_ACCEPTED",
  PARTNER_MILESTONE_REJECTED: "PARTNER_MILESTONE_REJECTED",
  PARTNER_CHANGE_ORDER_REQUESTED: "PARTNER_CHANGE_ORDER_REQUESTED",
  PARTNER_CHANGE_ORDER_DECIDED: "PARTNER_CHANGE_ORDER_DECIDED",
  PARTNER_QUOTE_REQUEST_CREATED: "PARTNER_QUOTE_REQUEST_CREATED",
  PARTNER_QUOTE_REQUEST_DECIDED: "PARTNER_QUOTE_REQUEST_DECIDED",
  PARTNER_CERTIFICATION_UPDATED: "PARTNER_CERTIFICATION_UPDATED",
  PARTNER_CERTIFICATION_EXPIRED: "PARTNER_CERTIFICATION_EXPIRED",
  PARTNER_COMMISSION_ELIGIBILITY_EVALUATED: "PARTNER_COMMISSION_ELIGIBILITY_EVALUATED",
  CAREER_ROLE_TEMPLATE_CREATED: "CAREER_ROLE_TEMPLATE_CREATED",
  CAREER_ROLE_TEMPLATE_UPDATED: "CAREER_ROLE_TEMPLATE_UPDATED",
  CAREER_ROLE_TEMPLATE_ARCHIVED: "CAREER_ROLE_TEMPLATE_ARCHIVED",
  CAREER_COMMISSION_RECORDED: "CAREER_COMMISSION_RECORDED",
  CAREER_COMMISSION_APPROVED: "CAREER_COMMISSION_APPROVED",
  CAREER_COMMISSION_REJECTED: "CAREER_COMMISSION_REJECTED",
  CAREER_COMMISSION_PAID: "CAREER_COMMISSION_PAID",
  CAREER_COMMISSION_REVERSED: "CAREER_COMMISSION_REVERSED",
  CAREER_PIPELINE_HANDOVER_RECORDED: "CAREER_PIPELINE_HANDOVER_RECORDED",
  CAREER_PIPELINE_HANDOVER_UPDATED: "CAREER_PIPELINE_HANDOVER_UPDATED",
  CAREER_PIPELINE_STAGE_OWNER_UPDATED: "CAREER_PIPELINE_STAGE_OWNER_UPDATED",
} as const

export const AUDIT_ENTITIES = {
  BUSINESS: "business",
  PARTNER_APPLICATION: "partner_application",
  PARTNER: "partner",
  PARTNER_DOCUMENT: "partner_document",
  PARTNER_GENERATED_DOCUMENT: "partner_generated_document",
  ADMIN_USER: "admin_user",
  PARTNER_USER: "partner_user",
  PARTNER_INVITATION: "partner_invitation",
  PARTNER_CAPABILITY: "partner_capability",
  PARTNER_CUSTOMER_ASSIGNMENT: "partner_customer_assignment",
  PARTNER_RESOURCE: "partner_resource",
  PARTNER_BRANDING_REQUEST: "partner_branding_request",
  PARTNER_PROFILE_UPDATE_REQUEST: "partner_profile_update_request",
  PARTNER_LEAD: "partner_lead",
  PARTNER_PAYOUT_REQUEST: "partner_payout_request",
  PARTNER_ONBOARDING_TASK: "partner_onboarding_task",
  CUSTOMER_TRAINING_RECORD: "customer_training_record",
  BUSINESS_ENTITLEMENT: "business_entitlement",
  BUSINESS_DEPLOYMENT: "business_deployment",
  LEAD: "lead",
  QUESTIONNAIRE: "questionnaire",
  CAREER_VACANCY: "career_vacancy",
  CAREER_APPLICATION: "career_application",
  CAREER_CANDIDATE: "career_candidate",
  CAREER_ASSESSMENT: "career_assessment",
  CAREER_DEPLOYMENT: "career_deployment",
  PARTNER_WORK_ORDER: "partner_work_order",
  PARTNER_WORK_ORDER_MILESTONE: "partner_work_order_milestone",
  PARTNER_CHANGE_ORDER: "partner_change_order",
  PARTNER_QUOTE_REQUEST: "partner_quote_request",
  PARTNER_CERTIFICATION: "partner_certification",
  PARTNER_COMMISSION: "partner_commission",
  CAREER_ROLE_TEMPLATE: "career_role_template",
  CAREER_COMMISSION: "career_commission",
  CAREER_PIPELINE_HANDOVER: "career_pipeline_handover",
  CAREER_PIPELINE_STAGE: "career_pipeline_stage",
} as const
