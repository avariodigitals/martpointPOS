import crypto from "crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { createSignedDocUrl, uploadPartnerDocument } from "@/lib/partner-documents"
import { registerAgreementDocument } from "@/lib/partner-generated-docs"
import { AGREEMENT_TEMPLATE_VERSION, generatePartnerAgreementPdf, type AgreementInput } from "@/lib/partner-agreement"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/email-html"

export const dynamic = "force-dynamic"

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function validToken(token: string) {
  return /^[a-f0-9]{64}$/i.test(token)
}

async function loadRequest(token: string) {
  return supabase
    .from("partner_agreement_signing")
    .select("*")
    .eq("token_hash", tokenHash(token))
    .maybeSingle()
}

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, { key: "partner-agreement-signing-view", max: 20, windowSeconds: 600 })
  if (!limited.allowed) return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Signing is not available" }, { status: 503 })

  const token = new URL(request.url).searchParams.get("token") || ""
  if (!validToken(token)) return NextResponse.json({ error: "This signing link is invalid or expired" }, { status: 404 })
  const { data: signing, error } = await loadRequest(token)
  if (error || !signing) return NextResponse.json({ error: "This signing link is invalid or expired" }, { status: 404 })

  if (signing.status === "AWAITING_PARTNER" && new Date(signing.token_expires_at as string) <= new Date()) {
    await supabase.from("partner_agreement_signing").update({ status: "EXPIRED", updated_at: new Date().toISOString() }).eq("id", signing.id)
    return NextResponse.json({ error: "This signing link has expired. Contact MartPoint to request a new one." }, { status: 410 })
  }
  if (!["AWAITING_PARTNER", "EXECUTED"].includes(String(signing.status))) {
    return NextResponse.json({ error: "This signing link has been replaced. Contact MartPoint for a current link." }, { status: 410 })
  }

  const { data: app } = await supabase
    .from("partner_applications")
    .select("business_name, full_name, email")
    .eq("id", signing.application_id)
    .maybeSingle()

  const documentPath = signing.final_document_path || (await supabase
    .from("partner_documents")
    .select("storage_path")
    .eq("id", signing.source_document_id)
    .maybeSingle()).data?.storage_path
  const documentUrl = documentPath ? await createSignedDocUrl(documentPath as string, 300) : null

  return NextResponse.json({
    agreementId: signing.agreement_id,
    status: signing.status,
    partnerName: app?.business_name || app?.full_name || "Partner",
    signerEmail: app?.email || "",
    martpointSigner: {
      name: signing.martpoint_signatory_name,
      title: signing.martpoint_signatory_title,
      signedAt: signing.martpoint_signed_at,
    },
    expiresAt: signing.token_expires_at,
    documentUrl,
    partnerSignerName: signing.partner_signer_name || "",
  })
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { key: "partner-agreement-signing-submit", max: 5, windowSeconds: 3600 })
  if (!limited.allowed) return NextResponse.json({ error: "Too many signing attempts. Please contact MartPoint." }, { status: 429 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Signing is not available" }, { status: 503 })

  try {
    const body = await request.json()
    const token = String(body.token || "")
    const signerName = String(body.signerName || "").trim()
    const signerTitle = String(body.signerTitle || "").trim()
    if (!validToken(token)) return NextResponse.json({ error: "This signing link is invalid or expired" }, { status: 404 })
    if (signerName.length < 3 || signerTitle.length < 2 || body.confirmAuthority !== true) {
      return NextResponse.json({ error: "Enter your legal name and title, and confirm that you are authorised to sign for the partner" }, { status: 400 })
    }

    const { data: signing, error } = await loadRequest(token)
    if (error || !signing) return NextResponse.json({ error: "This signing link is invalid or expired" }, { status: 404 })
    if (signing.status === "EXECUTED") return NextResponse.json({ error: "This agreement has already been signed by both parties" }, { status: 409 })
    if (signing.status !== "AWAITING_PARTNER" || new Date(signing.token_expires_at as string) <= new Date()) {
      return NextResponse.json({ error: "This signing link has expired or been replaced. Contact MartPoint for a current link." }, { status: 410 })
    }

    const { data: app } = await supabase
      .from("partner_applications")
      .select("email, business_name, full_name")
      .eq("id", signing.application_id)
      .maybeSingle()
    const signerEmail = String(app?.email || "").trim().toLowerCase()
    if (!signerEmail) return NextResponse.json({ error: "The applicant email could not be verified" }, { status: 409 })

    const signedAt = new Date().toISOString()
    const partnerEventId = `PPES-${crypto.randomUUID()}`
    const agreementInput = signing.agreement_payload as AgreementInput
    const finalInput: AgreementInput = {
      ...agreementInput,
      partner: {
        ...agreementInput.partner,
        signatoryName: signerName,
        signatoryTitle: signerTitle,
        signatoryEmail: signerEmail,
      },
      execution: {
        termsSha256: String(signing.terms_sha256),
        martpointSignedAt: String(signing.martpoint_signed_at),
        martpointEventId: String(signing.martpoint_signature_event_id),
        partner: { name: signerName, title: signerTitle, email: signerEmail, signedAt, eventId: partnerEventId },
      },
    }

    let logoDataUrl: string | undefined
    try {
      const logo = await fs.readFile(path.join(process.cwd(), "public", "logo.png"))
      logoDataUrl = `data:image/png;base64,${logo.toString("base64")}`
    } catch {
      logoDataUrl = undefined
    }
    const generated = generatePartnerAgreementPdf(finalInput, { logoDataUrl })
    const finalHash = crypto.createHash("sha256").update(generated.bytes).digest("hex")
    const fileName = generated.fileName.replace(/\.pdf$/i, "-executed.pdf")
    const upload = await uploadPartnerDocument(String(signing.application_id), fileName, "application/pdf", generated.bytes)
    if (!upload.ok || !upload.doc) return NextResponse.json({ error: upload.error || "Could not store the signed agreement" }, { status: 500 })

    const now = new Date().toISOString()
    const { data: finalDocument, error: documentError } = await supabase
      .from("partner_documents")
      .insert({
        application_id: signing.application_id,
        partner_id: signing.partner_id,
        document_type: "Partner Agreement (Executed)",
        storage_path: upload.doc.storagePath,
        original_filename: fileName,
        mime_type: "application/pdf",
        file_size: generated.bytes.length,
        verification_status: "VERIFIED",
        required: false,
        requested_by: signing.martpoint_signed_by_user_id,
        notes: `Electronically signed by both parties. Agreement terms SHA-256: ${signing.terms_sha256}. Final PDF SHA-256: ${finalHash}.`,
        uploaded_at: now,
      })
      .select("id")
      .single()
    if (documentError || !finalDocument) return NextResponse.json({ error: "Signed agreement was stored but its document record could not be created" }, { status: 500 })

    const { data: completed, error: completeError } = await supabase
      .from("partner_agreement_signing")
      .update({
        status: "EXECUTED",
        partner_signer_name: signerName,
        partner_signer_title: signerTitle,
        partner_signer_email: signerEmail,
        partner_signed_at: signedAt,
        partner_signature_event_id: partnerEventId,
        final_document_path: upload.doc.storagePath,
        final_document_sha256: finalHash,
        updated_at: now,
      })
      .eq("id", signing.id)
      .eq("status", "AWAITING_PARTNER")
      .eq("token_hash", tokenHash(token))
      .select("id")
      .maybeSingle()
    if (completeError || !completed) return NextResponse.json({ error: "This agreement was signed concurrently or its request is no longer active" }, { status: 409 })

    await registerAgreementDocument({
      partnerId: signing.partner_id as string | null,
      applicationId: signing.application_id as string,
      agreementId: String(signing.agreement_id),
      agreementRevisionId: String(signing.agreement_revision_id || signing.agreement_id),
      storagePath: upload.doc.storagePath,
      fileName,
      fileSize: generated.bytes.length,
      checksum: finalHash,
      templateVersion: String(AGREEMENT_TEMPLATE_VERSION),
      generatedBy: String(signing.martpoint_signed_by_user_id),
      status: "SIGNED",
      metadata: { executed: true, partnerSignatureEventId: partnerEventId },
    }).catch((e) => console.error("[agreement signing] registry insert failed:", e))

    const finalUrl = await createSignedDocUrl(upload.doc.storagePath, 300)
    const partnerName = String(app?.business_name || app?.full_name || "Partner")
    const completedHtml = `<p>Hello ${escapeHtml(partnerName)},</p><p>Both parties have signed Partner Agreement <strong>${escapeHtml(String(signing.agreement_id))}</strong>. A completed copy is available below.</p>${finalUrl ? `<p><a href="${escapeHtml(finalUrl)}">Download executed agreement</a></p>` : ""}`
    await sendEmail({
      to: [signerEmail, String(signing.martpoint_signatory_email)],
      subject: `Executed MartPoint Partner Agreement ${String(signing.agreement_id)}`,
      text: `Both parties have signed MartPoint Partner Agreement ${String(signing.agreement_id)}.${finalUrl ? ` Download the executed copy: ${finalUrl}` : ""}`,
      html: completedHtml,
      route: "partner_application",
      useRouteRecipients: false,
      replyTo: "partners@martpoint.com.ng",
    })

    return NextResponse.json({ success: true, agreementId: signing.agreement_id, signedAt, finalUrl })
  } catch (error) {
    console.error("[agreement signing] failed:", error)
    return NextResponse.json({ error: "Could not complete the electronic signature" }, { status: 500 })
  }
}
