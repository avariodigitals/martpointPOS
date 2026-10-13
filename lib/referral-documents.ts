/* ───────────────────────────  Referral controlled documents  ───────────────────────────
 * Issues the Referral Partner document pack through the existing generated-document
 * pipeline (private bucket storage, document ID, template version, checksum, audit).
 *
 * Two rules hold here:
 *  • Commercial figures are read from the signed Commission Schedule or the source
 *    finance record. No rate, protection or holding period is stated from code.
 *  • A corrected document supersedes the previous one. Issued files are never
 *    overwritten — their status changes and they link forward to the replacement.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { getMartPointEntity } from "./martpoint-entity"
import {
  issueGeneratedDocument,
  supersedePreviousDocuments,
  loadPartnerIdentity,
  loadLogoDataUrl,
  type GeneratedDocRecord,
} from "./partner-generated-docs"
import {
  renderReferralAgreement,
  renderReferralCommissionSchedule,
  renderReferralAcceptanceNotice,
  renderReferralDecisionNotice,
  renderReferralCommissionStatement,
  renderFormalNotice,
  type ReferralScheduleSummary,
  type ReferralCommissionStatementLine,
} from "./partner-doc-templates"

export interface DocActor {
  id: string
  name?: string | null
  title?: string | null
}

type Row = Record<string, unknown>
const NOT_TEXT = "—"
const num = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const str = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s || null
}

/* ─── Source loads ─── */

async function loadScheduleRow(scheduleId: string): Promise<Row | null> {
  const { data } = await supabase.from("partner_commission_schedules").select("*").eq("id", scheduleId).maybeSingle()
  return (data as Row | null) ?? null
}

/** The schedule in force for the partner, if any — the only authority for terms. */
async function loadActiveScheduleRow(partnerId: string): Promise<Row | null> {
  const date = new Date().toISOString().split("T")[0]
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
  return (data as Row | null) ?? null
}

function summaryOf(row: Row): ReferralScheduleSummary {
  return {
    reference: (row.reference_number as string) || "",
    version: Number(row.version) || 1,
    status: (row.status as string) || "DRAFT",
    firstYearRatePercent: num(row.first_year_rate),
    firstRenewalRatePercent: num(row.first_renewal_rate),
    protectionDays: num(row.protection_days),
    holdingDays: num(row.holding_days),
    payoutDaysAfterMonthEnd: num(row.payout_days_after_month_end),
    effectiveFrom: str(row.effective_from),
  }
}

async function loadPartnerSignatory(partnerId: string): Promise<{ name: string; title: string; email: string }> {
  const [{ data: profile }, { data: partner }] = await Promise.all([
    supabase.from("partner_payout_profiles").select("payout_contact_name, payout_contact_email").eq("partner_id", partnerId).maybeSingle(),
    supabase.from("partners").select("application_id, public_email, display_name, business_name").eq("id", partnerId).maybeSingle(),
  ])
  const applicationId = str((partner as Row | null)?.application_id)
  let applicantName: string | null = null
  if (applicationId) {
    const { data: app } = await supabase.from("partner_applications").select("full_name").eq("id", applicationId).maybeSingle()
    applicantName = str((app as Row | null)?.full_name)
  }
  const legalName = str(partner?.business_name) || str(partner?.display_name) || "Partner"
  return {
    name: str(profile?.payout_contact_name) || applicantName || legalName,
    title: str(profile?.payout_contact_name) ? "Payout contact" : "Authorised representative",
    email: str(profile?.payout_contact_email) || str(partner?.public_email) || "",
  }
}

/* ─── 1. Referral Partner Agreement ─── */

