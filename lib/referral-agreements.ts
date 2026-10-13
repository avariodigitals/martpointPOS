/* ───────────────────────────  Agreements & Commission Schedules  ───────────────────────────
 * Workflow rows for the Referral Partner Agreement and the Referral Commission
 * Schedule. The signed schedule is the single source of truth for rates,
 * protection, holding and payout timing — engine code reads it, never
 * hard-codes a partner-specific number.
 */

import crypto from "node:crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import { emitReferralNotification } from "./referral-notifications"
import type { ScheduleTerms } from "./referral-commission-engine"

/* ─── Statuses (approved agreement workflow) ─── */

export const AGREEMENT_STATUSES = [
  "DRAFT",
  "LEGAL_REVIEW",
  "COMMERCIAL_REVIEW",
  "APPROVED_FOR_SIGNATURE",
  "SENT_FOR_SIGNATURE",
  "PARTIALLY_SIGNED",
  "EXECUTED",
  "ACTIVE",
  "SUSPENDED",
  "SUPERSEDED",
  "TERMINATED",
  "EXPIRED",
] as const

export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number]

export type AgreementKind = "REFERRAL_PARTNER_AGREEMENT" | "REFERRAL_COMMISSION_SCHEDULE"

const AGREEMENT_TRANSITIONS: Record<AgreementStatus, AgreementStatus[]> = {
  DRAFT: ["LEGAL_REVIEW", "SUPERSEDED"],
  LEGAL_REVIEW: ["COMMERCIAL_REVIEW", "DRAFT", "SUPERSEDED"],
  COMMERCIAL_REVIEW: ["APPROVED_FOR_SIGNATURE", "LEGAL_REVIEW", "SUPERSEDED"],
  APPROVED_FOR_SIGNATURE: ["SENT_FOR_SIGNATURE", "COMMERCIAL_REVIEW", "SUPERSEDED"],
  SENT_FOR_SIGNATURE: ["PARTIALLY_SIGNED", "EXECUTED", "SUPERSEDED"],
  PARTIALLY_SIGNED: ["EXECUTED", "SUPERSEDED"],
  EXECUTED: ["ACTIVE", "SUSPENDED", "SUPERSEDED", "TERMINATED", "EXPIRED"],
  ACTIVE: ["SUSPENDED", "TERMINATED", "EXPIRED", "SUPERSEDED"],
  SUSPENDED: ["ACTIVE", "TERMINATED", "EXPIRED", "SUPERSEDED"],
  SUPERSEDED: [],
  TERMINATED: [],
  EXPIRED: [],
}

export function agreementTransitionAllowed(from: string, to: string): boolean {
  if (!(AGREEMENT_STATUSES as readonly string[]).includes(from)) return false
  if (!(AGREEMENT_STATUSES as readonly string[]).includes(to)) return false
  return AGREEMENT_TRANSITIONS[from as AgreementStatus].includes(to as AgreementStatus)
}

/** Statuses an instrument in `from` may move to next (drives the review buttons). */
export function agreementNextStatuses(from: string): AgreementStatus[] {
  if (!(AGREEMENT_STATUSES as readonly string[]).includes(from)) return []
  return AGREEMENT_TRANSITIONS[from as AgreementStatus]
}

/** Statuses that make the instrument count as signed and in force. */
export function agreementInForce(status: string): boolean {
  return status === "EXECUTED" || status === "ACTIVE"
}

/* ─── References ─── */

async function nextReference(kind: "agreement" | "schedule"): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = kind === "agreement" ? "AGR" : "MCS"
  if (!isSupabaseConfigured()) return `${prefix}-${year}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
  const rpc = kind === "agreement" ? "increment_agreement_seq" : "increment_schedule_seq"
  const { data, error } = await supabase.rpc(rpc)
  if (error || !data) return `${prefix}-${year}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
  return `${prefix}-${year}-${String(data as number).padStart(5, "0")}`
}

/* ─── Agreement rows ─── */

export interface CreateAgreementInput {
  partnerId?: string | null
  applicationId?: string | null
  kind: AgreementKind
  title: string
  documentId?: string | null
  createdBy: string | null
}

