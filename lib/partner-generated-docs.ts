import crypto from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { supabase, isSupabaseConfigured } from "./supabase"
import { PARTNER_DOCUMENTS_BUCKET, uploadPrivateFile, createSignedDocUrl } from "./partner-documents"
import { getMartPointEntity } from "./martpoint-entity"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import { PARTNER_TYPE_LABELS, type PartnerType } from "./partners"
import { ORG_CAPABILITY_LABELS, type PartnerOrgCapability } from "./partner-permissions"
import {
  GENERATED_DOC_TEMPLATE_VERSION,
  fmtMoney,
  renderActivationConfirmation,
  renderCustomerAssignment,
  renderCommissionStatement,
  renderPayoutStatement,
  renderGradeConfirmation,
  renderFormalNotice,
  renderImplementationWorkOrder,
  renderChangeOrder,
  renderDataProcessingAddendum,
  renderTrainingRecord,
  renderUatRecord,
  renderCompletionHandover,
  renderGoLiveDecision,
  renderImplementationFeeStatement,
  type PartnerIdentity,
  type DocControl,
  type CommissionStatementLine,
  type ImplementationFeeLine,
} from "./partner-doc-templates"
import type { GeneratedPdf } from "./partner-pdf"

/* ───────────────────────────  Generated document registry  ───────────────────────────
 * Issues MartPoint-styled PDFs from portal records, stores them in the private
 * partner-documents bucket and registers them with document ID, template
 * version, source record, checksum and signature/acceptance state.
 */

export const GENERATED_DOC_TYPES = [
  "MASTER_PARTNER_AGREEMENT",
  "ACTIVATION_CONFIRMATION",
  "CUSTOMER_ASSIGNMENT",
  "IMPLEMENTATION_WORK_ORDER",
  "CHANGE_ORDER",
  "DATA_PROCESSING_ADDENDUM",
  "TRAINING_RECORD",
  "UAT_RECORD",
  "COMPLETION_HANDOVER_RECORD",
  "GO_LIVE_DECISION",
  "COMMISSION_STATEMENT",
  "IMPLEMENTATION_FEE_STATEMENT",
  "PAYOUT_STATEMENT",
  "GRADE_CONFIRMATION",
  "FORMAL_NOTICE",
] as const

export type GeneratedDocType = (typeof GENERATED_DOC_TYPES)[number]

export const GENERATED_DOC_TYPE_LABELS: Record<GeneratedDocType, string> = {
  MASTER_PARTNER_AGREEMENT: "Master Partner Agreement",
  ACTIVATION_CONFIRMATION: "Activation Confirmation",
  CUSTOMER_ASSIGNMENT: "Customer Assignment",
  IMPLEMENTATION_WORK_ORDER: "Implementation Work Order",
  CHANGE_ORDER: "Change Order",
  DATA_PROCESSING_ADDENDUM: "Data Processing Addendum",
  TRAINING_RECORD: "Training Attendance Record",
  UAT_RECORD: "UAT and Acceptance Record",
  COMPLETION_HANDOVER_RECORD: "Completion and Handover Record",
  GO_LIVE_DECISION: "Go Live Decision",
  COMMISSION_STATEMENT: "Commission Statement",
  IMPLEMENTATION_FEE_STATEMENT: "Implementation Fee Statement",
  PAYOUT_STATEMENT: "Payout Statement",
  GRADE_CONFIRMATION: "Grade and Certification Confirmation",
  FORMAL_NOTICE: "Formal Notice",
}

/** Types the partner must acknowledge in the portal before the record is effective. */
export const ACKNOWLEDGEABLE_TYPES: GeneratedDocType[] = ["CUSTOMER_ASSIGNMENT"]

export interface GeneratedDocRecord {
  id: string
  documentId: string
  documentType: GeneratedDocType
  title: string
  status: string
  templateVersion: string
  generatedAt: string
  acknowledgedAt: string | null
  fileSize: number | null
  checksum: string | null
  storagePath: string
  sourceRecordType: string | null
  sourceRecordId: string | null
  metadata: Record<string, unknown>
}

function mapDoc(row: Record<string, unknown>): GeneratedDocRecord {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    documentType: row.document_type as GeneratedDocType,
    title: row.title as string,
    status: row.status as string,
    templateVersion: row.template_version as string,
    generatedAt: row.generated_at as string,
    acknowledgedAt: (row.acknowledged_at as string | null) ?? null,
    fileSize: (row.file_size as number | null) ?? null,
    checksum: (row.checksum_sha256 as string | null) ?? null,
    storagePath: row.storage_path as string,
    sourceRecordType: (row.source_record_type as string | null) ?? null,
    sourceRecordId: (row.source_record_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) || {},
  }
}

/* ─── Document ID: MPD-YYYY-NNNNN ─── */