export async function issueReferralAgreementDocument(
  partnerId: string,
  agreementId: string,
  actor: DocActor
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const [{ data: agreement }, partner, mp, logoDataUrl, scheduleRow, signatory] = await Promise.all([
    supabase.from("partner_agreements").select("*").eq("id", agreementId).maybeSingle(),
    loadPartnerIdentity(partnerId),
    getMartPointEntity(),
    loadLogoDataUrl(),
    loadActiveScheduleRow(partnerId),
    loadPartnerSignatory(partnerId),
  ])
  if (!agreement) return { ok: false, error: "Agreement record not found" }
  if (!partner) return { ok: false, error: "Partner not found" }

  const schedule = scheduleRow ? summaryOf(scheduleRow as Row) : null
  const issued = await issueGeneratedDocument({
    partnerId,
    type: "REFERRAL_PARTNER_AGREEMENT",
    title: `Referral Partner Agreement ${agreement.reference_number}`,
    sourceRecordType: "partner_agreement",
    sourceRecordId: agreementId,
    generatedBy: actor.id,
    metadata: {
      agreementReference: agreement.reference_number,
      version: agreement.version,
      scheduleReference: schedule?.reference ?? null,
      scheduleVersion: schedule?.version ?? null,
    },
    render: (control) => ({
      title: `Referral Partner Agreement (${control.documentId})`,
      pdf: renderReferralAgreement(
        {
          control,
          partner,
          reference: (agreement.reference_number as string) || control.documentId,
          effectiveDate: str(agreement.executed_at) || str(agreement.activated_at) || control.generatedAt,
          schedule,
          eligibleItems: str((scheduleRow as Row | null)?.eligible_items),
          exclusions: str((scheduleRow as Row | null)?.exclusions),
          martpointSignatory: { name: mp.signatoryName || mp.legalName, title: mp.signatoryTitle || "MartPoint", email: mp.signatoryEmail || mp.noticeEmail },
          partnerSignatory: signatory,
          approvedBy: actor.name || "Partner Operations",
        },
        { logoDataUrl }
      ),
    }),
  })
  if (!issued.ok || !issued.document) return issued

  await supersedePreviousDocuments({
    partnerId,
    type: "REFERRAL_PARTNER_AGREEMENT",
    supersededById: issued.document.id,
    reason: `Replaced by ${issued.document.documentId}`,
    actorId: actor.id,
  })
  await supabase
    .from("partner_agreements")
    .update({ document_id: issued.document.id })
    .eq("id", agreementId)
  return issued
}

/* ─── 2. Referral Commission Schedule ─── */

