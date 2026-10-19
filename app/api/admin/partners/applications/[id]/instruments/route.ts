import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { generatePartnerId } from "@/lib/partners"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { referralAdminCan } from "@/lib/referral-permissions"
import { createSignedDocUrl } from "@/lib/partner-documents"
import { issueReferralAgreementDocument, issueReferralScheduleDocument } from "@/lib/referral-documents"
import { STANDARD_SCHEDULE_TERMS } from "@/lib/referral-commission-engine"
import {
  agreementNextStatuses,
  createAgreementRecord,
  createCommissionSchedule,
  evaluateReferralActivationGates,
  transitionAgreement,
  transitionCommissionSchedule,
  type AgreementStatus,
} from "@/lib/referral-agreements"

/* ───────────────────────────  Signed instruments  ───────────────────────────
 * The Referral Partner workflow cannot reach "activated" until an executed
 * Agreement and an executed Commission Schedule exist — the schedule is the
 * record the commission engine reads, so rates, protection, holding and payout
 * timing live as signed data here and never in application code.
 *
 * These routes only drive the existing lifecycle library (create → review →
 * sign → execute); permission checks mirror lib/referral-permissions.
 */

const AGREEMENT_KIND = "REFERRAL_PARTNER_AGREEMENT"

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v)
}

function last4(account: string): string {
  const digits = account.replace(/\D/g, "")
  return digits ? digits.slice(-4) : ""
}

/**
 * A Commission Schedule is signed against a partner record, but the partner row
 * is normally created at activation — which needs the schedule first. Creating
 * it here in PENDING_ACTIVATION breaks that loop without activating anything.
 */
async function ensurePartnerRow(
  application: Record<string, unknown>
): Promise<{ id: string; partnerId: string } | { error: string }> {
  const applicationId = str(application.id)
  const { data: existing } = await supabase.from("partners").select("id, partner_id").eq("application_id", applicationId).maybeSingle()
  if (existing) return { id: str(existing.id), partnerId: str(existing.partner_id) }

  const now = new Date().toISOString()
  const code = await generatePartnerId(str(application.country) || "NG")
  const { data: created, error } = await supabase
    .from("partners")
    .insert({
      partner_id: code,
      application_id: applicationId,
      business_name: str(application.business_name) || str(application.full_name),
      display_name: str(application.business_name) || str(application.full_name),
      partner_type: "REFERRAL",
      status: "PENDING_ACTIVATION",
      country: str(application.country) || null,
      state: str(application.state) || null,
      city: str(application.city) || null,
      partner_since: null,
      created_at: now,
      updated_at: now,
    })
    .select("id, partner_id")
    .single()
  if (error || !created) return { error: error?.message || "Could not create the partner record" }
  return { id: str(created.id), partnerId: str(created.partner_id) }
}