export async function createAgreementRecord(
  input: CreateAgreementInput
): Promise<{ ok: boolean; error?: string; id?: string; reference?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const reference = await nextReference("agreement")
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from("partner_agreements")
    .insert({
      reference_number: reference,
      partner_id: input.partnerId ?? null,
      application_id: input.applicationId ?? null,
      agreement_kind: input.kind,
      title: input.title,
      status: "DRAFT",
      document_id: input.documentId ?? null,
      created_by: input.createdBy,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: error?.message || "Failed to create agreement record" }
  return { ok: true, id: data.id as string, reference }
}

export async function transitionAgreement(
  agreementId: string,
  to: AgreementStatus,
  actor: { actorId?: string | null; actorName?: string | null },
  opts?: { reason?: string; patch?: Record<string, unknown> }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: current } = await supabase.from("partner_agreements").select("*").eq("id", agreementId).single()
  if (!current) return { ok: false, error: "Agreement not found" }
  const from = current.status as string
  if (!agreementTransitionAllowed(from, to)) {
    return { ok: false, error: `Invalid agreement transition: ${from} → ${to}` }
  }

  const nowIso = new Date().toISOString()
  const stamps: Record<string, unknown> = {}
  if (to === "LEGAL_REVIEW") { stamps.legal_reviewed_at = nowIso; stamps.legal_reviewed_by = actor.actorId ?? null }
  if (to === "COMMERCIAL_REVIEW") { stamps.commercial_reviewed_at = nowIso; stamps.commercial_reviewed_by = actor.actorId ?? null }
  if (to === "APPROVED_FOR_SIGNATURE") { stamps.approved_for_signature_at = nowIso; stamps.approved_for_signature_by = actor.actorId ?? null }
  if (to === "SENT_FOR_SIGNATURE") stamps.sent_for_signature_at = nowIso
  if (to === "EXECUTED") stamps.executed_at = nowIso
  if (to === "ACTIVE") stamps.activated_at = nowIso
  if (to === "SUSPENDED") stamps.suspended_at = nowIso
  if (to === "TERMINATED") stamps.terminated_at = nowIso

  const { error } = await supabase
    .from("partner_agreements")
    .update({ status: to, updated_at: nowIso, ...stamps, ...(opts?.patch || {}) })
    .eq("id", agreementId)
  if (error) return { ok: false, error: error.message }

  const ctx: AuditContext = {
    actorType: actor.actorId ? "ADMIN" : "SYSTEM",
    actorId: actor.actorId ?? undefined,
    actorName: actor.actorName ?? undefined,
  }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.REFERRAL_AGREEMENT_STATUS_CHANGED,
    entityType:
      current.agreement_kind === "REFERRAL_COMMISSION_SCHEDULE"
        ? AUDIT_ENTITIES.COMMISSION_SCHEDULE
        : AUDIT_ENTITIES.REFERRAL_AGREEMENT,
    entityId: agreementId,
    metadata: { reference: current.reference_number, from, to, reason: opts?.reason ?? null, kind: current.agreement_kind },
  })

  if (
    (to === "EXECUTED" || to === "ACTIVE") &&
    current.agreement_kind === "REFERRAL_PARTNER_AGREEMENT" &&
    current.partner_id
  ) {
    try {
      const { issueReferralAgreementDocument } = await import("./referral-documents")
      await issueReferralAgreementDocument(current.partner_id as string, agreementId, {
        id: actor.actorId || "system",
        name: actor.actorName ?? null,
        title: "Partner Operations",
      })
    } catch (err) {
      console.error("[transitionAgreement] agreement document", err)
    }
  }

  return { ok: true }
}

export async function getAgreementForPartner(
  partnerId: string,
  kind: AgreementKind
): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("partner_agreements")
    .select("*")
    .eq("partner_id", partnerId)
    .eq("agreement_kind", kind)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as Record<string, unknown> | null) ?? null
}

/** Engine gate: is there an in-force instrument of this kind right now? */
export function agreementIsActive(agreement: Record<string, unknown> | null): boolean {
  if (!agreement) return false
  return agreementInForce(agreement.status as string)
}

/* ─── Commission Schedule (signed commercial terms) ─── */

export interface ScheduleRow {
  id: string
  reference_number: string
  partner_id: string
  version: number
  status: string
  first_year_rate: string | number
  first_renewal_rate: string | number
  protection_days: number
  holding_days: number
  payout_days_after_month_end: number
  approved_split: string
  effective_from: string | null
  effective_to: string | null
}

export function scheduleTerms(row: ScheduleRow): ScheduleTerms {
  return {
    firstYearRatePercent: Number(row.first_year_rate) || 0,
    firstRenewalRatePercent: Number(row.first_renewal_rate) || 0,
    holdingDays: Number(row.holding_days) || 0,
    protectionDays: Number(row.protection_days) || 0,
    payoutDaysAfterMonthEnd: Number(row.payout_days_after_month_end) || 0,
    approvedSplit: row.approved_split || "",
  }
}