export async function issueReferralScheduleDocument(
  partnerId: string,
  scheduleId: string,
  actor: DocActor
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const [row, partner, mp, logoDataUrl] = await Promise.all([
    loadScheduleRow(scheduleId),
    loadPartnerIdentity(partnerId),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!row) return { ok: false, error: "Commission Schedule not found" }
  if (!partner) return { ok: false, error: "Partner not found" }

  const agreementRef = str(row.agreement_id)
    ? await supabase.from("partner_agreements").select("reference_number").eq("id", row.agreement_id as string).maybeSingle()
    : null

  const issued = await issueGeneratedDocument({
    partnerId,
    type: "REFERRAL_COMMISSION_SCHEDULE",
    title: `Referral Commission Schedule ${row.reference_number}`,
    sourceRecordType: "partner_commission_schedule",
    sourceRecordId: scheduleId,
    generatedBy: actor.id,
    metadata: {
      scheduleReference: row.reference_number,
      version: row.version,
      terms: summaryOf(row),
    },
    render: (control) => ({
      title: `Referral Commission Schedule v${row.version} (${control.documentId})`,
      pdf: renderReferralCommissionSchedule(
        {
          control,
          partner,
          reference: (row.reference_number as string) || control.documentId,
          version: Number(row.version) || 1,
          agreementReference: str((agreementRef?.data as Row | null)?.reference_number),
          effectiveFrom: str(row.effective_from),
          effectiveTo: str(row.effective_to),
          terms: summaryOf(row),
          revenueBasis: str(row.revenue_basis),
          eligibleItems: str(row.eligible_items),
          exclusions: str(row.exclusions),
          renewalRule: str(row.renewal_rule),
          statementCycle: str(row.statement_cycle),
          approvedSplit: str(row.approved_split),
          recordedApprover: {
            name: str(actor.name) || "MartPoint approver",
            title: actor.title || "Finance and Management approval",
            email: mp.noticeEmail,
          },
        },
        { logoDataUrl }
      ),
    }),
  })
  if (!issued.ok || !issued.document) return issued

  // A new version replaces the in-force schedule document; the signed PDF is kept.
  await supersedePreviousDocuments({
    partnerId,
    type: "REFERRAL_COMMISSION_SCHEDULE",
    supersededById: issued.document.id,
    reason: `Version ${row.version} replaces the previous schedule document`,
    actorId: actor.id,
  })
  return issued
}

/* ─── 3. Referral Acceptance Notice ─── */

export async function issueReferralAcceptanceNotice(
  referralId: string,
  actor: DocActor,
  opts?: { protectionDays?: number | null; protectionSource?: string | null }
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: lead } = await supabase.from("partner_leads").select("*").eq("id", referralId).maybeSingle()
  const row = lead as Row | null
  if (!row) return { ok: false, error: "Referral not found" }
  const partnerId = str(row.partner_id)
  if (!partnerId) return { ok: false, error: "Referral has no submitting partner" }
  const partner = await loadPartnerIdentity(partnerId)
  if (!partner) return { ok: false, error: "Partner not found" }
  const logoDataUrl = await loadLogoDataUrl()

  const start = str(row.protection_start_at)
  const expiry = str(row.protection_expires_at)
  const issued = await issueGeneratedDocument({
    partnerId,
    type: "REFERRAL_ACCEPTANCE_NOTICE",
    title: `Referral Acceptance Notice ${row.referral_reference}`,
    sourceRecordType: "partner_lead",
    sourceRecordId: referralId,
    generatedBy: actor.id,
    metadata: { referralReference: row.referral_reference, protectionExpiresAt: expiry },
    render: (control) => ({
      title: `Referral Acceptance Notice ${row.referral_reference}`,
      pdf: renderReferralAcceptanceNotice(
        {
          control,
          partner,
          referralReference: (row.referral_reference as string) || NOT_TEXT,
          prospectName: (row.business_name as string) || NOT_TEXT,
          submittedAt: str(row.submitted_at),
          acceptedAt: str(row.acceptance_at) || control.generatedAt,
          reviewer: str(row.decision_by_name) || actor.name || null,
          protectionStart: start,
          protectionExpiry: expiry,
          protectionDays: opts?.protectionDays ?? null,
          protectionSource: opts?.protectionSource ?? "Signed Referral Commission Schedule",
          martpointOwner: str(row.sales_owner),
          partnerNextStep: "No action required. MartPoint owns the opportunity; introduce nothing further without the portal record.",
        },
        { logoDataUrl }
      ),
    }),
  })
  if (!issued.ok || !issued.document) return issued

  // A re-decision on the same referral replaces its previous notice.
  await supersedePreviousDocuments({
    partnerId,
    type: "REFERRAL_ACCEPTANCE_NOTICE",
    sourceRecordId: referralId,
    supersededById: issued.document.id,
    reason: `Superseded by ${issued.document.documentId}`,
    actorId: actor.id,
  })
  return issued
}

/* ─── 4. Information request / duplicate / rejection / lost-or-expired ─── */

export type ReferralNoticeKind = "INFORMATION_REQUEST" | "DUPLICATE" | "REJECTION" | "LOST_OR_EXPIRED"

const NOTICE_TYPES: Record<ReferralNoticeKind, "INFORMATION_REQUEST_NOTICE" | "DUPLICATE_NOTICE" | "REJECTION_NOTICE" | "LOST_OR_EXPIRED_NOTICE"> = {
  INFORMATION_REQUEST: "INFORMATION_REQUEST_NOTICE",
  DUPLICATE: "DUPLICATE_NOTICE",
  REJECTION: "REJECTION_NOTICE",
  LOST_OR_EXPIRED: "LOST_OR_EXPIRED_NOTICE",
}

