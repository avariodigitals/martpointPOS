import crypto from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { PARTNER_TYPE_LABELS } from "@/lib/partners"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"
import { uploadPartnerDocument, createSignedDocUrl } from "@/lib/partner-documents"
import { getMartPointEntity } from "@/lib/martpoint-entity"
import {
  generatePartnerAgreementPdf,
  earningBasesFor,
  defaultPermittedActivities,
  defaultInsurance,
  defaultProhibitions,
  commercialFieldDefaults,
  defaultTrigger,
  normalizeAgreementInputForMaster,
  AGREEMENT_TEMPLATE_VERSION,
  type AgreementInput,
  type CommercialSection,
} from "@/lib/partner-agreement"
import { agreementTypeKeys } from "@/lib/partner-agreement-content"
import { validateAgreementInput } from "@/lib/partner-agreement-validation"
import { stableJsonStringify } from "@/lib/stable-json"

/* ─── Partner agreement generation ───
 * Generates the clean partner signing copy from the current master template: Common
 * Terms + Appointment Summary + only the Partner Type Schedules matching the approved
 * type + Commercial Terms (admin-entered, one section per earning basis) + Signature
 * Page. The internal automation/approval sections and unused schedules are never
 * rendered. Generated PDFs are stored in the private partner-documents bucket as
 * "Partner Agreement (Generated)" so partner-uploaded signed copies stay distinct.
 */

const GENERATABLE_STATUSES = ["APPROVED", "AGREEMENT_PENDING", "TRAINING", "CERTIFICATION_PENDING", "ACTIVE"]
const GENERATED_DOC_TYPE = "Partner Agreement (Generated)"

/* MartPoint contracting entity is resolved by lib/martpoint-entity.ts
 * (admin Settings → MARTPOINT_* env vars → fallbacks). */

function partnerAddress(app: Record<string, unknown>): string {
  return [app.business_address, app.city, app.state, app.country].filter(Boolean).join(", ")
}

