import crypto from "crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordStatusHistory } from "@/lib/partners"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"
import { uploadPartnerDocument, createSignedDocUrl } from "@/lib/partner-documents"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/email-html"
import { registerAgreementDocument, supersedePreviousDocuments } from "@/lib/partner-generated-docs"
import { generatePartnerAgreementPdf, AGREEMENT_TEMPLATE_VERSION, type AgreementInput } from "@/lib/partner-agreement"
import { validateAgreementInput } from "@/lib/partner-agreement-validation"

export const dynamic = "force-dynamic"

const GENERATABLE_STATUSES = ["APPROVED", "AGREEMENT_PENDING", "TRAINING", "CERTIFICATION_PENDING", "ACTIVE"]
const GENERATED_DOC_TYPE = "Partner Agreement (Generated)"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (session?.role !== "Admin") return NextResponse.json({ error: "Only an Admin can authorize MartPoint's electronic signature" }, { status: 403 })

  const { id: applicationId } = await params
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  let claimedDraftId = ""
  let emailAttempted = false
  try {
    const body = await request.json().catch(() => ({}))
    if (body.authorizeCompanySignature !== true) {
      return NextResponse.json({ error: "Review the agreement, confirm it is approved for issue, and authorize MartPoint's electronic signature" }, { status: 400 })
    }
    const draftId = String(body.draftId || "")
    if (!draftId) return NextResponse.json({ error: "Generate and review an agreement draft first" }, { status: 400 })

    const { data: app, error: appError } = await supabase.from("partner_applications").select("*").eq("id", applicationId).single()
    if (appError || !app) return NextResponse.json({ error: "Application not found" }, { status: 404 })
    if (!GENERATABLE_STATUSES.includes(String(app.status))) return NextResponse.json({ error: "Agreement can only be issued once the application is approved" }, { status: 400 })

    const { data: draft, error: draftError } = await supabase.from("partner_agreement_drafts").select("*").eq("id", draftId).eq("application_id", applicationId).eq("status", "AWAITING_REVIEW").maybeSingle()
    if (draftError || !draft) return NextResponse.json({ error: "This draft is no longer awaiting review. Generate a fresh draft and review it before issuing." }, { status: 409 })

    const input = draft.agreement_payload as AgreementInput
    const validationErrors = validateAgreementInput(input)
    if (validationErrors.length) {
      return NextResponse.json({ error: "This saved draft does not meet the current agreement requirements. Regenerate and review it before issue.", validationErrors }, { status: 409 })
    }
    const currentTermsHash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex")
    if (currentTermsHash !== String(draft.terms_sha256)) {
      return NextResponse.json({ error: "The draft integrity check failed. Generate and review a fresh copy before issue." }, { status: 409 })
    }

    const now = new Date().toISOString()
    const { data: claimed, error: claimError } = await supabase.from("partner_agreement_drafts")
      .update({ status: "ISSUED", issued_at: now, issued_by: session.userId, updated_at: now })
      .eq("id", draftId).eq("status", "AWAITING_REVIEW").select("id").maybeSingle()
    if (claimError || !claimed) return NextResponse.json({ error: "This draft has already been issued or replaced" }, { status: 409 })
    claimedDraftId = draftId

    const partnerId = draft.partner_id ? String(draft.partner_id) : null
    const martpointSignedAt = new Date().toISOString()
    const martpointSignatureEventId = `MPES-${crypto.randomUUID()}`
    const termsSha256 = String(draft.terms_sha256)
    const signedInput: AgreementInput = {
      ...input,
      execution: { termsSha256, martpointSignedAt, martpointEventId: martpointSignatureEventId },
    }

    let logoDataUrl: string | undefined
    try {
      const logo = await fs.readFile(path.join(process.cwd(), "public", "logo.png"))
      logoDataUrl = `data:image/png;base64,${logo.toString("base64")}`
    } catch { logoDataUrl = undefined }

    const generated = generatePartnerAgreementPdf(signedInput, { logoDataUrl })
    const docHash = crypto.createHash("sha256").update(generated.bytes).digest("hex")
    const upload = await uploadPartnerDocument(applicationId, generated.fileName, "application/pdf", generated.bytes)
    if (!upload.ok || !upload.doc) throw new Error(upload.error || "Failed to store the issued agreement")

    const { data: activeGradingPolicy } = await supabase.from("partner_grading_policies")
      .select("version,status").eq("status", "APPROVED").order("effective_at", { ascending: false }).limit(1).maybeSingle()
    const gradingPolicyPdf = activeGradingPolicy
      ? await fs.readFile(path.join(process.cwd(), "public", "partner-resources", "MartPoint-Partner-Performance-Grading-Progression-Policy.pdf"))
      : null

    const { data: docRow, error: docError } = await supabase.from("partner_documents").insert({
      application_id: applicationId,
      partner_id: partnerId,
      document_type: GENERATED_DOC_TYPE,
      storage_path: upload.doc.storagePath,
      original_filename: generated.fileName,
      mime_type: "application/pdf",
      file_size: generated.bytes.length,
      verification_status: "UNDER_REVIEW",
      required: false,
      requested_by: session.userId,
      notes: `Generated from master template v${AGREEMENT_TEMPLATE_VERSION}. SHA-256: ${docHash}`,
      uploaded_at: now,
    }).select("id").single()
    if (docError || !docRow) throw new Error("Failed to record issued agreement")

    await supabase.from("partner_agreement_drafts").update({ issued_document_id: docRow.id, updated_at: now }).eq("id", draftId)
    const generatedRegistryId = await registerAgreementDocument({
      partnerId,
      applicationId,
      agreementId: String(draft.agreement_id),
      storagePath: upload.doc.storagePath,
      fileName: generated.fileName,
      fileSize: generated.bytes.length,
      checksum: docHash,
      templateVersion: String(AGREEMENT_TEMPLATE_VERSION),
      generatedBy: session.userId,
    }).catch((error) => {
      console.error("[agreement issue] registry insert failed:", error)
      return null
    })

    // Invalidate and archive the previously issued, still-unsigned version.
    // Executed agreements are deliberately retained as historical contracts.
    const { data: previousRequests } = await supabase.from("partner_agreement_signing")
      .select("source_document_id")
      .eq("application_id", applicationId)
      .eq("status", "AWAITING_PARTNER")
    const previousDocumentIds = (previousRequests || [])
      .map((row) => row.source_document_id as string | null)
      .filter((documentId): documentId is string => Boolean(documentId) && documentId !== String(docRow.id))
    if (previousDocumentIds.length) {
      await supabase.from("partner_documents")
        .update({ verification_status: "EXPIRED", notes: `Superseded by reviewed agreement ${String(draft.agreement_id)} on ${now}.` })
        .in("id", previousDocumentIds)
    }
    if (partnerId && generatedRegistryId) {
      await supersedePreviousDocuments({
        partnerId,
        type: "MASTER_PARTNER_AGREEMENT",
        sourceRecordId: applicationId,
        supersededById: generatedRegistryId,
        reason: `Replaced by reviewed agreement ${String(draft.agreement_id)}.`,
        actorId: session.userId,
        statuses: ["ISSUED"],
      })
    }

    await supabase.from("partner_agreement_signing").update({ status: "SUPERSEDED", updated_at: now }).eq("application_id", applicationId).eq("status", "AWAITING_PARTNER")
    const signingToken = crypto.randomBytes(32).toString("hex")
    const signingExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const { error: signingError } = await supabase.from("partner_agreement_signing").insert({
      application_id: applicationId,
      partner_id: partnerId,
      source_document_id: docRow.id,
      agreement_id: String(draft.agreement_id),
      token_hash: crypto.createHash("sha256").update(signingToken).digest("hex"),
      token_expires_at: signingExpiresAt,
      status: "AWAITING_PARTNER",
      agreement_payload: signedInput,
      terms_sha256: termsSha256,
      martpoint_signatory_name: input.martpoint.signatoryName,
      martpoint_signatory_title: input.martpoint.signatoryTitle,
      martpoint_signatory_email: input.martpoint.signatoryEmail,
      martpoint_signed_at: martpointSignedAt,
      martpoint_signature_event_id: martpointSignatureEventId,
      martpoint_signed_by_user_id: session.userId,
      created_at: now,
      updated_at: now,
    })
    if (signingError) throw new Error("Agreement was signed by MartPoint, but its partner signing request could not be created")

    if (app.status === "APPROVED") {
      await supabase.from("partner_applications").update({ status: "AGREEMENT_PENDING", updated_at: now, reviewed_at: now, reviewed_by: session.userId }).eq("id", applicationId)
      await recordStatusHistory(applicationId, null, "APPROVED", "AGREEMENT_PENDING", `Partner agreement issued (${String(draft.agreement_id)})`, session.userId, {
        changedByName: session.name || session.username,
        eventType: "STATUS_CHANGE",
      })
    } else {
      await recordStatusHistory(applicationId, null, String(app.status), String(app.status), `Partner agreement reissued (${String(draft.agreement_id)})`, session.userId, {
        changedByName: session.name || session.username,
        eventType: "NOTE_ADDED",
      })
    }

    const signingUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"}/partners/sign-agreement?token=${encodeURIComponent(signingToken)}`
    const partnerName = String(app.full_name || app.business_name || "Partner")
    emailAttempted = true
    const signingEmailSent = await sendEmail({
      to: String(app.email),
      subject: "Please review and sign your MartPoint Partner Agreement",
      text: `Hello ${partnerName},\n\nYour reviewed MartPoint Partner Agreement ${String(draft.agreement_id)} is attached as a PDF. MartPoint has signed it electronically.${gradingPolicyPdf ? ` The current Partner Performance, Grading & Progression Policy (v${activeGradingPolicy?.version}) is also attached.` : ""} Please review the attached documents and sign the agreement using this secure link within 14 days:\n\n${signingUrl}\n\nIf you have questions, reply to this email or contact partners@martpoint.com.ng.`,
      html: `<p>Hello ${escapeHtml(partnerName)},</p><p>Your reviewed MartPoint Partner Agreement <strong>${escapeHtml(String(draft.agreement_id))}</strong> is attached as a PDF. MartPoint has signed it electronically.${gradingPolicyPdf ? ` The current Partner Performance, Grading &amp; Progression Policy (v${escapeHtml(String(activeGradingPolicy?.version))}) is also attached.` : ""} Please review the attached documents and sign the agreement using the secure link below within 14 days.</p><p><a href="${escapeHtml(signingUrl)}" style="display:inline-block;background:#0057ff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px">Review and sign agreement</a></p><p>If you have questions, reply to this email or contact partners@martpoint.com.ng.</p>`,
      attachments: [
        { filename: generated.fileName, content: generated.bytes.toString("base64") },
        ...(gradingPolicyPdf ? [{ filename: "MartPoint-Partner-Performance-Grading-Progression-Policy.pdf", content: gradingPolicyPdf.toString("base64") }] : []),
      ],
      route: "partner_application",
      useRouteRecipients: false,
      replyTo: "partners@martpoint.com.ng",
    })
    const tokenHash = crypto.createHash("sha256").update(signingToken).digest("hex")
    await supabase.from("partner_agreement_signing").update({ email_sent: signingEmailSent, email_sent_at: signingEmailSent ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("token_hash", tokenHash)
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.PARTNER_AGREEMENT_GENERATED,
      entityType: AUDIT_ENTITIES.PARTNER_APPLICATION,
      entityId: applicationId,
      metadata: { agreementId: String(draft.agreement_id), draftId, issuedDocumentId: docRow.id, emailSent: signingEmailSent },
    }).catch((error) => console.error("[agreement issue] audit record failed:", error))

    return NextResponse.json({ success: true, agreementId: draft.agreement_id, emailSent: signingEmailSent, signingUrl: signingEmailSent ? null : signingUrl, expiresAt: signingExpiresAt, document: { id: docRow.id, fileName: generated.fileName, previewUrl: await createSignedDocUrl(upload.doc.storagePath, 300) } })
  } catch (error) {
    if (claimedDraftId && !emailAttempted) await supabase.from("partner_agreement_drafts").update({ status: "AWAITING_REVIEW", issued_at: null, issued_by: null, updated_at: new Date().toISOString() }).eq("id", claimedDraftId).eq("status", "ISSUED")
    console.error("[agreement issue] failed:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not issue agreement" }, { status: 500 })
  }
}