const NOTICE_LABELS: Record<ReferralNoticeKind, string> = {
  INFORMATION_REQUEST: "INFORMATION REQUIRED",
  DUPLICATE: "DUPLICATE",
  REJECTION: "REJECTED",
  LOST_OR_EXPIRED: "CLOSED",
}

const NOTICE_TITLE: Record<ReferralNoticeKind, string> = {
  INFORMATION_REQUEST: "Referral Information Request",
  DUPLICATE: "Referral Duplicate Notice",
  REJECTION: "Referral Rejection Notice",
  LOST_OR_EXPIRED: "Referral Closure Notice",
}

export interface ReferralDecisionNoticeInput {
  kind: ReferralNoticeKind
  /** Partner-safe reason only — never another partner's identity or private sales data. */
  safeReason?: string | null
  requiredAction?: string | null
  responseDue?: string | null
  attributionEffect?: string | null
  commissionEffect?: string | null
}

export async function issueReferralDecisionNotice(
  referralId: string,
  actor: DocActor,
  input: ReferralDecisionNoticeInput
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: lead } = await supabase.from("partner_leads").select("*").eq("id", referralId).maybeSingle()
  const row = lead as Row | null
  if (!row) return { ok: false, error: "Referral not found" }
  const partnerId = str(row.partner_id)
  if (!partnerId) return { ok: false, error: "Referral has no submitting partner" }
  const partner = await loadPartnerIdentity(partnerId)
  if (!partner) return { ok: false, error: "Partner not found" }
  const mp = await getMartPointEntity()
  const logoDataUrl = await loadLogoDataUrl()

  const defaults: Record<ReferralNoticeKind, { attribution: string; commission: string }> = {
    INFORMATION_REQUEST: {
      attribution: "Attribution is held while MartPoint reviews the information you supply. The protection period has not started.",
      commission: "No commission arises from a referral that is still under review.",
    },
    DUPLICATE: {
      attribution: "No new attribution is created because the prospect is already recorded with MartPoint.",
      commission: "No commission arises. Existing recorded attribution is unaffected.",
    },
    REJECTION: {
      attribution: "The referral is closed and no attribution is recorded.",
      commission: "No commission arises from a rejected referral.",
    },
    LOST_OR_EXPIRED: {
      attribution: "Recorded attribution has ended.",
      commission: "No new commission arises. Earnings already approved by Finance before this decision are settled under the signed schedule.",
    },
  }

  const reason =
    str(input.safeReason) ||
    str(row.information_request_message) ||
    str(row.decision_reason) ||
    str(row.closure_reason) ||
    "Decision recorded by MartPoint"

  const issued = await issueGeneratedDocument({
    partnerId,
    type: NOTICE_TYPES[input.kind],
    title: `${NOTICE_TITLE[input.kind]} ${row.referral_reference || ""}`.trim(),
    sourceRecordType: "partner_lead",
    sourceRecordId: referralId,
    generatedBy: actor.id,
    metadata: { referralReference: row.referral_reference, kind: input.kind, responseDue: input.responseDue ?? null },
    render: (control) => ({
      title: `${NOTICE_TITLE[input.kind]} ${row.referral_reference || ""}`.trim(),
      pdf: renderReferralDecisionNotice(
        {
          control,
          partner,
          referralReference: (row.referral_reference as string) || NOT_TEXT,
          prospectName: (row.business_name as string) || NOT_TEXT,
          decisionLabel: NOTICE_LABELS[input.kind],
          effectiveDate: control.generatedAt,
          reason,
          requiredAction: str(input.requiredAction),
          responseDue: str(input.responseDue),
          attributionEffect: input.attributionEffect || defaults[input.kind].attribution,
          commissionEffect: input.commissionEffect || defaults[input.kind].commission,
          reviewContact: mp.noticeEmail,
          decidedBy: str(row.decision_by_name) || actor.name || "MartPoint Partner Operations",
        },
        { logoDataUrl }
      ),
    }),
  })
  if (!issued.ok || !issued.document) return issued

  await supersedePreviousDocuments({
    partnerId,
    type: NOTICE_TYPES[input.kind],
    sourceRecordId: referralId,
    supersededById: issued.document.id,
    reason: `Superseded by ${issued.document.documentId}`,
    actorId: actor.id,
  })
  return issued
}

