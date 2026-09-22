import crypto from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordStatusHistory, sendApplicationStatusEmail, PARTNER_TYPE_LABELS, type ApplicationStatus } from "@/lib/partners"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"
import { uploadPartnerDocument, createSignedDocUrl } from "@/lib/partner-documents"
import {
  generatePartnerAgreementPdf,
  earningBasesFor,
  defaultPermittedActivities,
  defaultInsurance,
  defaultTrigger,
  AGREEMENT_TEMPLATE_VERSION,
  type AgreementInput,
  type CommercialSection,
} from "@/lib/partner-agreement"

/* ─── Partner agreement generation ───
 * Generates the clean partner signing copy from the master template (v1.0): Common
 * Terms + Appointment Summary + only the Partner Type Schedules matching the approved
 * type + Commercial Terms (admin-entered, one section per earning basis) + Signature
 * Page. The internal automation/approval sections and unused schedules are never
 * rendered. Generated PDFs are stored in the private partner-documents bucket as
 * "Partner Agreement (Generated)" so partner-uploaded signed copies stay distinct.
 */

const GENERATABLE_STATUSES = ["APPROVED", "AGREEMENT_PENDING", "TRAINING", "CERTIFICATION_PENDING", "ACTIVE"]
const GENERATED_DOC_TYPE = "Partner Agreement (Generated)"

function martpointDefaults() {
  return {
    legalName: process.env.MARTPOINT_LEGAL_NAME || "MartPoint",
    registrationNo: process.env.MARTPOINT_REGISTRATION_NO || "",
    registeredAddress: process.env.MARTPOINT_REGISTERED_ADDRESS || "",
    noticeEmail: process.env.MARTPOINT_NOTICE_EMAIL || "partners@martpoint.com.ng",
    signatoryName: process.env.MARTPOINT_SIGNATORY_NAME || "",
    signatoryTitle: process.env.MARTPOINT_SIGNATORY_TITLE || "",
    signatoryEmail: process.env.MARTPOINT_SIGNATORY_EMAIL || "",
  }
}

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
  const earningBases = earningBasesFor(partnerType).map((b) => ({ ...b, trigger: defaultTrigger(b.earningCategory) }))

  const { data: generated } = await supabase
    .from("partner_documents")
    .select("id, document_type, storage_path, original_filename, file_size, verification_status, uploaded_at")
    .eq("application_id", id)
    .eq("document_type", GENERATED_DOC_TYPE)
    .order("uploaded_at", { ascending: false })

  const agreements = await Promise.all(
    (generated || []).map(async (d) => ({
      id: d.id as string,
      fileName: d.original_filename as string,
      fileSize: d.file_size as number,
      status: d.verification_status as string,
      uploadedAt: d.uploaded_at as string,
      signedUrl: d.storage_path ? await createSignedDocUrl(d.storage_path as string, 300) : null,
    }))
  )

  return NextResponse.json({
    generatable: GENERATABLE_STATUSES.includes(app.status as string),
    templateVersion: AGREEMENT_TEMPLATE_VERSION,
    partnerType,
    partnerTypeLabel: PARTNER_TYPE_LABELS[partnerType as keyof typeof PARTNER_TYPE_LABELS] || partnerType,
    earningBases,
    agreements,
    defaults: {
      agreementId: `AGR-${app.reference_number}`,
      effectiveDate: new Date().toISOString().slice(0, 10),
      martpoint: martpointDefaults(),
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
        insurance: defaultInsurance(partnerType),
      },
    },
  })
}