/* ─── GET: form defaults + previously generated agreements ─── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { id } = await params
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  const { data: app, error } = await supabase
    .from("partner_applications")
    .select("*")
    .eq("id", id)
    .single()
  if (error || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 })
  }

  const partnerType = app.requested_partner_type as string
  const mp = await getMartPointEntity()
  const { data: assignedUsers } = await supabase
    .from("users")
    .select("id, name, username, email, role")
    .eq("status", "ACTIVE")
    .order("name")
  const earningBases = earningBasesFor(partnerType).map((b) => ({
    ...b,
    defaults: { ...commercialFieldDefaults(b.earningCategory, b.partnerTypeLabel), trigger: defaultTrigger(b.earningCategory) },
  }))

  const { data: generated } = await supabase
    .from("partner_documents")
    .select("id, document_type, storage_path, original_filename, file_size, verification_status, uploaded_at")
    .eq("application_id", id)
    .eq("document_type", GENERATED_DOC_TYPE)
    .order("uploaded_at", { ascending: false })

  const { data: signingRequests } = await supabase
    .from("partner_agreement_signing")
    .select("source_document_id, status, created_at")
    .eq("application_id", id)
    .order("created_at", { ascending: false })
  const { count: issuedRevisionCount } = await supabase
    .from("partner_agreement_signing")
    .select("id", { count: "exact", head: true })
    .eq("application_id", id)
  const { count: draftRevisionCount } = await supabase
    .from("partner_agreement_drafts")
    .select("id", { count: "exact", head: true })
    .eq("application_id", id)
  const signingStatusByDocument = new Map<string, string>()
  for (const signing of signingRequests || []) {
    const sourceDocumentId = signing.source_document_id as string | null
    if (sourceDocumentId && !signingStatusByDocument.has(sourceDocumentId)) {
      signingStatusByDocument.set(sourceDocumentId, String(signing.status))
    }
  }

  const agreements = await Promise.all(
    (generated || []).map(async (d) => ({
      id: d.id as string,
      fileName: d.original_filename as string,
      fileSize: d.file_size as number,
      status: signingStatusByDocument.has(String(d.id))
        ? signingStatusByDocument.get(String(d.id)) as string
        : d.verification_status as string,
      uploadedAt: d.uploaded_at as string,
      signedUrl: d.storage_path ? await createSignedDocUrl(d.storage_path as string, 300) : null,
    }))
  )

  const { data: draft } = await supabase
    .from("partner_agreement_drafts")
    .select("id, agreement_id, agreement_revision_id, agreement_payload, terms_sha256, draft_document_path, created_at, status")
    .eq("application_id", id)
    .eq("status", "AWAITING_REVIEW")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const pendingDraft = draft ? {
    id: String(draft.id),
    agreementId: String(draft.agreement_revision_id || draft.agreement_id),
    createdAt: String(draft.created_at),
    previewUrl: await createSignedDocUrl(String(draft.draft_document_path), 300),
    payload: draft.agreement_payload,
    templateVersion: String((draft.agreement_payload as Record<string, unknown> | null)?.templateVersion || "legacy"),
    integrityValid: crypto.createHash("sha256").update(stableJsonStringify(draft.agreement_payload)).digest("hex") === String(draft.terms_sha256 || ""),
  } : null

  return NextResponse.json({
    generatable: GENERATABLE_STATUSES.includes(app.status as string),
    templateVersion: AGREEMENT_TEMPLATE_VERSION,
    partnerType,
    partnerTypeLabel: PARTNER_TYPE_LABELS[partnerType as keyof typeof PARTNER_TYPE_LABELS] || partnerType,
    assignedUsers: assignedUsers || [],
    earningBases,
    agreements,
    pendingDraft,
    defaults: {
      agreementId: `AGR-${app.reference_number}-R${Math.max(issuedRevisionCount ?? 0, draftRevisionCount ?? 0) + 1}`,
      effectiveDate: new Date().toISOString().slice(0, 10),
      liabilityFloor: mp.liabilityFloor,
      coverage: (app.geographic_coverage as string[]) || [],
      country: (app.country as string) || "",
      martpoint: mp,
      partner: {
        legalName: (app.business_name as string) || (app.full_name as string),
        registrationNo: (app.registration_number as string) || "",
        registeredAddress: partnerAddress(app),
        email: (app.email as string) || "",
        noticeEmail: (app.email as string) || "",
        operationsContactName: (app.full_name as string) || "",
        operationsContactEmail: (app.email as string) || "",
        signatoryName: (app.full_name as string) || "",
        signatoryTitle: "",
        signatoryEmail: (app.email as string) || "",
      },
      appointment: {
        territory: ((app.geographic_coverage as string[]) || []).join(", ") || (app.country as string) || "",
        permittedActivities: defaultPermittedActivities(partnerType),
        additionalProhibitions: defaultProhibitions(partnerType),
        insurance: defaultInsurance(partnerType),
        martpointOwnerName: mp.ownerName,
        martpointOwnerEmail: mp.ownerEmail,
      },
    },
  })
}

/* ─── POST: generate and store an unsigned draft for admin review ─── */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (session?.role !== "Admin") return NextResponse.json({ error: "Only an Admin can prepare partner agreement drafts" }, { status: 403 })

  const { id } = await params
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { data: app, error } = await supabase
      .from("partner_applications")
      .select("*")
      .eq("id", id)
      .single()
    if (error || !app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    // Safeguard: agreements are generated only from an approved application.
    if (!GENERATABLE_STATUSES.includes(app.status as string)) {
      return NextResponse.json(
        { error: "Agreement can only be generated once the application is approved" },
        { status: 400 }
      )
    }

    const partnerType = app.requested_partner_type as string
    const mpEntity = await getMartPointEntity()
    const mp = {
      legalName: mpEntity.legalName,
      registrationNo: mpEntity.registrationNo,
      registeredAddress: mpEntity.registeredAddress,
      noticeEmail: mpEntity.noticeEmail,
      signatoryName: mpEntity.signatoryName,
      signatoryTitle: mpEntity.signatoryTitle,
      signatoryEmail: mpEntity.signatoryEmail,
      ...(body.martpoint || {}),
    }
    if (!mp.signatoryName?.trim() || !mp.signatoryTitle?.trim() || !mp.signatoryEmail?.trim()) {
      return NextResponse.json({ error: "Complete the authorized MartPoint signatory name, title and email in Legal Entity settings before signing" }, { status: 400 })
    }
    const partnerDefaults = {
      legalName: (app.business_name as string) || (app.full_name as string),
      registrationNo: (app.registration_number as string) || "",
      registeredAddress: partnerAddress(app),
      email: (app.email as string) || "",
      noticeEmail: (app.email as string) || "",
      operationsContactName: (app.full_name as string) || "",
      operationsContactEmail: (app.email as string) || "",
      signatoryName: (app.full_name as string) || "",
      signatoryTitle: "",
      signatoryEmail: (app.email as string) || "",
    }
    const pt = { ...partnerDefaults, ...(body.partner || {}) }
    const appointment = {
      levelByType: "",
      gradeByType: "Ungraded — subject to verified business delivery and performance assessment",
      publicDirectoryStatus: "Not yet eligible — subject to successful business delivery and MartPoint approval",
      territory: ((app.geographic_coverage as string[]) || []).join(", ") || (app.country as string) || "",
      permittedActivities: defaultPermittedActivities(partnerType),
      additionalProhibitions: defaultProhibitions(partnerType),
      insurance: defaultInsurance(partnerType),
      martpointOwnerName: mpEntity.ownerName,
      martpointOwnerEmail: mpEntity.ownerEmail,
      ...(body.appointment || {}),
    }

    const commercials = (body.commercials || []) as CommercialSection[]
    if (!commercials.length) {
      return NextResponse.json({ error: "At least one commercial section is required" }, { status: 400 })
    }

    const { data: activeUsers, error: activeUsersError } = await supabase
      .from("users")
      .select("name, email, role")
      .eq("status", "ACTIVE")
    if (activeUsersError) {
      return NextResponse.json({ error: "Could not verify the assigned MartPoint users" }, { status: 500 })
    }
    const users = activeUsers || []
    const ownerIsAssigned = users.some((user) =>
      ["Admin", "Sales"].includes(user.role as string) &&
      user.name === appointment.martpointOwnerName &&
      Boolean(user.email) && user.email === appointment.martpointOwnerEmail
    )
    if (!ownerIsAssigned) {
      return NextResponse.json({ error: "Select an active Admin or Sales user as the MartPoint owner" }, { status: 400 })
    }
    for (const [index, commercial] of commercials.entries()) {
      if (!commercial.rateOrFee?.trim()) {
        return NextResponse.json({ error: `Commercial section ${index + 1} needs a rate or fixed fee` }, { status: 400 })
      }
      if (!users.some((user) => ["Admin", "Finance"].includes(user.role as string) && user.name === commercial.financeApprover)) {
        return NextResponse.json({ error: `Select an active Finance or Admin user for commercial section ${index + 1}` }, { status: 400 })
      }
      if (!users.some((user) => user.role === "Admin" && user.name === commercial.managementApprover)) {
        return NextResponse.json({ error: `Select an active Admin user as the management approver for commercial section ${index + 1}` }, { status: 400 })
      }
    }

    if (partnerType === "TECHNOLOGY" && !body.technology?.solutionName?.trim()) {
      return NextResponse.json(
        { error: "Technology Partner agreements require the approved solution name, version and use case" },
        { status: 400 }
      )
    }

    const additionalSchedules = ((body.additionalSchedules || []) as { title?: string; body?: string }[])
      .map((s) => ({ title: (s.title || "").trim(), body: (s.body || "").trim() }))
      .filter((s) => s.title && s.body)

    if (agreementTypeKeys(partnerType).includes("implementation") &&
      !additionalSchedules.some((schedule) => /data processing addendum/i.test(schedule.title))) {
      additionalSchedules.push({
        title: "Data Processing Addendum",
        body: "This Schedule applies only to a processing activity expressly approved in a signed Work Order. The Parties shall record the actual controller, processor or independent-controller roles; purpose; duration; data subjects; personal-data categories; operations; documented instructions; approved systems, locations and subprocessors before access. No role is presumed solely by appointment. Each Party shall comply with the Nigeria Data Protection Act 2023 and applicable Nigeria Data Protection Commission directives. A processor acts only on documented instructions, maintains appropriate technical and organisational safeguards, binds authorised personnel to confidentiality, obtains prior written approval for subprocessors, assists with data-subject requests and audits, and returns or securely deletes data when instructed or when the approved purpose ends, except where law requires retention. A Party discovering a suspected or actual incident affecting the processing shall notify the other affected Party within four hours of discovery, preserve evidence, contain the incident and cooperate with legally required notifications. Processing and customer-environment access are prohibited until this Addendum is signed and the applicable Work Order identifies the processing details and access permissions. This contractual four-hour notice does not replace or extend any statutory deadline."
      })
    }

    const [signingRevisions, draftRevisions] = await Promise.all([
      supabase.from("partner_agreement_signing").select("id", { count: "exact", head: true }).eq("application_id", id),
      supabase.from("partner_agreement_drafts").select("id", { count: "exact", head: true }).eq("application_id", id),
    ])
    const input = normalizeAgreementInputForMaster({
      agreementId: `AGR-${app.reference_number}-R${Math.max(signingRevisions.count ?? 0, draftRevisions.count ?? 0) + 1}`,
      effectiveDate: body.effectiveDate || "",
      initialTermMonths: body.initialTermMonths || "",
      renewalRule: body.renewalRule || "",
      noticeDays: body.noticeDays || "",
      disputeDays: body.disputeDays || "",
      securityNoticeHours: body.securityNoticeHours || "",
      referralProtectionDays: body.referralProtectionDays || "",
      liabilityFloor: body.liabilityFloor || "",
      partnerType,
      martpoint: mp,
      partner: pt,
      appointment,
      technology: body.technology || undefined,
      commercials,
      additionalSchedules,
    } as AgreementInput)

    const validationErrors = validateAgreementInput(input)
    if (validationErrors.length) {
      return NextResponse.json({ error: "Agreement cannot be generated until its mandatory terms are complete.", validationErrors }, { status: 400 })
    }

    const termsSha256 = crypto.createHash("sha256").update(stableJsonStringify(input)).digest("hex")

    // jsPDF can't embed WebP — the committed PNG logo is used for the letterhead.
    let logoDataUrl: string | undefined
    try {
      const logo = await fs.readFile(path.join(process.cwd(), "public", "logo.png"))
      logoDataUrl = `data:image/png;base64,${logo.toString("base64")}`
    } catch {
      logoDataUrl = undefined
    }

    const generated = generatePartnerAgreementPdf(input, { logoDataUrl })
    const docHash = crypto.createHash("sha256").update(generated.bytes).digest("hex")

    const upload = await uploadPartnerDocument(id, generated.fileName.replace(/\.pdf$/i, "-review-draft.pdf"), "application/pdf", generated.bytes)
    if (!upload.ok || !upload.doc) {
      return NextResponse.json({ error: upload.error || "Failed to store agreement draft" }, { status: 500 })
    }

    const { data: partnerRow } = await supabase
      .from("partners")
      .select("id")
      .eq("application_id", id)
      .maybeSingle()

    const now = new Date().toISOString()
    await supabase
      .from("partner_agreement_drafts")
      .update({ status: "SUPERSEDED", updated_at: now })
      .eq("application_id", id)
      .eq("status", "AWAITING_REVIEW")

    const { data: draftRow, error: draftError } = await supabase
      .from("partner_agreement_drafts")
      .insert({
        application_id: id,
        partner_id: (partnerRow?.id as string) || null,
        agreement_id: input.agreementId,
        agreement_revision_id: input.agreementId,
        agreement_payload: input,
        terms_sha256: termsSha256,
        draft_document_path: upload.doc.storagePath,
        draft_document_sha256: docHash,
        status: "AWAITING_REVIEW",
        created_by: session!.userId,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single()
    if (draftError || !draftRow) {
      return NextResponse.json({ error: "Failed to save agreement draft for review" }, { status: 500 })
    }

    const ctx = auditContextFromSession(session, request)
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.PARTNER_AGREEMENT_GENERATED,
      entityType: AUDIT_ENTITIES.PARTNER_APPLICATION,
      entityId: id,
      metadata: {
        applicationId: id,
        reference: app.reference_number,
        agreementId: input.agreementId,
        templateVersion: AGREEMENT_TEMPLATE_VERSION,
        partnerType,
        includedSchedules: generated.includedSchedules,
        sha256: docHash,
        draftId: draftRow.id,
        status: "AWAITING_REVIEW",
        fileName: generated.fileName,
      },
    })

    const signedUrl = await createSignedDocUrl(upload.doc.storagePath, 300)
    return NextResponse.json({
      success: true,
      agreementId: input.agreementId,
      templateVersion: AGREEMENT_TEMPLATE_VERSION,
      includedSchedules: generated.includedSchedules,
      draft: { id: draftRow.id, fileName: upload.doc.originalFilename, previewUrl: signedUrl },
    })
  } catch (err) {
    console.error("[agreement] generation failed:", err)
    return NextResponse.json({ error: "Failed to generate agreement" }, { status: 500 })
  }
}