/* ─── 5. Referral Commission Statement (monthly close) ─── */

export async function issueReferralCommissionStatement(
  partnerId: string,
  period: { from: string | null; to: string | null; key?: string | null; periodId?: string | null },
  actor: DocActor
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const [partner, mp, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(partnerId),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }

  const select =
    "*, partner_leads:referral_id (referral_reference), businesses:business_id (business_name), invoices:invoice_id (invoice_number)"
  let q = supabase
    .from("partner_commissions")
    .select(select)
    .eq("partner_id", partnerId)
    .not("earning_kind", "is", null)
    .is("parent_commission_id", null)
    .order("earned_at", { ascending: true })
  if (period.periodId) {
    // Closed period: the stamp is authoritative, earnings may have been
    // cleared in an earlier month and approved only now.
    q = q.eq("period_id", period.periodId)
  } else {
    if (period.from) q = q.gte("earned_at", period.from)
    if (period.to) q = q.lte("earned_at", period.to)
  }
  const { data: rows } = await q
  const earnings = (rows || []) as Row[]
  const lineIds = earnings.map((r) => r.id as string)

  const [{ data: adjustmentRows }, { data: payoutRows }] = await Promise.all([
    lineIds.length
      ? supabase.from("partner_commissions").select("*").in("parent_commission_id", lineIds)
      : { data: [] },
    lineIds.length
      ? supabase
          .from("commission_payout_items")
          .select("commission_id, commission_payouts:payout_id (payout_reference)")
          .in("commission_id", lineIds)
      : { data: [] },
  ])
  const adjustments = (adjustmentRows || []) as Row[]
  const payoutRefByCommission = new Map<string, string>()
  for (const p of (payoutRows || []) as Row[]) {
    const cid = str(p.commission_id)
    const ref = str((p.commission_payouts as Row | null)?.payout_reference)
    if (cid && ref) payoutRefByCommission.set(cid, ref)
  }
  const referralIdByLine = new Map<string, string>()
  earnings.forEach((r) => {
    const rid = str(r.id)
    const ref = str((r.partner_leads as Row | null)?.referral_reference)
    if (rid && ref) referralIdByLine.set(rid, ref)
  })

  const currency = (earnings[0]?.currency as string) || "NGN"
  const refOf = (r: Row): string => str((r.partner_leads as Row | null)?.referral_reference) || "—"
  const lines: ReferralCommissionStatementLine[] = earnings.map((r) => ({
    referralReference: refOf(r),
    customer: str((r.businesses as Row | null)?.business_name) || "—",
    invoiceNumber: str((r.invoices as Row | null)?.invoice_number),
    clearedAt: str(r.earned_at),
    activatedAt: str(r.activation_at),
    eligibleBase: String(r.basis_amount ?? "0"),
    rate: `${num(r.commission_rate) ?? 0}%`,
    amount: String(r.commission_amount ?? "0"),
    status: (r.status as string) || "PENDING",
    holdingCompletedAt: str(r.holding_completed_at),
    approvedBy: str(r.approved_at) ? "MartPoint Finance" : null,
    payoutReference: payoutRefByCommission.get(r.id as string) ?? null,
  }))

  const sum = (pred: (r: Row) => boolean) =>
    earnings.filter(pred).reduce((s, r) => s + (Number(r.commission_amount) || 0), 0)
  const adjustmentTotal = adjustments.reduce((s, a) => s + (Number(a.commission_amount) || 0), 0)
  const totals = {
    eligible: sum((r) => r.status === "ELIGIBLE"),
    approved: sum((r) => r.status === "APPROVED" || r.status === "SCHEDULED" || r.status === "PAID"),
    held: sum((r) => r.status === "HELD" || r.status === "PENDING" || r.status === "POTENTIAL"),
    reversed: sum((r) => r.status === "REVERSED") + adjustmentTotal,
    netPayable: sum((r) => r.status === "APPROVED" || r.status === "SCHEDULED" || r.status === "PAID") + adjustmentTotal,
  }

  const scheduleRow = await loadActiveScheduleRow(partnerId)

  const issued = await issueGeneratedDocument({
    partnerId,
    type: "REFERRAL_COMMISSION_STATEMENT",
    title: `Referral Commission Statement ${period.key || ""}`.trim(),
    sourceRecordType: "partner",
    sourceRecordId: partnerId,
    generatedBy: actor.id,
    metadata: {
      periodKey: period.key ?? null,
      periodFrom: period.from,
      periodTo: period.to,
      lineCount: lines.length,
      netPayable: totals.netPayable,
    },
    render: (control) => ({
      title: `Referral Commission Statement ${period.key || control.documentId}`,
      pdf: renderReferralCommissionStatement(
        {
          control,
          partner,
          currency,
          period: { from: period.from, to: period.to },
          scheduleReference: str(scheduleRow?.reference_number),
          lines,
          adjustments: adjustments.map((a) => ({
            date: str(a.created_at),
            description: `${str(a.adjustment_kind) || "Adjustment"} against referral ${
              referralIdByLine.get(str(a.parent_commission_id) || "") || "—"
            }${str(a.reversal_reason) ? ` — ${a.reversal_reason}` : ""}`,
            amount: String(a.commission_amount ?? "0"),
          })),
          totals,
          disputeContact: mp.noticeEmail,
          disputeDeadline: null,
        },
        { logoDataUrl }
      ),
    }),
  })
  if (!issued.ok || !issued.document) return issued

  // One statement per period: a re-run replaces the previous period document.
  if (period.key) {
    const prior = await supabase
      .from("partner_generated_documents")
      .select("id, metadata")
      .eq("partner_id", partnerId)
      .eq("document_type", "REFERRAL_COMMISSION_STATEMENT")
      .in("status", ["ISSUED", "ACCEPTED", "SIGNED"])
    const match = ((prior.data || []) as Row[]).find((r) => (r.metadata as Row)?.periodKey === period.key)
    if (match && match.id !== issued.document.id) {
      await supersedePreviousDocuments({
        partnerId,
        type: "REFERRAL_COMMISSION_STATEMENT",
        supersededById: issued.document.id,
        reason: `Reissued for period ${period.key}`,
        actorId: actor.id,
      })
    }
  }
  return issued
}