async function loadContext(applicationId: string) {
  const { data: app } = await supabase.from("partner_applications").select("*").eq("id", applicationId).single()
  if (!app) return null
  const { data: partner } = await supabase.from("partners").select("*").eq("application_id", applicationId).maybeSingle()
  const partnerId = partner ? str(partner.id) : ""

  const [agreementsRes, schedulesRes, profileRes, requiredDocsRes, generatedDocsRes] = await Promise.all([
    supabase
      .from("partner_agreements")
      .select("*")
      .eq("agreement_kind", AGREEMENT_KIND)
      .or(`application_id.eq.${applicationId}${partnerId ? `,partner_id.eq.${partnerId}` : ""}`)
      .order("created_at", { ascending: false }),
    partnerId
      ? supabase.from("partner_commission_schedules").select("*").eq("partner_id", partnerId).order("version", { ascending: false })
      : Promise.resolve({ data: [] }),
    partnerId
      ? supabase.from("partner_payout_profiles").select("*").eq("partner_id", partnerId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("partner_documents").select("verification_status").eq("application_id", applicationId).eq("required", true),
    partnerId
      ? supabase
          .from("partner_generated_documents")
          .select("id, document_id, document_type, source_record_id, storage_path, status")
          .eq("partner_id", partnerId)
          .in("document_type", ["REFERRAL_PARTNER_AGREEMENT", "REFERRAL_COMMISSION_SCHEDULE"])
          .neq("status", "SUPERSEDED")
          .order("generated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const generatedDocs = (generatedDocsRes.data || []) as Record<string, unknown>[]
  const docFor = async (type: string, sourceRecordId: string, linkedDocumentId?: string | null) => {
    const row = generatedDocs.find(
      (d) => (linkedDocumentId && d.id === linkedDocumentId) || (d.document_type === type && d.source_record_id === sourceRecordId),
    )
    if (!row?.storage_path) return { documentId: null, previewUrl: null }
    return {
      documentId: str(row.document_id),
      previewUrl: await createSignedDocUrl(str(row.storage_path), 300),
    }
  }

  const agreementDocs = await Promise.all(
    ((agreementsRes.data || []) as Record<string, unknown>[]).map((a) =>
      docFor("REFERRAL_PARTNER_AGREEMENT", str(a.id), a.document_id ? str(a.document_id) : null),
    ),
  )
  const scheduleDocs = await Promise.all(
    ((schedulesRes.data || []) as Record<string, unknown>[]).map((s) =>
      docFor("REFERRAL_COMMISSION_SCHEDULE", str(s.id)),
    ),
  )

  const docs = (requiredDocsRes.data || []) as Record<string, unknown>[]
  const identityVerified = docs.every(
    (d) => d.verification_status === "VERIFIED" || d.verification_status === "APPROVED"
  )
  const gates = await evaluateReferralActivationGates({
    application: app as Record<string, unknown>,
    partnerId: partnerId || null,
    identityVerified,
  })

  return {
    application: app as Record<string, unknown>,
    partner: partner ? (partner as Record<string, unknown>) : null,
    gates,
    agreements: ((agreementsRes.data || []) as Record<string, unknown>[]).map((a, index) => ({
      id: str(a.id),
      reference: str(a.reference_number),
      title: str(a.title),
      version: Number(a.version) || 1,
      status: str(a.status),
      executedAt: a.executed_at ? str(a.executed_at) : null,
      activatedAt: a.activated_at ? str(a.activated_at) : null,
      documentId: agreementDocs[index]?.documentId || null,
      previewUrl: agreementDocs[index]?.previewUrl || null,
      next: agreementNextStatuses(str(a.status)),
    })),
    schedules: ((schedulesRes.data || []) as Record<string, unknown>[]).map((s, index) => ({
      id: str(s.id),
      reference: str(s.reference_number),
      version: Number(s.version) || 1,
      status: str(s.status),
      firstYearRate: Number(s.first_year_rate) || 0,
      firstRenewalRate: Number(s.first_renewal_rate) || 0,
      revenueBasis: str(s.revenue_basis),
      protectionDays: Number(s.protection_days) || 0,
      holdingDays: Number(s.holding_days) || 0,
      payoutDaysAfterMonthEnd: Number(s.payout_days_after_month_end) || 0,
      renewalRule: str(s.renewal_rule),
      approvedSplit: str(s.approved_split),
      effectiveFrom: s.effective_from ? str(s.effective_from) : null,
      notes: str(s.notes),
      documentId: scheduleDocs[index]?.documentId || null,
      previewUrl: scheduleDocs[index]?.previewUrl || null,
      next: agreementNextStatuses(str(s.status)),
    })),
    payoutProfile: profileRes.data
      ? (() => {
          const p = profileRes.data as Record<string, unknown>
          return {
            bankName: str(p.bank_name),
            accountName: str(p.account_name),
            accountLast4: last4(str(p.account_number)),
            taxReference: str(p.tax_reference),
            taxDetailsVerified: Boolean(p.tax_details_verified),
            verificationStatus: str(p.verification_status),
            verifiedAt: p.verified_at ? str(p.verified_at) : null,
            contactEmail: str(p.payout_contact_email),
          }
        })()
      : null,
    stamps: {
      orientationCompletedAt: str(app.orientation_completed_at) || null,
      conductAcknowledgedAt: str(app.conduct_acknowledged_at) || null,
    },
  }
}

/* ─── GET: instruments, gates and what the signed schedule controls ─── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied
  const { id } = await params
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const ctxData = await loadContext(id)
  if (!ctxData) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const role = session.role
  return NextResponse.json({
    ...ctxData,
    isReferral: ctxData.application.requested_partner_type === "REFERRAL",
    standardTerms: STANDARD_SCHEDULE_TERMS,
    can: {
      agreementReview: referralAdminCan(role, "agreement:review"),
      scheduleApprove: referralAdminCan(role, "schedule:approve"),
      bankApprove: referralAdminCan(role, "bank:approve"),
      activate: referralAdminCan(role, "partner:activate"),
    },
  })
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add_agreement"), title: z.string().min(3).max(200).optional() }),
  z.object({ action: z.literal("issue_agreement_document"), agreementId: z.string().uuid() }),
  z.object({
    action: z.literal("transition_agreement"),
    agreementId: z.string().uuid(),
    to: z.string().min(3),
    reason: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("add_schedule"),
    firstYearRatePercent: z.coerce.number().min(0).max(100),
    firstRenewalRatePercent: z.coerce.number().min(0).max(100),
    protectionDays: z.coerce.number().int().min(1).max(730),
    holdingDays: z.coerce.number().int().min(1).max(730),
    payoutDaysAfterMonthEnd: z.coerce.number().int().min(1).max(180),
    approvedSplit: z.string().max(500).optional(),
    agreementId: z.string().uuid().optional().nullable(),
    justification: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("transition_schedule"),
    scheduleId: z.string().uuid(),
    to: z.string().min(3),
    reason: z.string().max(2000).optional(),
  }),
  z.object({ action: z.literal("issue_schedule_document"), scheduleId: z.string().uuid() }),
  z.object({
    action: z.literal("save_payout_profile"),
    bankName: z.string().max(120),
    accountNumber: z.string().max(32),
    accountName: z.string().max(160),
    contactName: z.string().max(160),
    contactEmail: z.string().max(200),
    contactPhone: z.string().max(40),
    taxReference: z.string().max(80),
  }),
  z.object({ action: z.literal("verify_payout_profile"), notes: z.string().min(5).max(2000) }),
  z.object({ action: z.literal("record_stamp"), kind: z.enum(["orientation", "conduct"]) }),
])

/* ─── POST ─── */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  const { id } = await params
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const parsed = actionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const body = parsed.data

  const ctxData = await loadContext(id)
  if (!ctxData) return NextResponse.json({ error: "Application not found" }, { status: 404 })
  if (ctxData.application.requested_partner_type !== "REFERRAL") {
    return NextResponse.json({ error: "Signed instruments apply to Referral Partners only" }, { status: 400 })
  }

  const role = session.role
  const actor = { actorId: session.userId, actorName: session.name || session.username }
  const auditCtx = auditContextFromSession(session, request)
  const nowIso = new Date().toISOString()

  try {
    if (body.action === "add_agreement") {
      if (!referralAdminCan(role, "agreement:review")) return NextResponse.json({ error: "Your role cannot issue agreements" }, { status: 403 })
      const res = await createAgreementRecord({
        partnerId: ctxData.partner ? str(ctxData.partner.id) : null,
        applicationId: id,
        kind: AGREEMENT_KIND,
        title: body.title?.trim() || `Referral Partner Agreement — ${str(ctxData.application.business_name) || str(ctxData.application.full_name)}`,
        createdBy: session.userId,
      })
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 })
      return NextResponse.json({ ok: true, reference: res.reference, detail: await loadContext(id) })
    }

    if (body.action === "transition_agreement") {
      if (!referralAdminCan(role, "agreement:review")) return NextResponse.json({ error: "Your role cannot review agreements" }, { status: 403 })
      const res = await transitionAgreement(body.agreementId, body.to as AgreementStatus, actor, { reason: body.reason })
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
      return NextResponse.json({ ok: true, detail: await loadContext(id) })
    }

    if (body.action === "issue_agreement_document") {
      if (!referralAdminCan(role, "agreement:review")) return NextResponse.json({ error: "Your role cannot issue agreements" }, { status: 403 })
      const partner = ctxData.partner ? str(ctxData.partner.id) : ""
      if (!partner) return NextResponse.json({ error: "Create the partner record before generating its document" }, { status: 400 })
      const res = await issueReferralAgreementDocument(partner, body.agreementId, {
        id: session.userId,
        name: session.name || session.username,
        title: "Partner Operations",
      })
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
      return NextResponse.json({ ok: true, detail: await loadContext(id) })
    }

    if (body.action === "add_schedule") {
      if (!referralAdminCan(role, "schedule:approve")) return NextResponse.json({ error: "Your role cannot approve commercial terms" }, { status: 403 })
      const partner = await ensurePartnerRow(ctxData.application)
      if ("error" in partner) return NextResponse.json({ error: partner.error }, { status: 500 })

      // Terms that differ from the standard schedule are allowed — but only as
      // signed data with a recorded justification, never as a code exception.
      const differs =
        body.firstYearRatePercent !== STANDARD_SCHEDULE_TERMS.firstYearRatePercent ||
        body.firstRenewalRatePercent !== STANDARD_SCHEDULE_TERMS.firstRenewalRatePercent ||
        body.protectionDays !== STANDARD_SCHEDULE_TERMS.protectionDays ||
        body.holdingDays !== STANDARD_SCHEDULE_TERMS.holdingDays ||
        body.payoutDaysAfterMonthEnd !== STANDARD_SCHEDULE_TERMS.payoutDaysAfterMonthEnd ||
        Boolean(body.approvedSplit?.trim())
      if (differs && !body.justification?.trim()) {
        return NextResponse.json(
          { error: "Non-standard terms need a recorded justification — it is stored on the signed schedule." },
          { status: 400 }
        )
      }

      const notes = differs
        ? `Non-standard terms approved by ${actor.actorName}: ${body.justification!.trim()}`
        : "Standard approved commercial rules."
      const res = await createCommissionSchedule(partner.id, {
        firstYearRatePercent: body.firstYearRatePercent,
        firstRenewalRatePercent: body.firstRenewalRatePercent,
        protectionDays: body.protectionDays,
        holdingDays: body.holdingDays,
        payoutDaysAfterMonthEnd: body.payoutDaysAfterMonthEnd,
        approvedSplit: body.approvedSplit?.trim() || "",
        agreementId: body.agreementId ?? null,
        createdBy: session.userId,
      })
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 })
      await supabase.from("partner_commission_schedules").update({ notes }).eq("id", res.id)
      return NextResponse.json({ ok: true, reference: res.reference, detail: await loadContext(id) })
    }

    if (body.action === "transition_schedule") {
      if (!referralAdminCan(role, "schedule:approve")) return NextResponse.json({ error: "Your role cannot approve commercial terms" }, { status: 403 })
      const res = await transitionCommissionSchedule(body.scheduleId, body.to as AgreementStatus, actor, { reason: body.reason })
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
      return NextResponse.json({ ok: true, detail: await loadContext(id) })
    }

    if (body.action === "issue_schedule_document") {
      if (!referralAdminCan(role, "schedule:approve")) return NextResponse.json({ error: "Your role cannot issue commercial schedules" }, { status: 403 })
      const partner = ctxData.partner ? str(ctxData.partner.id) : ""
      if (!partner) return NextResponse.json({ error: "Create the partner record before generating its document" }, { status: 400 })
      const res = await issueReferralScheduleDocument(partner, body.scheduleId, {
        id: session.userId,
        name: session.name || session.username,
        title: "Finance and Management approval",
      })
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
      return NextResponse.json({ ok: true, detail: await loadContext(id) })
    }

    if (body.action === "save_payout_profile") {
      if (!referralAdminCan(role, "bank:approve")) return NextResponse.json({ error: "Your role cannot hold payout details" }, { status: 403 })
      const partner = await ensurePartnerRow(ctxData.application)
      if ("error" in partner) return NextResponse.json({ error: partner.error }, { status: 500 })
      if (ctxData.payoutProfile?.verificationStatus === "VERIFIED") {
        // A verified account is only changed through the dual-approval bank change flow.
        return NextResponse.json(
          { error: "Payout details are already verified. Raise a bank change request so the change gets a second approver." },
          { status: 400 }
        )
      }
      const { error } = await supabase
        .from("partner_payout_profiles")
        .upsert(
          {
            partner_id: partner.id,
            bank_name: body.bankName.trim(),
            account_number: body.accountNumber.replace(/\s/g, ""),
            account_name: body.accountName.trim(),
            payout_contact_name: body.contactName.trim(),
            payout_contact_email: body.contactEmail.trim(),
            payout_contact_phone: body.contactPhone.trim(),
            tax_reference: body.taxReference.trim(),
            verification_status: "PENDING",
            updated_at: nowIso,
          },
          { onConflict: "partner_id" }
        )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await recordAudit(auditCtx, {
        action: AUDIT_ACTIONS.PARTNER_UPDATED,
        entityType: AUDIT_ENTITIES.PARTNER_PAYOUT_PROFILE,
        entityId: partner.id,
        metadata: { bank: body.bankName, accountLast4: last4(body.accountNumber), taxReference: body.taxReference },
      })
      return NextResponse.json({ ok: true, detail: await loadContext(id) })
    }

    if (body.action === "verify_payout_profile") {
      if (!referralAdminCan(role, "bank:approve")) return NextResponse.json({ error: "Your role cannot verify payout details" }, { status: 403 })
      if (!ctxData.partner) return NextResponse.json({ error: "Save the payout details first" }, { status: 400 })
      if (!ctxData.payoutProfile?.accountLast4) {
        return NextResponse.json({ error: "No bank account to verify — save the payout details first." }, { status: 400 })
      }
      const { error } = await supabase
        .from("partner_payout_profiles")
        .update({
          verification_status: "VERIFIED",
          tax_details_verified: true,
          verification_notes: body.notes.trim(),
          verified_by: session.userId,
          verified_at: nowIso,
          updated_at: nowIso,
        })
        .eq("partner_id", str(ctxData.partner.id))
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await recordAudit(auditCtx, {
        action: AUDIT_ACTIONS.REFERRAL_PAYOUT_PROFILE_VERIFIED,
        entityType: AUDIT_ENTITIES.PARTNER_PAYOUT_PROFILE,
        entityId: str(ctxData.partner.id),
        metadata: { notes: body.notes.trim(), accountLast4: ctxData.payoutProfile.accountLast4 },
      })
      return NextResponse.json({ ok: true, detail: await loadContext(id) })
    }

    // orientation / conduct stamps
    if (!referralAdminCan(role, "partner:activate")) return NextResponse.json({ error: "Your role cannot record activation readiness" }, { status: 403 })
    const column = body.kind === "orientation" ? "orientation_completed_at" : "conduct_acknowledged_at"
    const { error } = await supabase.from("partner_applications").update({ [column]: nowIso, updated_at: nowIso }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await recordAudit(auditCtx, {
      action: AUDIT_ACTIONS.REFERRAL_ACTIVATION_STAMP_RECORDED,
      entityType: AUDIT_ENTITIES.PARTNER,
      entityId: id,
      metadata: { stamp: body.kind },
    })
    return NextResponse.json({ ok: true, detail: await loadContext(id) })
  } catch (err) {
    console.error("[referral instruments]", err)
    return NextResponse.json({ error: "Failed to process the instrument request" }, { status: 500 })
  }
}