/* ─── DELETE: cancel an unissued review draft without deleting its history ─── */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const { id: applicationId } = await params
  const body = await request.json().catch(() => ({}))
  const draftId = String(body.draftId || "")
  if (!draftId) return NextResponse.json({ error: "Draft ID is required" }, { status: 400 })

  const { data: draft, error: draftError } = await supabase
    .from("partner_agreement_drafts")
    .select("id,agreement_revision_id,agreement_id,status")
    .eq("id", draftId)
    .eq("application_id", applicationId)
    .eq("status", "AWAITING_REVIEW")
    .maybeSingle()
  if (draftError || !draft) return NextResponse.json({ error: "This draft is no longer awaiting review" }, { status: 409 })

  const now = new Date().toISOString()
  const updateDraftStatus = (status: "CANCELLED" | "SUPERSEDED") => supabase
    .from("partner_agreement_drafts")
    .update({ status, updated_at: now })
    .eq("id", draftId)
    .eq("application_id", applicationId)
    .eq("status", "AWAITING_REVIEW")
    .select("id")
    .maybeSingle()

  let cancellationStatus: "CANCELLED" | "SUPERSEDED" = "CANCELLED"
  let { data: cancelled, error: cancelError } = await updateDraftStatus(cancellationStatus)
  // Older databases may still have the original status constraint. Retire the
  // draft as SUPERSEDED there; the separate cancellation audit event records
  // the user's intent without deleting or changing its immutable content.
  if (cancelError?.code === "23514") {
    cancellationStatus = "SUPERSEDED"
    const fallback = await updateDraftStatus(cancellationStatus)
    cancelled = fallback.data
    cancelError = fallback.error
  }
  if (cancelError || !cancelled) {
    console.error("[agreement draft cancel] status update failed:", cancelError?.code, cancelError?.message)
    return NextResponse.json({ error: "Draft could not be retired. Confirm migration 222 is applied, reload this panel, and try again." }, { status: 409 })
  }

  const revisionId = String(draft.agreement_revision_id || draft.agreement_id)
  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.PARTNER_AGREEMENT_DRAFT_CANCELLED,
    entityType: AUDIT_ENTITIES.PARTNER_APPLICATION,
    entityId: applicationId,
    metadata: { applicationId, draftId, agreementRevisionId: revisionId, status: cancellationStatus, cancellationRequested: true },
  })
  return NextResponse.json({ success: true, agreementRevisionId: revisionId, status: cancellationStatus, message: "Draft cancelled. Its reviewed snapshot remains in agreement history." })
}