/* ─── 6. Suspension / Termination notice (Referral Partner) ─── */

export async function issueReferralStatusNotice(
  partnerId: string,
  input: { decision: "SUSPENSION" | "TERMINATION"; reason?: string | null; effectiveDate?: string | null },
  actor: DocActor
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const [partner, mp, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(partnerId),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }

  return issueGeneratedDocument({
    partnerId,
    type: "SUSPENSION_OR_TERMINATION_NOTICE",
    title: `${input.decision === "SUSPENSION" ? "Suspension" : "Termination"} Notice ${partner.legalName}`,
    sourceRecordType: "partner",
    sourceRecordId: partnerId,
    generatedBy: actor.id,
    metadata: { decision: input.decision, reason: input.reason ?? null },
    render: (control) => ({
      pdf: renderFormalNotice(
        {
          control,
          partner,
          decision: input.decision,
          effectiveDate: input.effectiveDate || control.generatedAt,
          reason: input.reason ?? null,
          immediateActions: [
            "Referral submission is closed for the duration of this decision.",
            "Open referrals are reviewed by Partner Operations; existing attribution is handled per the Agreement.",
            "Stop representing MartPoint and remove MartPoint branding from any channel you control.",
            "Protect introduced personal data and complete any requested handover.",
          ],
          decidedBy: { name: actor.name || "Management", title: actor.title || "Management", email: mp.noticeEmail },
          reviewContact: mp.noticeEmail,
        },
        { logoDataUrl }
      ),
    }),
  })
}