export async function generateDocumentId(): Promise<string> {
  const year = new Date().getFullYear()
  if (!isSupabaseConfigured()) {
    return `MPD-${year}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
  }
  const { data, error } = await supabase.rpc("increment_partner_document_seq")
  if (error || !data) {
    const { count } = await supabase
      .from("partner_generated_documents")
      .select("id", { count: "exact", head: true })
    return `MPD-${year}-${String((count ?? 0) + 1).padStart(5, "0")}`
  }
  return `MPD-${year}-${String(data as number).padStart(5, "0")}`
}

/* ─── Issue: render, store, register, audit ─── */

interface IssueInput {
  partnerId: string | null
  applicationId?: string | null
  type: GeneratedDocType
  title?: string
  sourceRecordType?: string
  sourceRecordId?: string
  generatedBy: string
  metadata?: Record<string, unknown>
  /** Render the PDF once the document ID is known (it appears inside the PDF). */
  render: (control: DocControl) => { pdf: GeneratedPdf; title?: string }
}

export async function issueGeneratedDocument(
  input: IssueInput
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const documentId = await generateDocumentId()
  const control: DocControl = {
    documentId,
    templateVersion: GENERATED_DOC_TEMPLATE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceRecordId: input.sourceRecordId,
    status: "ISSUED",
  }

  const { pdf, title } = input.render(control)
  const checksum = crypto.createHash("sha256").update(pdf.bytes).digest("hex")

  const ownerScope = input.partnerId || `application-${input.applicationId || "unscoped"}`
  const storagePath = `generated/${ownerScope}/${documentId}-${pdf.fileName}`
  const upload = await uploadPrivateFile(PARTNER_DOCUMENTS_BUCKET, storagePath, pdf.fileName, "application/pdf", pdf.bytes)
  if (!upload.ok) return { ok: false, error: upload.error || "Failed to store document" }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("partner_generated_documents")
    .insert({
      document_id: documentId,
      partner_id: input.partnerId,
      application_id: input.applicationId ?? null,
      document_type: input.type,
      title: title || input.title || GENERATED_DOC_TYPE_LABELS[input.type],
      template_version: control.templateVersion,
      source_record_type: input.sourceRecordType ?? null,
      source_record_id: input.sourceRecordId ?? null,
      status: "ISSUED",
      storage_path: storagePath,
      file_size: pdf.bytes.length,
      checksum_sha256: checksum,
      generated_by: input.generatedBy,
      generated_at: now,
      metadata: input.metadata ?? {},
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (error || !data) return { ok: false, error: "Failed to register document" }

  const ctx: AuditContext = { actorType: input.generatedBy === "system" ? "SYSTEM" : "ADMIN", actorId: input.generatedBy }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_DOCUMENT_GENERATED,
    entityType: AUDIT_ENTITIES.PARTNER_GENERATED_DOCUMENT,
    entityId: data.id as string,
    metadata: {
      documentId,
      documentType: input.type,
      partnerId: input.partnerId,
      sourceRecordId: input.sourceRecordId,
      sha256: checksum,
      fileName: pdf.fileName,
    },
  })

  return { ok: true, document: mapDoc(data) }
}

/* ─── Data loading helpers ─── */

async function loadLogoDataUrl(): Promise<string | undefined> {
  try {
    const logo = await fs.readFile(path.join(process.cwd(), "public", "logo.png"))
    return `data:image/png;base64,${logo.toString("base64")}`
  } catch {
    return undefined
  }
}

async function loadPartnerIdentity(partnerId: string): Promise<PartnerIdentity | null> {
  const { data: p } = await supabase.from("partners").select("*").eq("id", partnerId).single()
  if (!p) return null
  const typeLabel = PARTNER_TYPE_LABELS[p.partner_type as PartnerType] || (p.partner_type as string)
  return {
    partnerId: p.partner_id as string,
    legalName: (p.business_name as string) || (p.display_name as string),
    displayName: (p.display_name as string) || (p.business_name as string),
    partnerTypeLabel: typeLabel,
    status: p.status as string,
    country: (p.country as string) || "",
    state: (p.state as string) || "",
    city: (p.city as string) || "",
    partnerSince: (p.partner_since as string | null) ?? null,
    badgeTier: (p.badge_tier as string | null) ?? null,
  }
}

async function loadEnabledCapabilities(partnerId: string) {
  const nowIso = new Date().toISOString()
  const { data } = await supabase
    .from("partner_capabilities")
    .select("capability, expires_at")
    .eq("partner_id", partnerId)
    .eq("enabled", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  return ((data || []) as Record<string, unknown>[]).map((r) => ({
    label: ORG_CAPABILITY_LABELS[r.capability as PartnerOrgCapability] || (r.capability as string),
    expiresAt: (r.expires_at as string | null) ?? null,
  }))
}

/** Generated agreement document IDs already on file for this partner/application. */
async function loadAgreementRefs(partnerId: string): Promise<string[]> {
  const { data } = await supabase
    .from("partner_generated_documents")
    .select("document_id, title")
    .eq("partner_id", partnerId)
    .in("document_type", ["MASTER_PARTNER_AGREEMENT"])
    .neq("status", "SUPERSEDED")
  return ((data || []) as Record<string, unknown>[]).map((r) => `${r.title} (${r.document_id})`)
}

/* ─── 1. Activation Confirmation ─── */

export async function issueActivationConfirmation(
  partnerId: string,
  generatedBy: string
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const [partner, capabilities, mp, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(partnerId),
    loadEnabledCapabilities(partnerId),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }
  const agreementRefs = await loadAgreementRefs(partnerId)

  const effective = partner.partnerSince || new Date().toISOString()
  const nextReview = new Date(effective)
  nextReview.setFullYear(nextReview.getFullYear() + 1)

  return issueGeneratedDocument({
    partnerId,
    type: "ACTIVATION_CONFIRMATION",
    sourceRecordType: "partner",
    sourceRecordId: partnerId,
    generatedBy,
    metadata: { partnerCode: partner.partnerId, capabilities: capabilities.map((c) => c.label) },
    render: (control) => ({
      pdf: renderActivationConfirmation(
        {
          control,
          partner,
          capabilities,
          agreementRefs,
          effectiveDate: effective,
          nextReviewDate: nextReview.toISOString(),
          authorisedBy: {
            name: mp.signatoryName || mp.ownerName,
            title: mp.signatoryTitle || "Partner Operations",
            email: mp.signatoryEmail || mp.ownerEmail || mp.noticeEmail,
          },
        },
        { logoDataUrl }
      ),
    }),
  })
}

/* ─── 2. Customer Assignment ─── */

const RELATIONSHIP_LABELS: Record<string, string> = {
  REFERRED: "Referral servicing",
  SOLD: "Channel sales and servicing",
  IMPLEMENTATION: "Implementation delivery",
  SUPPORT: "First-line support",
  ACCOUNT_MANAGER: "Account management",
}

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  VIEW_ONLY: "View only",
  SALES: "Sales workspace",
  ONBOARDING_MANAGER: "Onboarding workspace",
  SUPPORT: "Support workspace",
}

export async function issueCustomerAssignmentDocument(
  assignmentId: string,
  generatedBy: string
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const { data: assignment } = await supabase
    .from("partner_customer_assignments")
    .select("*, businesses(*)")
    .eq("id", assignmentId)
    .single()
  if (!assignment) return { ok: false, error: "Assignment not found" }

  const [partner, mp, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(assignment.partner_id as string),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }

  const business = (assignment.businesses as Record<string, unknown>) || {}
  const location = [business.city, business.state, business.country].filter(Boolean).join(", ")

  const result = await issueGeneratedDocument({
    partnerId: assignment.partner_id as string,
    type: "CUSTOMER_ASSIGNMENT",
    sourceRecordType: "partner_customer_assignment",
    sourceRecordId: assignmentId,
    generatedBy,
    metadata: {
      businessId: assignment.business_id,
      relationshipType: assignment.relationship_type,
      accessLevel: assignment.access_level,
    },
    render: (control) => ({
      pdf: renderCustomerAssignment(
        {
          control,
          partner,
          customer: { businessName: (business.business_name as string) || "Assigned customer", location },
          relationshipLabel: RELATIONSHIP_LABELS[assignment.relationship_type as string] || (assignment.relationship_type as string),
          accessLevelLabel: ACCESS_LEVEL_LABELS[assignment.access_level as string] || (assignment.access_level as string),
          scope: (assignment.notes as string | null) ?? null,
          startDate: (assignment.starts_at as string | null) ?? (assignment.created_at as string | null),
          expiryDate: (assignment.expires_at as string | null) ?? null,
          martpointOwner: {
            name: mp.ownerName || mp.signatoryName,
            title: "Partner Operations",
            email: mp.ownerEmail || mp.noticeEmail,
          },
        },
        { logoDataUrl }
      ),
    }),
  })

  if (result.ok && result.document) {
    await supabase
      .from("partner_customer_assignments")
      .update({ generated_document_id: result.document.id, updated_at: new Date().toISOString() })
      .eq("id", assignmentId)
  }
  return result
}

/* ─── 3. Commission Statement ─── */

export async function issueCommissionStatement(
  partnerId: string,
  opts: { from?: string | null; to?: string | null; commissionIds?: string[] },
  generatedBy: string
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const [partner, mp, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(partnerId),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }

  let q = supabase
    .from("partner_commissions")
    .select("*, commission_plans:commission_plan_id (name, commission_basis, applies_to, percentage, fixed_amount), businesses:business_id (business_name)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: true })
  if (opts.commissionIds?.length) q = q.in("id", opts.commissionIds)
  if (opts.from) q = q.gte("created_at", opts.from)
  if (opts.to) q = q.lte("created_at", opts.to)
  const { data: rows } = await q

  const lines: CommissionStatementLine[] = ((rows || []) as Record<string, unknown>[]).map((r) => {
    const plan = (r.commission_plans as Record<string, unknown>) || {}
    const basis = (plan.commission_basis as string) || ""
    const rate = basis === "PERCENTAGE" ? `${plan.percentage ?? ""}%` : `${plan.fixed_amount ?? ""}`
    const currency = (r.currency as string) || "NGN"
    return {
      customer: ((r.businesses as Record<string, unknown> | null)?.business_name as string) || "—",
      attributionType: r.attribution_type as string,
      basis,
      rate,
      eligibleAmount: fmtMoney(r.basis_amount as number, currency),
      amount: fmtMoney(r.commission_amount as number, currency),
      status: r.status as string,
      date: ((r.paid_at as string | null) || (r.earned_at as string | null) || (r.created_at as string)) ?? null,
    }
  })
  const currency = ((rows?.[0] as Record<string, unknown> | undefined)?.currency as string) || "NGN"

  return issueGeneratedDocument({
    partnerId,
    type: "COMMISSION_STATEMENT",
    sourceRecordType: "partner",
    sourceRecordId: partnerId,
    generatedBy,
    metadata: { periodFrom: opts.from ?? null, periodTo: opts.to ?? null, lineCount: lines.length },
    render: (control) => ({
      pdf: renderCommissionStatement(
        {
          control,
          partner,
          period: { from: opts.from ?? null, to: opts.to ?? null },
          currency,
          lines,
          disputeContact: mp.noticeEmail,
        },
        { logoDataUrl }
      ),
    }),
  })
}

/* ─── 4. Payout Statement ─── */

export async function issuePayoutStatement(
  payoutId: string,
  generatedBy: string
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const { data: payout } = await supabase
    .from("commission_payouts")
    .select("*")
    .eq("id", payoutId)
    .single()
  if (!payout) return { ok: false, error: "Payout not found" }

  const { data: items } = await supabase
    .from("commission_payout_items")
    .select("*, partner_commissions:commission_id (currency, status, businesses:business_id (business_name))")
    .eq("payout_id", payoutId)

  const [partner, mp, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(payout.partner_id as string),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }

  const currency = (payout.currency as string) || "NGN"
  const lines = ((items || []) as Record<string, unknown>[]).map((it) => {
    const comm = (it.partner_commissions as Record<string, unknown>) || {}
    const biz = (comm.businesses as Record<string, unknown> | null) || {}
    return {
      customer: (biz.business_name as string) || "—",
      amount: fmtMoney(it.amount as number, currency),
      status: (comm.status as string) || "SCHEDULED",
    }
  })

  return issueGeneratedDocument({
    partnerId: payout.partner_id as string,
    type: "PAYOUT_STATEMENT",
    sourceRecordType: "commission_payout",
    sourceRecordId: payoutId,
    generatedBy,
    metadata: { payoutReference: payout.payout_reference },
    render: (control) => ({
      pdf: renderPayoutStatement(
        {
          control,
          partner,
          payoutReference: payout.payout_reference as string,
          paymentDate: (payout.paid_at as string | null) ?? (payout.created_at as string | null),
          maskedDestination: (payout.bank_reference as string | null) ?? (payout.payment_method as string | null),
          currency,
          lines,
          deductions: null,
          total: Number(payout.amount) || 0,
          contact: mp.noticeEmail,
        },
        { logoDataUrl }
      ),
    }),
  })
}

/* ─── 5. Grade and Certification Confirmation ─── */

export async function issueGradeConfirmation(
  partnerId: string,
  input: { newGrade: string; previousGrade: string | null; basis?: string | null },
  generatedBy: { id: string; name?: string | null }
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const [partner, mp, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(partnerId),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }

  return issueGeneratedDocument({
    partnerId,
    type: "GRADE_CONFIRMATION",
    sourceRecordType: "partner",
    sourceRecordId: partnerId,
    generatedBy: generatedBy.id,
    metadata: { previousGrade: input.previousGrade, newGrade: input.newGrade },
    render: (control) => ({
      pdf: renderGradeConfirmation(
        {
          control,
          partner,
          previousGrade: input.previousGrade,
          newGrade: input.newGrade,
          effectiveDate: control.generatedAt,
          reviewPeriod: null,
          basis: input.basis ?? null,
          decidedBy: {
            name: generatedBy.name || "Partner Operations",
            title: "Partner Operations",
            email: mp.noticeEmail,
          },
        },
        { logoDataUrl }
      ),
    }),
  })
}

/* ─── 6. Suspension / Termination / Reassignment Notice ─── */

export async function issueFormalNotice(
  partnerId: string,
  input: {
    decision: "SUSPENSION" | "TERMINATION" | "REASSIGNMENT"
    reason?: string | null
    effectiveDate?: string | null
  },
  generatedBy: { id: string; name?: string | null }
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const [partner, mp, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(partnerId),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }

  return issueGeneratedDocument({
    partnerId,
    type: "FORMAL_NOTICE",
    sourceRecordType: "partner",
    sourceRecordId: partnerId,
    generatedBy: generatedBy.id,
    metadata: { decision: input.decision, reason: input.reason ?? null },
    render: (control) => ({
      pdf: renderFormalNotice(
        {
          control,
          partner,
          decision: input.decision,
          effectiveDate: input.effectiveDate || control.generatedAt,
          reason: input.reason ?? null,
          decidedBy: {
            name: generatedBy.name || "Partner Operations",
            title: "Partner Operations",
            email: mp.noticeEmail,
          },
          reviewContact: mp.noticeEmail,
        },
        { logoDataUrl }
      ),
    }),
  })
}

/* ─── Agreement registration (agreement PDFs already exist via partner_documents) ─── */

export async function registerAgreementDocument(opts: {
  partnerId: string | null
  applicationId: string
  agreementId: string
  storagePath: string
  fileName: string
  fileSize: number
  checksum: string
  templateVersion: string
  generatedBy: string
}): Promise<void> {
  if (!isSupabaseConfigured()) return
  const documentId = await generateDocumentId()
  const now = new Date().toISOString()
  const { data } = await supabase
    .from("partner_generated_documents")
    .insert({
      document_id: documentId,
      partner_id: opts.partnerId,
      application_id: opts.applicationId,
      document_type: "MASTER_PARTNER_AGREEMENT",
      title: `Partner Agreement ${opts.agreementId}`,
      template_version: opts.templateVersion,
      source_record_type: "partner_application",
      source_record_id: opts.applicationId,
      status: "ISSUED",
      storage_path: opts.storagePath,
      file_size: opts.fileSize,
      checksum_sha256: opts.checksum,
      generated_by: opts.generatedBy,
      generated_at: now,
      metadata: { agreementId: opts.agreementId },
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single()
  if (data) {
    await recordAudit(
      { actorType: "ADMIN", actorId: opts.generatedBy },
      {
        action: AUDIT_ACTIONS.PARTNER_DOCUMENT_GENERATED,
        entityType: AUDIT_ENTITIES.PARTNER_GENERATED_DOCUMENT,
        entityId: data.id as string,
        metadata: { documentId, documentType: "MASTER_PARTNER_AGREEMENT", agreementId: opts.agreementId },
      }
    )
  }
}

/** Link pre-activation generated docs to the partner once the partner record exists. */
export async function linkApplicationGeneratedDocs(applicationId: string, partnerId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  await supabase
    .from("partner_generated_documents")
    .update({ partner_id: partnerId, updated_at: new Date().toISOString() })
    .eq("application_id", applicationId)
    .is("partner_id", null)
}

/* ─── Listing / access / acknowledgement ─── */

export async function listGeneratedDocuments(partnerId: string): Promise<GeneratedDocRecord[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("partner_generated_documents")
    .select("*")
    .eq("partner_id", partnerId)
    .neq("status", "SUPERSEDED")
    .order("generated_at", { ascending: false })
  return ((data || []) as Record<string, unknown>[]).map(mapDoc)
}

export async function getGeneratedDocumentSignedUrl(
  docId: string,
  opts?: { partnerId?: string; actor?: AuditContext }
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  let q = supabase.from("partner_generated_documents").select("id, partner_id, storage_path").eq("id", docId)
  if (opts?.partnerId) q = q.eq("partner_id", opts.partnerId)
  const { data } = await q.single()
  if (!data) return null
  const url = await createSignedDocUrl(data.storage_path as string, 300)
  if (url && opts?.actor) {
    await recordAudit(opts.actor, {
      action: AUDIT_ACTIONS.PARTNER_DOCUMENT_ACCESSED,
      entityType: AUDIT_ENTITIES.PARTNER_GENERATED_DOCUMENT,
      entityId: data.id as string,
      metadata: { partnerId: data.partner_id },
    })
  }
  return url
}

/** Partner acknowledges a document (e.g. Customer Assignment acceptance). */
export async function acknowledgeGeneratedDocument(
  docId: string,
  partnerId: string,
  user: { id: string; name: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: doc } = await supabase
    .from("partner_generated_documents")
    .select("id, document_type, status, source_record_type, source_record_id")
    .eq("id", docId)
    .eq("partner_id", partnerId)
    .single()
  if (!doc) return { ok: false, error: "Document not found" }
  if (!ACKNOWLEDGEABLE_TYPES.includes(doc.document_type as GeneratedDocType)) {
    return { ok: false, error: "This document does not require acknowledgement" }
  }
  if (doc.status !== "ISSUED") return { ok: false, error: "Document is not awaiting acknowledgement" }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from("partner_generated_documents")
    .update({ status: "ACCEPTED", acknowledged_at: now, acknowledged_by: user.id, updated_at: now })
    .eq("id", docId)
  if (error) return { ok: false, error: "Failed to acknowledge document" }

  // Acknowledging a Customer Assignment also records partner acceptance on
  // the assignment itself — the gate that implementation work checks.
  if (
    doc.document_type === "CUSTOMER_ASSIGNMENT" &&
    doc.source_record_type === "partner_customer_assignment" &&
    doc.source_record_id
  ) {
    await supabase
      .from("partner_customer_assignments")
      .update({ partner_accepted_at: now, partner_accepted_by: user.id, updated_at: now })
      .eq("id", doc.source_record_id as string)
      .eq("partner_id", partnerId)
  }

  await recordAudit(
    { actorType: "PARTNER", actorId: user.id },
    {
      action: AUDIT_ACTIONS.PARTNER_DOCUMENT_ACKNOWLEDGED,
      entityType: AUDIT_ENTITIES.PARTNER_GENERATED_DOCUMENT,
      entityId: docId,
      metadata: { partnerId, acknowledgedByName: user.name, documentType: doc.document_type },
    }
  )
  return { ok: true }
}

/* ─── 7. Implementation Work Order ─── */

export async function issueWorkOrderDocument(
  workOrderId: string,
  generatedBy: string
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const { data: wo } = await supabase
    .from("partner_work_orders")
    .select("*, businesses(business_name, city, state, country)")
    .eq("id", workOrderId)
    .single()
  if (!wo) return { ok: false, error: "Work order not found" }

  const { data: milestones } = await supabase
    .from("partner_work_order_milestones")
    .select("*")
    .eq("work_order_id", workOrderId)
    .order("order_index", { ascending: true })

  const [partner, mp, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(wo.partner_id as string),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }

  const business = (wo.businesses as Record<string, unknown> | null) || {}
  const currency = (wo.currency as string) || "NGN"

  return issueGeneratedDocument({
    partnerId: wo.partner_id as string,
    type: "IMPLEMENTATION_WORK_ORDER",
    sourceRecordType: "partner_work_order",
    sourceRecordId: workOrderId,
    generatedBy,
    metadata: { workOrderRef: wo.work_order_ref, businessId: wo.business_id },
    render: (control) => ({
      pdf: renderImplementationWorkOrder(
        {
          control,
          partner,
          workOrderRef: wo.work_order_ref as string,
          title: wo.title as string,
          customer: (business.business_name as string) || "",
          scope: wo.scope as string,
          exclusions: (wo.exclusions as string | null) ?? null,
          customerDuties: (wo.customer_duties as string | null) ?? null,
          accessNotes: (wo.access_notes as string | null) ?? null,
          acceptanceCriteria: (wo.acceptance_criteria as string | null) ?? null,
          milestones: ((milestones || []) as Record<string, unknown>[]).map((m) => ({
            title: m.title as string,
            dueDate: (m.due_date as string | null) ?? null,
            feeAmount: m.fee_amount != null ? fmtMoney(m.fee_amount as number, currency) : "—",
            acceptanceCriteria: (m.acceptance_criteria as string | null) || "—",
          })),
          feeTotal: wo.fee_total != null ? fmtMoney(wo.fee_total as number, currency) : null,
          currency,
          startDate: (wo.starts_at as string | null) ?? null,
          dueDate: (wo.due_at as string | null) ?? null,
          martpointOwner: { name: mp.ownerName || mp.signatoryName, title: "Partner Operations", email: mp.ownerEmail || mp.noticeEmail },
          partnerSignatory: { name: "", title: "", email: "" },
        },
        { logoDataUrl }
      ),
    }),
  })
}

/* ─── 8. Change Order ─── */

export async function issueChangeOrderDocument(
  changeOrderId: string,
  generatedBy: string
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const { data: co } = await supabase
    .from("partner_change_orders")
    .select("*, partner_work_orders(work_order_ref, partner_id, businesses(business_name))")
    .eq("id", changeOrderId)
    .single()
  if (!co) return { ok: false, error: "Change order not found" }

  const wo = (co.partner_work_orders as Record<string, unknown>) || {}
  const [partner, mp, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(wo.partner_id as string),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }

  return issueGeneratedDocument({
    partnerId: wo.partner_id as string,
    type: "CHANGE_ORDER",
    sourceRecordType: "partner_change_order",
    sourceRecordId: changeOrderId,
    generatedBy,
    metadata: { workOrderId: co.work_order_id, decision: co.status },
    render: (control) => ({
      pdf: renderChangeOrder(
        {
          control,
          partner,
          workOrderRef: (wo.work_order_ref as string) || "",
          requestedBy: `${co.requested_by_type === "PARTNER" ? "Partner" : "MartPoint"}`,
          description: co.description as string,
          reason: (co.reason as string | null) ?? null,
          impactScope: (co.impact_scope as string | null) ?? null,
          impactFee: co.impact_fee != null ? fmtMoney(co.impact_fee as number, "NGN") : null,
          impactSchedule: (co.impact_schedule as string | null) ?? null,
          decision: co.status === "REJECTED" || co.status === "DEFERRED" ? co.status : "APPROVED",
          decisionReason: (co.decision_reason as string | null) ?? null,
          decidedBy: { name: generatedBy !== "system" ? generatedBy : (mp.ownerName || ""), title: "Partner Operations", email: mp.noticeEmail },
        },
        { logoDataUrl }
      ),
    }),
  })
}

/* ─── 9. Data Processing Addendum (on demand) ─── */

export async function issueDpaDocument(
  partnerId: string,
  generatedBy: string
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const [partner, mp, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(partnerId),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }
  const address = [partner.city, partner.state, partner.country].filter(Boolean).join(", ")

  return issueGeneratedDocument({
    partnerId,
    type: "DATA_PROCESSING_ADDENDUM",
    sourceRecordType: "partner",
    sourceRecordId: partnerId,
    generatedBy,
    render: (control) => ({
      pdf: renderDataProcessingAddendum(
        {
          control,
          partner,
          partnerAddress: address || null,
          martpoint: { legalName: mp.legalName, registrationNo: mp.registrationNo, registeredAddress: mp.registeredAddress },
          effectiveDate: control.generatedAt,
        },
        { logoDataUrl }
      ),
    }),
  })
}

/* ─── 10. Training Record ─── */

export async function issueTrainingRecordDocument(
  trainingRecordId: string,
  generatedBy: string
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const { data: rec } = await supabase
    .from("customer_training_records")
    .select("*, businesses(business_name), partner_users(full_name)")
    .eq("id", trainingRecordId)
    .single()
  if (!rec) return { ok: false, error: "Training record not found" }

  const [partner, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(rec.partner_id as string),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }

  const attendeeNames = ((rec.attendee_names as string | null) || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)

  return issueGeneratedDocument({
    partnerId: rec.partner_id as string,
    type: "TRAINING_RECORD",
    sourceRecordType: "customer_training_record",
    sourceRecordId: trainingRecordId,
    generatedBy,
    metadata: { businessId: rec.business_id, trainingType: rec.training_type },
    render: (control) => ({
      pdf: renderTrainingRecord(
        {
          control,
          partner,
          customer: ((rec.businesses as Record<string, unknown> | null)?.business_name as string) || "Customer",
          module: rec.training_type as string,
          trainer: ((rec.partner_users as Record<string, unknown> | null)?.full_name as string) || "",
          sessionDate: (rec.training_date as string | null) ?? null,
          deliveryMode: null,
          attendees: attendeeNames.map((name) => ({ name, role: "", attended: "Yes", completed: "Yes" })),
          coverage: (rec.notes as string | null) ?? null,
          openItems: rec.customer_acknowledged ? null : "Customer acknowledgement pending",
        },
        { logoDataUrl }
      ),
    }),
  })
}

/* ─── 12. Completion and Handover Record ─── */

export async function issueCompletionHandoverDocument(
  workOrderId: string,
  generatedBy: string
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const { data: wo } = await supabase
    .from("partner_work_orders")
    .select("*, businesses(business_name)")
    .eq("id", workOrderId)
    .single()
  if (!wo) return { ok: false, error: "Work order not found" }

  const { data: milestones } = await supabase
    .from("partner_work_order_milestones")
    .select("*")
    .eq("work_order_id", workOrderId)
    .order("order_index", { ascending: true })

  const [partner, mp, logoDataUrl] = await Promise.all([
    loadPartnerIdentity(wo.partner_id as string),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])
  if (!partner) return { ok: false, error: "Partner not found" }

  const ms = (milestones || []) as Record<string, unknown>[]
  const deliverables = ms.filter((m) => m.status === "ACCEPTED").map((m) => `${m.title} — accepted`)
  const outstanding = ms
    .filter((m) => m.status !== "ACCEPTED")
    .map((m) => ({ item: m.title as string, owner: m.status === "REJECTED" ? "Partner" : "MartPoint review", dueDate: (m.due_date as string | null) ?? null }))

  return issueGeneratedDocument({
    partnerId: wo.partner_id as string,
    type: "COMPLETION_HANDOVER_RECORD",
    sourceRecordType: "partner_work_order",
    sourceRecordId: workOrderId,
    generatedBy,
    metadata: { workOrderRef: wo.work_order_ref },
    render: (control) => ({
      pdf: renderCompletionHandover(
        {
          control,
          partner,
          customer: ((wo.businesses as Record<string, unknown> | null)?.business_name as string) || "Customer",
          workOrderRef: (wo.work_order_ref as string | null) ?? null,
          deliverables,
          outstandingItems: outstanding,
          handoverNotes: null,
          accessRevoked: null,
          supportRoute: mp.noticeEmail,
          acceptedBy: { name: mp.ownerName || "", email: mp.ownerEmail || mp.noticeEmail },
        },
        { logoDataUrl }
      ),
    }),
  })
}

/* ─── 13. Go Live Decision ─── */

export async function issueGoLiveDecisionDocument(
  businessId: string,
  input: {
    decision: "APPROVED" | "DEFERRED" | "DECLINED"
    conditions?: string | null
    deploymentWindow?: string | null
    readinessSummary?: string | null
  },
  generatedBy: { id: string; name?: string | null }
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const { data: business } = await supabase
    .from("businesses")
    .select("id, business_name")
    .eq("id", businessId)
    .single()
  if (!business) return { ok: false, error: "Business not found" }

  // Find the implementation partner assigned to this customer, if any.
  const { data: assignment } = await supabase
    .from("partner_customer_assignments")
    .select("partner_id")
    .eq("business_id", businessId)
    .eq("status", "ACTIVE")
    .in("relationship_type", ["IMPLEMENTATION", "ACCOUNT_MANAGER"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const partnerId = (assignment?.partner_id as string | null) ?? null
  const [partner, mp, logoDataUrl] = await Promise.all([
    partnerId ? loadPartnerIdentity(partnerId) : Promise.resolve(null),
    getMartPointEntity(),
    loadLogoDataUrl(),
  ])

  return issueGeneratedDocument({
    partnerId,
    type: "GO_LIVE_DECISION",
    sourceRecordType: "business",
    sourceRecordId: businessId,
    generatedBy: generatedBy.id,
    metadata: { businessId, decision: input.decision },
    render: (control) => ({
      pdf: renderGoLiveDecision(
        {
          control,
          partner,
          customer: business.business_name as string,
          readinessSummary: input.readinessSummary ?? null,
          partnerRecommendation: null,
          decision: input.decision,
          conditions: input.conditions ?? null,
          deploymentWindow: input.deploymentWindow ?? null,
          decidedBy: {
            name: generatedBy.name || "Partner Operations",
            title: "MartPoint",
            email: mp.noticeEmail,
          },
        },
        { logoDataUrl }
      ),
    }),
  })
}

/* ─── 14. Implementation Fee Statement ─── */

export async function issueImplementationFeeStatement(
  partnerId: string,
  opts: { workOrderId?: string },
  generatedBy: string
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const [partner, logoDataUrl] = await Promise.all([loadPartnerIdentity(partnerId), loadLogoDataUrl()])
  if (!partner) return { ok: false, error: "Partner not found" }

  let woQuery = supabase
    .from("partner_work_orders")
    .select("id, work_order_ref, currency")
    .eq("partner_id", partnerId)
  if (opts.workOrderId) woQuery = woQuery.eq("id", opts.workOrderId)
  const { data: workOrders } = await woQuery
  const woMap = new Map(((workOrders || []) as Record<string, unknown>[]).map((w) => [w.id as string, w]))
  const woIds = [...woMap.keys()]
  if (woIds.length === 0) return { ok: false, error: "No work orders found for this partner" }

  const { data: milestones } = await supabase
    .from("partner_work_order_milestones")
    .select("*")
    .in("work_order_id", woIds)
    .order("due_date", { ascending: true })

  const currency = ((workOrders?.[0] as Record<string, unknown> | undefined)?.currency as string) || "NGN"
  const lines: ImplementationFeeLine[] = ((milestones || []) as Record<string, unknown>[]).map((m) => {
    const wo = woMap.get(m.work_order_id as string) as Record<string, unknown>
    return {
      workOrderRef: (wo?.work_order_ref as string) || "",
      milestone: m.title as string,
      submitted: (m.submitted_at as string | null) ?? null,
      decided: (m.reviewed_at as string | null) ?? null,
      acceptedValue: m.status === "ACCEPTED" && m.fee_amount != null ? fmtMoney(m.fee_amount as number, currency) : "—",
      status: m.status as string,
    }
  })
  const total = ((milestones || []) as Record<string, unknown>[])
    .filter((m) => m.status === "ACCEPTED")
    .reduce((s, m) => s + (Number(m.fee_amount) || 0), 0)

  return issueGeneratedDocument({
    partnerId,
    type: "IMPLEMENTATION_FEE_STATEMENT",
    sourceRecordType: "partner",
    sourceRecordId: partnerId,
    generatedBy,
    metadata: { workOrderId: opts.workOrderId ?? null, milestoneCount: lines.length },
    render: (control) => ({
      pdf: renderImplementationFeeStatement(
        { control, partner, currency, lines, expenses: null, adjustments: null, total },
        { logoDataUrl }
      ),
    }),
  })
}

/* ─── 11. UAT and Acceptance Record (on demand) ─── */

export async function issueUatRecordDocument(
  partnerId: string,
  input: {
    customerName: string
    systemVersion?: string | null
    testDates?: string | null
    scenarios?: { testCase: string; expected: string; actual: string; result: string }[]
    defects?: { description: string; severity: string; owner: string; disposition: string }[]
    decision: "ACCEPTED" | "CONDITIONALLY_ACCEPTED" | "REJECTED"
    decisionNotes?: string | null
    customerApprover: { name: string; email: string }
  },
  generatedBy: string
): Promise<{ ok: boolean; error?: string; document?: GeneratedDocRecord }> {
  const [partner, logoDataUrl] = await Promise.all([loadPartnerIdentity(partnerId), loadLogoDataUrl()])
  if (!partner) return { ok: false, error: "Partner not found" }

  return issueGeneratedDocument({
    partnerId,
    type: "UAT_RECORD",
    sourceRecordType: "partner",
    sourceRecordId: partnerId,
    generatedBy,
    metadata: { decision: input.decision, customerName: input.customerName },
    render: (control) => ({
      pdf: renderUatRecord(
        {
          control,
          partner,
          customer: input.customerName,
          systemVersion: input.systemVersion ?? null,
          testDates: input.testDates ?? null,
          scenarios: input.scenarios ?? [],
          defects: input.defects ?? [],
          decision: input.decision,
          decisionNotes: input.decisionNotes ?? null,
          customerApprover: input.customerApprover,
        },
        { logoDataUrl }
      ),
    }),
  })
}
