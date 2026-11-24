import crypto from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordStatusHistory, PARTNER_TYPE_LABELS } from "@/lib/partners"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"
import { uploadPartnerDocument, createSignedDocUrl } from "@/lib/partner-documents"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/email-html"
import { getMartPointEntity } from "@/lib/martpoint-entity"
import { registerAgreementDocument } from "@/lib/partner-generated-docs"
import {
  generatePartnerAgreementPdf,
  earningBasesFor,
  defaultPermittedActivities,
  defaultInsurance,
  defaultProhibitions,
  commercialFieldDefaults,
  defaultTrigger,
  AGREEMENT_TEMPLATE_VERSION,
  type AgreementInput,
  type CommercialSection,
} from "@/lib/partner-agreement"

/* ─── Partner agreement generation ───
 * Generates the clean partner signing copy from the master template (v1.1): Common
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
    defaults: { ...commercialFieldDefaults(b.earningCategory), trigger: defaultTrigger(b.earningCategory) },
  }))

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
    assignedUsers: assignedUsers || [],
    earningBases,
    agreements,
    defaults: {
      agreementId: `AGR-${app.reference_number}`,
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

/* ─── POST: generate the agreement, store it, move status to AGREEMENT_PENDING ─── */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (session?.role !== "Admin") return NextResponse.json({ error: "Only an Admin can authorize MartPoint's electronic signature" }, { status: 403 })

  const { id } = await params
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    if (body.authorizeCompanySignature !== true) {
      return NextResponse.json({ error: "Confirm that this agreement is approved and authorize MartPoint's electronic signature" }, { status: 400 })
    }

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
      gradeByType: "",
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

    const input: AgreementInput = {
      agreementId: `AGR-${app.reference_number}`,
      effectiveDate: body.effectiveDate || new Date().toISOString().slice(0, 10),
      initialTermMonths: body.initialTermMonths || "3",
      renewalRule: body.renewalRule || "",
      noticeDays: body.noticeDays || "30",
      disputeDays: body.disputeDays || "30",
      securityNoticeHours: body.securityNoticeHours || "4",
      referralProtectionDays: body.referralProtectionDays || "90",
      liabilityFloor: body.liabilityFloor || mpEntity.liabilityFloor || "",
      partnerType,
      martpoint: mp,
      partner: pt,
      appointment,
      technology: body.technology || undefined,
      commercials,
      additionalSchedules,
    }

    const termsSha256 = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex")
    const martpointSignedAt = new Date().toISOString()
    const martpointSignatureEventId = `MPES-${crypto.randomUUID()}`
    input.execution = { termsSha256, martpointSignedAt, martpointEventId: martpointSignatureEventId }

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

    // Mirror the agreement into the generated-documents registry so partners
    // see it alongside other portal-issued records.
    await registerAgreementDocument({
      partnerId: (partnerRow?.id as string) || null,
      applicationId: id,
      agreementId: input.agreementId,
      storagePath: upload.doc.storagePath,
      fileName: generated.fileName,
      fileSize: generated.bytes.length,
      checksum: docHash,
      templateVersion: String(AGREEMENT_TEMPLATE_VERSION),
      generatedBy: session!.userId,
    }).catch((e) => console.error("[agreement] registry insert failed:", e))

    await supabase
      .from("partner_agreement_signing")
      .update({ status: "SUPERSEDED", updated_at: now })
      .eq("application_id", id)
      .eq("status", "AWAITING_PARTNER")

    const signingToken = crypto.randomBytes(32).toString("hex")
    const signingExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const { error: signingError } = await supabase.from("partner_agreement_signing").insert({
      application_id: id,
      partner_id: (partnerRow?.id as string) || null,
      source_document_id: docRow.id,
      agreement_id: input.agreementId,
      token_hash: crypto.createHash("sha256").update(signingToken).digest("hex"),
      token_expires_at: signingExpiresAt,
      status: "AWAITING_PARTNER",
      agreement_payload: input,
      terms_sha256: termsSha256,
      martpoint_signatory_name: input.martpoint.signatoryName,
      martpoint_signatory_title: input.martpoint.signatoryTitle,
      martpoint_signatory_email: input.martpoint.signatoryEmail,
      martpoint_signed_at: martpointSignedAt,
      martpoint_signature_event_id: martpointSignatureEventId,
      martpoint_signed_by_user_id: session!.userId,
      created_at: now,
      updated_at: now,
    })
    if (signingError) return NextResponse.json({ error: "Agreement was generated, but its signing request could not be created" }, { status: 500 })

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
    } else {
      await recordStatusHistory(id, null, app.status as string, app.status as string, `Partner agreement regenerated (${input.agreementId})`, session!.userId, {
        changedByName: session!.name || session!.username,
        eventType: "NOTE_ADDED",
      })
    }

    const appBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"
    const signingUrl = `${appBaseUrl}/partners/sign-agreement?token=${encodeURIComponent(signingToken)}`
    const partnerName = (app.full_name as string) || (app.business_name as string) || "Partner"
    const signingEmailSent = await sendEmail({
      to: app.email as string,
      subject: "Please review and sign your MartPoint Partner Agreement",
      text: `Hello ${partnerName},\n\nYour MartPoint Partner Agreement ${input.agreementId} is ready. MartPoint has signed it electronically. Please review the agreement and sign it using this secure link within 14 days:\n\n${signingUrl}\n\nIf you have questions, reply to this email or contact partners@martpoint.com.ng.`,
      html: `<p>Hello ${escapeHtml(partnerName)},</p><p>Your MartPoint Partner Agreement <strong>${escapeHtml(input.agreementId)}</strong> is ready. MartPoint has signed it electronically. Please review and sign it using the secure link below within 14 days.</p><p><a href="${escapeHtml(signingUrl)}" style="display:inline-block;background:#0057ff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px">Review and sign agreement</a></p><p>If you have questions, reply to this email or contact partners@martpoint.com.ng.</p>`,
      route: "partner_application",
      useRouteRecipients: false,
      replyTo: "partners@martpoint.com.ng",
    })
    await supabase.from("partner_agreement_signing").update({
      email_sent: signingEmailSent,
      email_sent_at: signingEmailSent ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("token_hash", crypto.createHash("sha256").update(signingToken).digest("hex"))

    const signedUrl = await createSignedDocUrl(upload.doc.storagePath, 300)
    return NextResponse.json({
      success: true,
      agreementId: input.agreementId,
      includedSchedules: generated.includedSchedules,
      document: { id: docRow.id, fileName: generated.fileName, signedUrl },
      signing: { emailSent: signingEmailSent, signingUrl, expiresAt: signingExpiresAt },
    })
  } catch (err) {
    console.error("[agreement] generation failed:", err)
    return NextResponse.json({ error: "Failed to generate agreement" }, { status: 500 })
  }
}
