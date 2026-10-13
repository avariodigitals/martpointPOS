/* ───────────────────────────  Referral workflow core  ───────────────────────────
 * Submission (with consent), duplicate review across every required source,
 * and the single server-side transition gate. Every status change lands in
 * referral_status_history (append-only) and audit_logs.
 *
 * Referrals ARE partner_leads rows — the existing partner lead record, using
 * the approved Referral workflow statuses. No duplicate table.
 */

import crypto from "node:crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import {
  transitionAllowed,
  type ReferralStatus,
  REFERRAL_STATUS_LABELS,
} from "./referral-status"
import {
  safeDuplicateExplanation,
  type DuplicateCategory,
} from "./referral-permissions"
import { emitReferralNotification } from "./referral-notifications"
import { getActiveSchedule } from "./referral-agreements"
import { STANDARD_SCHEDULE_TERMS } from "./referral-commission-engine"

/* ─── Reference: MPR-YYYY-NNNNN ─── */

export async function generateReferralReference(): Promise<string> {
  const year = new Date().getFullYear()
  if (!isSupabaseConfigured()) return `MPR-${year}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
  const { data, error } = await supabase.rpc("increment_referral_seq")
  if (error || !data) {
    const { count } = await supabase.from("partner_leads").select("id", { count: "exact", head: true })
    return `MPR-${year}-${String((count ?? 0) + 1).padStart(5, "0")}`
  }
  return `MPR-${year}-${String(data as number).padStart(5, "0")}`
}

/* ─── Submission form (approved field list) ─── */

export interface ReferralSubmissionInput {
  businessName: string
  contactName: string
  phone: string
  email: string
  country: string
  state: string
  city: string
  businessType: string
  estimatedBranches?: number | null
  estimatedUsers?: number | null
  currentSystem: string
  knownRequirement: string
  relationshipSource: string
  consentConfirmed: boolean
  consentAt?: string | null
  notes?: string | null
}

export function validateReferralSubmission(input: ReferralSubmissionInput): { ok: boolean; error?: string } {
  if (!input.businessName?.trim()) return { ok: false, error: "Prospect business name is required" }
  if (!input.contactName?.trim()) return { ok: false, error: "Contact name is required" }
  if (!input.phone?.trim() && !input.email?.trim()) return { ok: false, error: "A phone number or email is required" }
  if (!input.businessType?.trim()) return { ok: false, error: "Business type is required" }
  if (!input.relationshipSource?.trim()) return { ok: false, error: "Source of relationship is required" }
  if (!input.consentConfirmed) return { ok: false, error: "Consent confirmation is required before submitting a referral" }
  return { ok: true }
}

/* ─── Duplicate check — every required source, partner-safe output ─── */

export interface DuplicateMatch {
  category: DuplicateCategory
  sourceTable: "businesses" | "leads" | "quotes" | "partner_leads"
  sourceId: string
  /** Internal-only: never sent to the submitting partner. */
  internalDetail: string
  /** Partner-safe text for the decision notice. */
  safeExplanation: string
}

export interface DuplicateCheckResult {
  duplicate: boolean
  matches: DuplicateMatch[]
}

function normPhone(v: string | null | undefined) {
  return (v || "").replace(/[^\d]/g, "")
}
function normEmail(v: string | null | undefined) {
  return (v || "").trim().toLowerCase()
}
function normName(v: string | null | undefined) {
  return (v || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")
}

function orFilter(column: string, name: string, email: string, phone: string): string | null {
  const parts: string[] = []
  if (name) parts.push(`${column}.ilike.${name}`)
  if (email) parts.push(`email.ilike.${email}`)
  if (phone) parts.push(`phone.ilike.${phone}`)
  return parts.length ? parts.join(",") : null
}

export async function runReferralDuplicateCheck(input: {
  businessName: string
  phone: string
  email: string
  /** The partner submitting (used to distinguish own vs another partner's referral). */
  partnerId?: string | null
  /** Exclude this referral itself (re-checks on an existing record). */
  excludeReferralId?: string | null
}): Promise<DuplicateCheckResult> {
  if (!isSupabaseConfigured()) return { duplicate: false, matches: [] }

  const name = normName(input.businessName)
  const email = normEmail(input.email)
  const phone = normPhone(input.phone)
  const matches: DuplicateMatch[] = []
  const businessIds = new Set<string>()

  // 1. Existing MartPoint customers
  const businessFilter = [
    name ? `business_name.ilike.${name}` : null,
    email ? `primary_email.ilike.${email}` : null,
    phone ? `primary_phone.ilike.${phone}` : null,
  ].filter(Boolean).join(",")
  if (businessFilter) {
    const { data } = await supabase
      .from("businesses")
      .select("id, business_name")
      .or(businessFilter)
      .limit(5)
    for (const b of (data as { id: string; business_name: string }[] | null) || []) {
      businessIds.add(b.id)
      matches.push({
        category: "EXISTING_CUSTOMER",
        sourceTable: "businesses",
        sourceId: b.id,
        internalDetail: `Customer: ${b.business_name}`,
        safeExplanation: safeDuplicateExplanation("EXISTING_CUSTOMER"),
      })
    }
  }

  // 2. Existing CRM leads
  const leadFilter = orFilter("business_name", name, email, phone)
  let leadIds = new Set<string>()
  if (leadFilter) {
    const { data } = await supabase
      .from("leads")
      .select("id, business_name, status, assigned_to, source, referring_partner_code")
      .or(leadFilter)
      .limit(5)
    for (const l of (data as { id: string; business_name: string; status: string; assigned_to: string | null; source: string; referring_partner_code: string | null }[] | null) || []) {
      leadIds.add(l.id)
      // 6. Direct MartPoint sales activity — an owned/progressing CRM lead
      const owned = Boolean(l.assigned_to) || !["New", "Unqualified", "Lost"].includes(l.status)
      if (owned) {
        matches.push({
          category: "DIRECT_SALES_ACTIVITY",
          sourceTable: "leads",
          sourceId: l.id,
          internalDetail: `CRM lead ${l.business_name} (status ${l.status}${l.assigned_to ? `, owner ${l.assigned_to}` : ""})`,
          safeExplanation: safeDuplicateExplanation("DIRECT_SALES_ACTIVITY"),
        })
      } else {
        matches.push({
          category: "EXISTING_CRM_LEAD",
          sourceTable: "leads",
          sourceId: l.id,
          internalDetail: `CRM lead: ${l.business_name}`,
          safeExplanation: safeDuplicateExplanation("EXISTING_CRM_LEAD"),
        })
      }
    }
  }

  // 3./4./7. Other referrals and previously accepted referrals (all partner_leads)
  const pLeadFilter = orFilter("business_name", name, email, phone)
  if (pLeadFilter) {
    let q = supabase
      .from("partner_leads")
      .select("id, business_name, partner_id, status, protection_status")
      .or(pLeadFilter)
      .limit(10)
    if (input.excludeReferralId) q = q.neq("id", input.excludeReferralId)
    const { data } = await q
    for (const r of (data as { id: string; business_name: string; partner_id: string | null; status: string; protection_status: string }[] | null) || []) {
      const accepted =
        ["ACCEPTED", "QUALIFIED", "CONVERTED_UNPAID", "PAID_PENDING_ACTIVATION", "ACTIVATED_HOLDING", "COMMISSION_ELIGIBLE", "APPROVED", "PAID", "WON"].includes(r.status) ||
        r.protection_status === "PROTECTED"
      const samePartner = input.partnerId && r.partner_id === input.partnerId

      if (samePartner && accepted) {
        matches.push({
          category: "PREVIOUSLY_ACCEPTED_REFERRAL",
          sourceTable: "partner_leads",
          sourceId: r.id,
          internalDetail: `Own earlier accepted referral: ${r.business_name}`,
          safeExplanation: safeDuplicateExplanation("PREVIOUSLY_ACCEPTED_REFERRAL"),
        })
      } else if (accepted) {
        matches.push({
          category: "ANOTHER_PARTNER_REFERRAL",
          sourceTable: "partner_leads",
          sourceId: r.id,
          // Identity of the other partner is never exposed — not even in the partner-safe text.
          internalDetail: `Referral owned by partner ${r.partner_id} (status ${r.status})`,
          safeExplanation: safeDuplicateExplanation("ANOTHER_PARTNER_REFERRAL"),
        })
      } else {
        matches.push({
          category: "EXISTING_CRM_LEAD",
          sourceTable: "partner_leads",
          sourceId: r.id,
          internalDetail: `Open referral: ${r.business_name}`,
          safeExplanation: safeDuplicateExplanation("EXISTING_CRM_LEAD"),
        })
      }
    }
  }

  // 5. Active opportunities (open quotes on matched businesses)
  if (businessIds.size > 0) {
    const { data } = await supabase
      .from("quotes")
      .select("id, status, business_id")
      .in("business_id", Array.from(businessIds))
      .in("status", ["DRAFT", "SENT", "ACCEPTED"])
      .limit(5)
    for (const q of (data as { id: string; status: string; business_id: string }[] | null) || []) {
      matches.push({
        category: "ACTIVE_OPPORTUNITY",
        sourceTable: "quotes",
        sourceId: q.id,
        internalDetail: `Open quote ${q.id} (${q.status})`,
        safeExplanation: safeDuplicateExplanation("ACTIVE_OPPORTUNITY"),
      })
    }
  }

  return { duplicate: matches.length > 0, matches }
}

/** The single partner-safe duplicate message (no internal detail). */
export function duplicateNoticeMessage(result: DuplicateCheckResult): string {
  if (!result.duplicate) return ""
  const seen = new Set<string>()
  const lines: string[] = []
  for (const m of result.matches) {
    if (!seen.has(m.safeExplanation)) {
      seen.add(m.safeExplanation)
      lines.push(m.safeExplanation)
    }
  }
  return lines.join(" ")
}

/* ─── Status transition gate (server-side) ─── */

export interface ReferralActor {
  actorType: "ADMIN" | "SYSTEM" | "PARTNER"
  actorId?: string | null
  actorName?: string | null
}

export interface TransitionResult {
  ok: boolean
  error?: string
}

export async function transitionReferral(
  leadId: string,
  to: ReferralStatus,
  actor: ReferralActor,
  opts?: {
    reason?: string | null
    metadata?: Record<string, unknown>
    /** Column updates applied atomically with the status change. */
    patch?: Record<string, unknown>
    /** Skip the transition table check (system sweeps calling with legal moves only). */
    force?: boolean
  }
): Promise<TransitionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: current } = await supabase.from("partner_leads").select("*").eq("id", leadId).single()
  if (!current) return { ok: false, error: "Referral not found" }

  const from = current.status as string
  if (!opts?.force && !transitionAllowed(from, to)) {
    return { ok: false, error: `Invalid referral transition: ${from} → ${to}` }
  }

  const nowIso = new Date().toISOString()
  const update: Record<string, unknown> = { status: to, updated_at: nowIso, ...(opts?.patch || {}) }

  const { error } = await supabase.from("partner_leads").update(update).eq("id", leadId)
  if (error) return { ok: false, error: `Status update failed: ${error.message}` }

  await supabase.from("referral_status_history").insert({
    referral_id: leadId,
    previous_status: from,
    new_status: to,
    actor_type: actor.actorType,
    actor_id: actor.actorId ?? null,
    actor_name: actor.actorName ?? null,
    reason: opts?.reason ?? null,
    metadata: opts?.metadata ?? {},
  })

  await recordAudit(
    {
      actorType: actor.actorType,
      actorId: actor.actorId ?? undefined,
      actorName: actor.actorName ?? undefined,
    } as AuditContext,
    {
      action: AUDIT_ACTIONS.REFERRAL_STATUS_CHANGED,
      entityType: AUDIT_ENTITIES.REFERRAL,
      entityId: leadId,
      metadata: {
        from,
        to,
        reason: opts?.reason ?? null,
        reference: current.referral_reference ?? null,
        ...(opts?.metadata || {}),
      },
    }
  )

  return { ok: true }
}

/* ─── Submission ─── */

/** Suspended or closed partner accounts cannot create or submit referrals. */
async function submissionBlockedReason(partnerId: string | null): Promise<string | null> {
  if (!partnerId) return null
  const { data } = await supabase
    .from("partners")
    .select("status")
    .eq("id", partnerId)
    .maybeSingle()
  const status = (data as { status?: string } | null)?.status
  if (status === "SUSPENDED") return "Referral submission is closed while your partner account is suspended"
  if (status === "TERMINATED" || status === "INACTIVE") return "Referral submission is closed for this partner account"
  return null
}

export async function createReferralSubmission(
  input: ReferralSubmissionInput,
  partnerId: string | null,
  submittedBy: string | null,
  ctx: AuditContext,
  opts?: { asDraft?: boolean }
): Promise<{ ok: true; leadId: string; reference: string; duplicate: DuplicateCheckResult } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const blocked = await submissionBlockedReason(partnerId)
  if (blocked) return { ok: false, error: blocked }

  const asDraft = opts?.asDraft === true
  if (!asDraft) {
    const v = validateReferralSubmission(input)
    if (!v.ok) return { ok: false, error: v.error || "Invalid submission" }
  }

  const duplicate = await runReferralDuplicateCheck({
    businessName: input.businessName,
    phone: input.phone,
    email: input.email,
    partnerId,
  })

  const reference = await generateReferralReference()
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from("partner_leads")
    .insert({
      referral_reference: reference,
      partner_id: partnerId,
      submitted_by_partner_user_id: submittedBy,
      business_name: input.businessName.trim(),
      contact_name: input.contactName.trim(),
      phone: normPhone(input.phone),
      email: normEmail(input.email),
      country: input.country,
      state: input.state,
      city: input.city,
      industry: input.businessType,
      business_type: input.businessType,
      estimated_branches: input.estimatedBranches ?? null,
      estimated_users: input.estimatedUsers ?? null,
      interested_product: input.knownRequirement,
      current_system: input.currentSystem || "",
      known_requirement: input.knownRequirement || "",
      relationship_source: input.relationshipSource || "",
      consent_confirmed: Boolean(input.consentConfirmed),
      consent_at: input.consentConfirmed ? input.consentAt || nowIso : null,
      notes: input.notes ?? null,
      status: asDraft ? "DRAFT" : "SUBMITTED",
      submitted_at: asDraft ? null : nowIso,
      protection_status: "PENDING",
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select()
    .single()

  if (error || !data) return { ok: false, error: `Failed to create referral: ${error?.message || "unknown"}` }

  const leadId = data.id as string

  await supabase.from("referral_status_history").insert({
    referral_id: leadId,
    previous_status: null,
    new_status: asDraft ? "DRAFT" : "SUBMITTED",
    actor_type: "PARTNER",
    actor_id: submittedBy,
    actor_name: null,
    reason: asDraft ? "Draft saved" : "Referral submitted through the partner portal",
    metadata: { reference },
  })

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.REFERRAL_SUBMITTED,
    entityType: AUDIT_ENTITIES.REFERRAL,
    entityId: leadId,
    metadata: {
      reference,
      partnerId,
      businessName: input.businessName,
      consentConfirmed: Boolean(input.consentConfirmed),
      duplicateHit: duplicate.duplicate,
    },
  })

  if (!asDraft) {
    await emitReferralNotification({
      event: "REFERRAL_SUBMITTED",
      title: `Referral submitted: ${reference}`,
      body: `${input.businessName} — awaiting MartPoint review.`,
      partnerId,
      link: `/admin/partners/leads?ref=${reference}`,
      sourceType: "referral",
      sourceId: leadId,
      skipInternal: false,
    })
  }

  return { ok: true, leadId, reference, duplicate }
}

export async function submitDraftReferral(
  leadId: string,
  partnerId: string,
  submittedBy: string | null,
  ctx: AuditContext
): Promise<TransitionResult & { reference?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const blocked = await submissionBlockedReason(partnerId)
  if (blocked) return { ok: false, error: blocked }
  const { data: lead } = await supabase.from("partner_leads").select("*").eq("id", leadId).eq("partner_id", partnerId).single()
  if (!lead) return { ok: false, error: "Referral not found" }
  if (lead.status !== "DRAFT") return { ok: false, error: "Only draft referrals can be submitted" }
  if (!lead.consent_confirmed) return { ok: false, error: "Consent confirmation is required before submitting a referral" }

  const nowIso = new Date().toISOString()
  const res = await transitionReferral(leadId, "SUBMITTED", {
    actorType: "PARTNER",
    actorId: submittedBy,
    actorName: null,
  }, {
    reason: "Referral submitted through the partner portal",
    patch: { submitted_at: nowIso },
  })
  if (!res.ok) return res

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.REFERRAL_SUBMITTED,
    entityType: AUDIT_ENTITIES.REFERRAL,
    entityId: leadId,
    metadata: { reference: lead.referral_reference, partnerId },
  })

  await emitReferralNotification({
    event: "REFERRAL_SUBMITTED",
    title: `Referral submitted: ${lead.referral_reference}`,
    body: `${lead.business_name} — awaiting MartPoint review.`,
    partnerId,
    link: `/admin/partners/leads?ref=${lead.referral_reference}`,
    sourceType: "referral",
    sourceId: leadId,
  })

  return { ok: true, reference: lead.referral_reference as string }
}

/**
 * A partner answering an information request. The response is recorded on the
 * referral and the record returns to MartPoint review — the partner never moves
 * a referral to an accepting status themselves.
 */
export async function provideReferralInformation(
  leadId: string,
  partnerId: string,
  partnerUserId: string | null,
  response: string,
  ctx: AuditContext
): Promise<TransitionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const text = response?.trim()
  if (!text) return { ok: false, error: "Type your response before sending it" }

  const { data: lead } = await supabase
    .from("partner_leads")
    .select("id, status, referral_reference, business_name, partner_id")
    .eq("id", leadId)
    .eq("partner_id", partnerId)
    .maybeSingle()
  if (!lead) return { ok: false, error: "Referral not found" }
  if (lead.status !== "INFORMATION_REQUIRED") {
    return { ok: false, error: "This referral has no outstanding information request" }
  }

  const blocked = await submissionBlockedReason(partnerId)
  if (blocked) return { ok: false, error: blocked }

  const nowIso = new Date().toISOString()
  const res = await transitionReferral(
    leadId,
    "UNDER_REVIEW",
    { actorType: "PARTNER", actorId: partnerUserId, actorName: null },
    {
      reason: "Information provided by partner — back for MartPoint review",
      patch: { information_response: text, information_response_at: nowIso },
    }
  )
  if (!res.ok) return res

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.REFERRAL_INFORMATION_PROVIDED,
    entityType: AUDIT_ENTITIES.REFERRAL,
    entityId: leadId,
    metadata: { reference: lead.referral_reference, characters: text.length },
  })

  await emitReferralNotification({
    event: "REFERRAL_INFORMATION_PROVIDED",
    title: `Information received: ${lead.referral_reference}`,
    body: `${lead.business_name} — the partner answered the request; the referral is back under review.`,
    partnerId,
    link: `/admin/partners/leads?ref=${lead.referral_reference}`,
    sourceType: "referral",
    sourceId: leadId,
  })

  return { ok: true }
}

/* ─── Review decisions (Sales + Partner Operations) ─── */

/**
 * Protection length is owned by the partner's EXECUTED Commission Schedule.
 * `requested` is only an Management-approved exception input; the standard 90
 * days is a documented fallback for a partner with no schedule in force yet.
 */
async function protectionDaysForAcceptance(
  partnerId: string | null,
  requested?: number
): Promise<number> {
  const { terms } = partnerId ? await getActiveSchedule(partnerId) : { terms: null }
  const scheduled = terms?.protectionDays ?? 0
  if (requested && requested > 0) return requested
  return scheduled > 0 ? scheduled : STANDARD_SCHEDULE_TERMS.protectionDays
}

/**
 * A submitted referral must be opened before it can be decided — the queue
 * distinguishes "in MartPoint's hands" from "waiting for review".
 */
async function ensureReferralUnderReview(leadId: string, actor: ReferralActor): Promise<TransitionResult> {
  const { data } = await supabase.from("partner_leads").select("status").eq("id", leadId).maybeSingle()
  if ((data as { status?: string } | null)?.status !== "SUBMITTED") return { ok: true }
  return transitionReferral(leadId, "UNDER_REVIEW", actor, { reason: "Review opened" })
}

export async function requestReferralInformation(
  leadId: string,
  message: string,
  dueAt: string | null,
  actor: ReferralActor,
  ctx: AuditContext
): Promise<TransitionResult> {
  const opened = await ensureReferralUnderReview(leadId, actor)
  if (!opened.ok) return opened

  const res = await transitionReferral(leadId, "INFORMATION_REQUIRED", actor, {
    reason: message,
    patch: {
      information_request_message: message,
      information_request_due_at: dueAt,
      protection_status: "PENDING",
    },
  })
  if (!res.ok) return res

  const { data: lead } = await supabase.from("partner_leads").select("partner_id, referral_reference, business_name").eq("id", leadId).single()
  if (lead) {
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.REFERRAL_INFORMATION_REQUESTED,
      entityType: AUDIT_ENTITIES.REFERRAL,
      entityId: leadId,
      metadata: { reference: lead.referral_reference, dueAt },
    })
    await emitReferralNotification({
      event: "ADDITIONAL_INFORMATION_REQUESTED",
      title: `Information required: ${lead.referral_reference}`,
      body: message,
      partnerId: (lead.partner_id as string) || null,
      link: `/partner/referrals/${leadId}`,
      sourceType: "referral",
      sourceId: leadId,
      emailTo: null,
    })
    try {
      const { issueReferralDecisionNotice } = await import("./referral-documents")
      await issueReferralDecisionNotice(
        leadId,
        { id: actor.actorId || "system", name: actor.actorName ?? null, title: "Sales / Partner Operations" },
        {
          kind: "INFORMATION_REQUEST",
          safeReason: message,
          requiredAction: "Supply the information requested above through the referral record.",
          responseDue: dueAt,
        }
      )
    } catch (err) {
      console.error("[requestReferralInformation] notice document", err)
    }
  }
  return { ok: true }
}

export async function decideReferralReview(
  leadId: string,
  decision: "ACCEPTED" | "DUPLICATE" | "REJECTED",
  actor: ReferralActor,
  ctx: AuditContext,
  opts?: { reason?: string; protectionDays?: number }
): Promise<TransitionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const opened = await ensureReferralUnderReview(leadId, actor)
  if (!opened.ok) return opened

  const { data: lead } = await supabase.from("partner_leads").select("*").eq("id", leadId).single()
  if (!lead) return { ok: false, error: "Referral not found" }

  let duplicateResult: DuplicateCheckResult | null = null
  if (decision === "DUPLICATE") {
    duplicateResult = await runReferralDuplicateCheck({
      businessName: lead.business_name as string,
      phone: (lead.phone as string) || "",
      email: (lead.email as string) || "",
      partnerId: lead.partner_id as string | null,
      excludeReferralId: leadId,
    })
    if (!duplicateResult.duplicate) {
      return { ok: false, error: "Cannot mark duplicate — no matching customer, lead, opportunity or referral found" }
    }
  }

  const nowIso = new Date().toISOString()
  const patch: Record<string, unknown> = {
    decision_by: actor.actorId ?? null,
    decision_by_name: actor.actorName ?? null,
    decision_reason: opts?.reason ?? null,
  }
  let appliedProtectionDays: number | null = null

  if (decision === "ACCEPTED") {
    // Re-run the duplicate check at acceptance — required before protection starts.
    const dup = await runReferralDuplicateCheck({
      businessName: lead.business_name as string,
      phone: (lead.phone as string) || "",
      email: (lead.email as string) || "",
      partnerId: lead.partner_id as string | null,
      excludeReferralId: leadId,
    })
    if (dup.duplicate) {
      return { ok: false, error: `Cannot accept — duplicate detected: ${duplicateNoticeMessage(dup)}` }
    }
    const days = await protectionDaysForAcceptance(lead.partner_id as string | null, opts?.protectionDays)
    appliedProtectionDays = days
    patch.acceptance_at = nowIso
    patch.protection_start_at = nowIso
    patch.protection_expires_at = new Date(Date.now() + days * 86_400_000).toISOString()
    patch.protection_status = "PROTECTED"
    patch.information_request_message = null
    patch.information_request_due_at = null
  } else {
    patch.protection_status = decision === "DUPLICATE" ? "REJECTED" : "REJECTED"
    patch.protection_expires_at = null
    if (decision === "REJECTED") patch.closure_reason = opts?.reason || "Rejected on review"
    if (decision === "DUPLICATE") patch.closure_reason = opts?.reason || "Duplicate registration"
  }

  const res = await transitionReferral(leadId, decision, actor, {
    reason: opts?.reason ?? null,
    patch,
    metadata: { protectionDays: appliedProtectionDays },
  })
  if (!res.ok) return res

  await recordAudit(ctx, {
    action:
      decision === "ACCEPTED" ? AUDIT_ACTIONS.REFERRAL_ACCEPTED
      : decision === "DUPLICATE" ? AUDIT_ACTIONS.REFERRAL_DUPLICATE
      : AUDIT_ACTIONS.REFERRAL_REJECTED,
    entityType: AUDIT_ENTITIES.REFERRAL,
    entityId: leadId,
    metadata: { reference: lead.referral_reference, reason: opts?.reason ?? null },
  })

  const event =
    decision === "ACCEPTED" ? "REFERRAL_ACCEPTED"
    : decision === "DUPLICATE" ? "REFERRAL_DUPLICATE"
    : "REFERRAL_REJECTED"
  const titleSuffix = decision === "ACCEPTED" ? "accepted" : decision === "DUPLICATE" ? "marked duplicate" : "rejected"

  await emitReferralNotification({
    event,
    title: `Referral ${lead.referral_reference} ${titleSuffix}`,
    body:
      decision === "ACCEPTED"
        ? `Attribution protected until ${patch.protection_expires_at}. Acceptance does not create a commission.`
        : decision === "DUPLICATE"
          ? duplicateNoticeMessage(duplicateResult || { duplicate: false, matches: [] })
          : opts?.reason ?? "See the decision notice in your portal.",
    partnerId: (lead.partner_id as string) || null,
    link: `/partner/referrals/${leadId}`,
    sourceType: "referral",
    sourceId: leadId,
  })

  // Controlled decision document — issued from the recorded decision, superseded
  // if the referral is later re-decided. Never blocks the decision itself.
  try {
    const { issueReferralAcceptanceNotice, issueReferralDecisionNotice } = await import("./referral-documents")
    const docActor = { id: actor.actorId || "system", name: actor.actorName ?? null, title: "Sales / Partner Operations" }
    if (decision === "ACCEPTED") {
      const leadPartnerId = (lead.partner_id as string) || null
      const { row } = leadPartnerId ? await getActiveSchedule(leadPartnerId) : { row: null }
      await issueReferralAcceptanceNotice(leadId, docActor, {
        protectionDays: appliedProtectionDays,
        protectionSource: row
          ? `Signed Commission Schedule ${row.reference_number} (version ${row.version})`
          : "Standard 90-day protection — no Commission Schedule is in force for this partner",
      })
    } else {
      await issueReferralDecisionNotice(leadId, docActor, {
        kind: decision === "DUPLICATE" ? "DUPLICATE" : "REJECTION",
        safeReason:
          decision === "DUPLICATE"
            ? duplicateNoticeMessage(duplicateResult || { duplicate: false, matches: [] })
            : opts?.reason ?? null,
        requiredAction:
          decision === "DUPLICATE"
            ? "No action required. If you believe this prospect is new to MartPoint, send supporting evidence through the portal."
            : "No action required. You may submit other new prospects.",
      })
    }
  } catch (err) {
    console.error("[decideReferralReview] decision document", err)
  }

  return { ok: true }
}