/* ─── POST: generate the agreement, store it, move status to AGREEMENT_PENDING ─── */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

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
    const mp = { ...martpointDefaults(), ...(body.martpoint || {}) }
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
      gradeByType: "",
      territory: ((app.geographic_coverage as string[]) || []).join(", ") || (app.country as string) || "",
      permittedActivities: defaultPermittedActivities(partnerType),
      additionalProhibitions: "None beyond the Common Terms and the applicable Partner Type Schedule.",
      insurance: defaultInsurance(partnerType),
      martpointOwnerName: "",
      martpointOwnerEmail: "",
      ...(body.appointment || {}),
    }

    const commercials = (body.commercials || []) as CommercialSection[]
    if (!commercials.length) {
      return NextResponse.json({ error: "At least one commercial section is required" }, { status: 400 })
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

    const input: AgreementInput = {
      agreementId: `AGR-${app.reference_number}`,
      effectiveDate: body.effectiveDate || new Date().toISOString().slice(0, 10),
      initialTermMonths: body.initialTermMonths || "12",
      renewalRule: body.renewalRule || "",
      noticeDays: body.noticeDays || "30",
      disputeDays: body.disputeDays || "30",
      securityNoticeHours: body.securityNoticeHours || "4",
      referralProtectionDays: body.referralProtectionDays || "90",
      liabilityFloor: body.liabilityFloor || "",
      partnerType,
      martpoint: mp,
      partner: pt,
      appointment,
      technology: body.technology || undefined,
      commercials,
      additionalSchedules,
    }

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

    const upload = await uploadPartnerDocument(id, generated.fileName, "application/pdf", generated.bytes)
    if (!upload.ok || !upload.doc) {
      return NextResponse.json({ error: upload.error || "Failed to store agreement" }, { status: 500 })
    }

    const { data: partnerRow } = await supabase
      .from("partners")
      .select("id")
      .eq("application_id", id)
      .maybeSingle()

    const now = new Date().toISOString()
    const { data: docRow, error: docErr } = await supabase
      .from("partner_documents")
      .insert({
        application_id: id,
        partner_id: (partnerRow?.id as string) || null,
        document_type: GENERATED_DOC_TYPE,
        storage_path: upload.doc.storagePath,
        original_filename: generated.fileName,
        mime_type: "application/pdf",
        file_size: generated.bytes.length,
        verification_status: "UNDER_REVIEW",
        required: false,
        requested_by: session!.userId,
        notes: `Generated from master template v${AGREEMENT_TEMPLATE_VERSION}. SHA-256: ${docHash}`,
        uploaded_at: now,
      })
      .select()
      .single()
    if (docErr || !docRow) {
      return NextResponse.json({ error: "Failed to record agreement document" }, { status: 500 })
    }

    const ctx = auditContextFromSession(session, request)
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.PARTNER_AGREEMENT_GENERATED,
      entityType: AUDIT_ENTITIES.PARTNER_DOCUMENT,
      entityId: docRow.id,
      metadata: {
        applicationId: id,
        reference: app.reference_number,
        agreementId: input.agreementId,
        templateVersion: AGREEMENT_TEMPLATE_VERSION,
        partnerType,
        includedSchedules: generated.includedSchedules,
        sha256: docHash,
        fileName: generated.fileName,
      },
    })

    // First generation off an approved application moves it to AGREEMENT_PENDING.
    if (app.status === "APPROVED") {
      await supabase
        .from("partner_applications")
        .update({ status: "AGREEMENT_PENDING", updated_at: now, reviewed_at: now, reviewed_by: session!.userId })
        .eq("id", id)
      await recordStatusHistory(id, null, "APPROVED", "AGREEMENT_PENDING", `Partner agreement generated (${input.agreementId})`, session!.userId, {
        changedByName: session!.name || session!.username,
        eventType: "STATUS_CHANGE",
      })
      await sendApplicationStatusEmail(
        app.email as string,
        (app.full_name as string) || (app.business_name as string) || "there",
        app.reference_number as string,
        "AGREEMENT_PENDING" as ApplicationStatus,
        "APPROVED",
        "Your partnership agreement is being prepared for signature."
      )
    } else {
      await recordStatusHistory(id, null, app.status as string, app.status as string, `Partner agreement regenerated (${input.agreementId})`, session!.userId, {
        changedByName: session!.name || session!.username,
        eventType: "NOTE_ADDED",
      })
    }

    const signedUrl = await createSignedDocUrl(upload.doc.storagePath, 300)
    return NextResponse.json({
      success: true,
      agreementId: input.agreementId,
      includedSchedules: generated.includedSchedules,
      document: { id: docRow.id, fileName: generated.fileName, signedUrl },
    })
  } catch (err) {
    console.error("[agreement] generation failed:", err)
    return NextResponse.json({ error: "Failed to generate agreement" }, { status: 500 })
  }
}