export async function createCommissionSchedule(
  partnerId: string,
  input: {
    firstYearRatePercent: number
    firstRenewalRatePercent: number
    protectionDays: number
    holdingDays: number
    payoutDaysAfterMonthEnd: number
    approvedSplit?: string
    agreementId?: string | null
    createdBy: string | null
  }
): Promise<{ ok: boolean; error?: string; id?: string; reference?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const reference = await nextReference("schedule")

  const { data: versionRow } = await supabase
    .from("partner_commission_schedules")
    .select("version")
    .eq("partner_id", partnerId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  const version = ((versionRow?.version as number) || 0) + 1

  // A new draft supersedes nothing yet — the old schedule stays in force until
  // the new one is EXECUTED and the old row is marked SUPERSEDED.
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from("partner_commission_schedules")
    .insert({
      reference_number: reference,
      partner_id: partnerId,
      agreement_id: input.agreementId ?? null,
      version,
      status: "DRAFT",
      first_year_rate: input.firstYearRatePercent,
      first_renewal_rate: input.firstRenewalRatePercent,
      protection_days: input.protectionDays,
      holding_days: input.holdingDays,
      payout_days_after_month_end: input.payoutDaysAfterMonthEnd,
      approved_split: input.approvedSplit || "",
      effective_from: null,
      created_by: input.createdBy,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: error?.message || "Failed to create schedule" }
  return { ok: true, id: data.id as string, reference }
}

export async function transitionCommissionSchedule(
  scheduleId: string,
  to: AgreementStatus,
  actor: { actorId?: string | null; actorName?: string | null },
  opts?: { reason?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: current } = await supabase.from("partner_commission_schedules").select("*").eq("id", scheduleId).single()
  if (!current) return { ok: false, error: "Schedule not found" }
  const from = current.status as string
  if (!agreementTransitionAllowed(from, to)) {
    return { ok: false, error: `Invalid schedule transition: ${from} → ${to}` }
  }

  const nowIso = new Date().toISOString()
  const patch: Record<string, unknown> = { status: to, updated_at: nowIso }
  if (to === "COMMERCIAL_REVIEW") { patch.approved_by = actor.actorId ?? null; patch.approved_at = nowIso }
  if (to === "EXECUTED" || to === "ACTIVE") {
    patch.executed_at = nowIso
    if (!current.effective_from) patch.effective_from = nowIso.split("T")[0]
  }

  const { error } = await supabase.from("partner_commission_schedules").update(patch).eq("id", scheduleId)
  if (error) return { ok: false, error: error.message }

  // Executing a new version supersedes the previous EXECUTED/ACTIVE schedule.
  if ((to === "EXECUTED" || to === "ACTIVE") && current.version > 1) {
    await supabase
      .from("partner_commission_schedules")
      .update({ status: "SUPERSEDED", superseded_by: scheduleId, updated_at: nowIso })
      .eq("partner_id", current.partner_id)
      .neq("id", scheduleId)
      .in("status", ["EXECUTED", "ACTIVE"])
  }

  await recordAudit(
    {
      actorType: actor.actorId ? "ADMIN" : "SYSTEM",
      actorId: actor.actorId ?? undefined,
      actorName: actor.actorName ?? undefined,
    } as AuditContext,
    {
      action: AUDIT_ACTIONS.REFERRAL_SCHEDULE_APPROVED,
      entityType: AUDIT_ENTITIES.COMMISSION_SCHEDULE,
      entityId: scheduleId,
      metadata: {
        reference: current.reference_number,
        partnerId: current.partner_id,
        from,
        to,
        firstYearRate: current.first_year_rate,
        firstRenewalRate: current.first_renewal_rate,
        reason: opts?.reason ?? null,
      },
    }
  )

  if (to === "EXECUTED" || to === "ACTIVE") {
    await emitReferralNotification({
      event: "AGREEMENT_OR_PAYOUT_INFO_EXPIRING",
      title: `Commission Schedule ${current.reference_number} is now in force`,
      body: `Version ${current.version} controls rates, protection, holding period and payout timing.`,
      partnerId: current.partner_id as string,
      link: "/partner/commissions",
      sourceType: "commission_schedule",
      sourceId: scheduleId,
      skipInternal: true,
    })
    // Controlled document for the signed terms. A failure here is recorded but
    // must never leave the schedule unexecuted.
    try {
      const { issueReferralScheduleDocument } = await import("./referral-documents")
      await issueReferralScheduleDocument(current.partner_id as string, scheduleId, {
        id: actor.actorId || "system",
        name: actor.actorName ?? null,
        title: "Finance and Management approval",
      })
    } catch (err) {
      console.error("[transitionCommissionSchedule] schedule document", err)
    }
  }

  return { ok: true }
}

/** The single lookup the engine uses: EXECUTED schedule in force at a date. */
export async function getActiveSchedule(
  partnerId: string,
  at?: string
): Promise<{ row: ScheduleRow | null; terms: ScheduleTerms | null }> {
  if (!isSupabaseConfigured()) return { row: null, terms: null }
  const date = (at || new Date().toISOString()).split("T")[0]
  const { data } = await supabase
    .from("partner_commission_schedules")
    .select("*")
    .eq("partner_id", partnerId)
    .in("status", ["EXECUTED", "ACTIVE"])
    .lte("effective_from", date)
    .or(`effective_to.is.null,effective_to.gte.${date}`)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return { row: null, terms: null }
  const row = data as ScheduleRow
  return { row, terms: scheduleTerms(row) }
}

/* ─── Activation gates (Referral Partner) ─── */

export interface ActivationGateInput {
  identityVerified: boolean
  applicationStatus: string
  agreementInForce: boolean
  scheduleInForce: boolean
  payoutProfileVerified: boolean
  orientationCompleted: boolean
  conductAcknowledged: boolean
}

export function referralActivationGates(input: ActivationGateInput): { ready: boolean; missing: string[] } {
  const missing: string[] = []
  if (!["APPROVED", "AGREEMENT_PENDING", "TRAINING", "CERTIFICATION_PENDING", "ACTIVE"].includes(input.applicationStatus)) {
    missing.push("application approved")
  }
  if (!input.identityVerified) missing.push("identity verification")
  if (!input.agreementInForce) missing.push("executed Referral Partner Agreement")
  if (!input.scheduleInForce) missing.push("executed Commission Schedule")
  if (!input.payoutProfileVerified) missing.push("verified payout and tax details")
  if (!input.orientationCompleted) missing.push("orientation")
  if (!input.conductAcknowledged) missing.push("conduct acknowledgement")
  return { ready: missing.length === 0, missing }
}

/**
 * Activation gates read from the records that exist, not from request input.
 * Used by the activation route so a Referral Partner cannot be brought up
 * without an executed Agreement, an executed Commission Schedule, a verified
 * payout profile, orientation and the conduct acknowledgement.
 */
export async function evaluateReferralActivationGates(opts: {
  application: Record<string, unknown>
  partnerId?: string | null
  identityVerified: boolean
}): Promise<{ ready: boolean; missing: string[] }> {
  if (!isSupabaseConfigured()) return { ready: false, missing: ["database not configured"] }
  const partnerId = opts.partnerId ?? null
  const applicationId = (opts.application.id as string) || ""

  const agreementScope = partnerId
    ? `partner_id.eq.${partnerId},application_id.eq.${applicationId}`
    : `application_id.eq.${applicationId}`

  const [{ data: agreement }, { data: schedule }, { data: profile }] = await Promise.all([
    supabase
      .from("partner_agreements")
      .select("id,status")
      .eq("agreement_kind", "REFERRAL_PARTNER_AGREEMENT")
      .in("status", ["EXECUTED", "ACTIVE"])
      .or(agreementScope)
      .limit(1)
      .maybeSingle(),
    partnerId
      ? supabase
          .from("partner_commission_schedules")
          .select("id,status")
          .eq("partner_id", partnerId)
          .in("status", ["EXECUTED", "ACTIVE"])
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    partnerId
      ? supabase
          .from("partner_payout_profiles")
          .select("verification_status")
          .eq("partner_id", partnerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return referralActivationGates({
    applicationStatus: (opts.application.status as string) || "",
    identityVerified: opts.identityVerified,
    agreementInForce: !!agreement,
    scheduleInForce: !!schedule,
    payoutProfileVerified: (profile as Record<string, unknown> | null)?.verification_status === "VERIFIED",
    orientationCompleted: !!opts.application.orientation_completed_at,
    conductAcknowledged: !!opts.application.conduct_acknowledged_at,
  })
}
