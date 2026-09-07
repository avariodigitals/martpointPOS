import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { hashToken } from "./crypto"
import { sendEmail } from "./email"
import { renderEmailTemplate } from "./email-templates"
import { recordStatusHistory, sendApplicationStatusEmail } from "./partners"
import { uploadPartnerDocument, createSignedDocUrl } from "./partner-documents"

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.martpoint.com.ng"

export interface ComplianceDocWithToken {
  id: string
  document_type: string
  verification_status: string
  storage_path: string | null
  original_filename: string | null
  mime_type: string | null
  file_size: number | null
  required: boolean
  uploaded_at: string | null
  verified_at: string | null
  verified_by: string | null
  notes: string | null
  signedUrl: string | null
  latestToken: {
    hash: string
    expiresAt: string
    usedAt: string | null
  } | null
}

function now() {
  return new Date().toISOString()
}

function tokenExpiry() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() // 7 days
}

function generateToken() {
  const token = crypto.randomBytes(32).toString("hex")
  return { token, hash: hashToken(token) }
}

export async function listApplicationComplianceDocuments(applicationId: string): Promise<ComplianceDocWithToken[]> {
  if (!isSupabaseConfigured()) return []

  const { data: docs, error } = await supabase
    .from("partner_documents")
    .select("*")
    .eq("application_id", applicationId)
    .order("uploaded_at", { ascending: false })

  if (error || !docs) return []

  const rows = await Promise.all(
    (docs as Record<string, unknown>[]).map(async (d) => {
      const { data: tokens } = await supabase
        .from("partner_document_upload_tokens")
        .select("token_hash, expires_at, used_at")
        .eq("partner_document_id", d.id as string)
        .order("created_at", { ascending: false })
        .limit(1)

      const latest = (tokens || [])[0] as Record<string, unknown> | undefined
      const signedUrl = d.storage_path
        ? await createSignedDocUrl(d.storage_path as string, 300)
        : null

      return {
        id: d.id as string,
        document_type: d.document_type as string,
        verification_status: d.verification_status as string,
        storage_path: (d.storage_path as string) || null,
        original_filename: (d.original_filename as string) || null,
        mime_type: (d.mime_type as string) || null,
        file_size: (d.file_size as number) || null,
        required: Boolean(d.required),
        uploaded_at: (d.uploaded_at as string) || null,
        verified_at: (d.verified_at as string) || null,
        verified_by: (d.verified_by as string) || null,
        notes: (d.notes as string) || null,
        signedUrl,
        latestToken: latest
          ? {
              hash: latest.token_hash as string,
              expiresAt: latest.expires_at as string,
              usedAt: (latest.used_at as string) || null,
            }
          : null,
      }
    })
  )

  return rows
}

export async function requestApplicationComplianceDocuments(
  applicationId: string,
  documentTypes: string[],
  adminUserId: string
): Promise<{ ok: boolean; error?: string; docs?: ComplianceDocWithToken[] }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  if (!documentTypes.length) return { ok: false, error: "No document types selected" }

  const { data: app, error: appErr } = await supabase
    .from("partner_applications")
    .select("id, reference_number, full_name, business_name, email, status, required_compliance_documents")
    .eq("id", applicationId)
    .single()

  if (appErr || !app) return { ok: false, error: "Application not found" }

  const existingSet = new Set((app.required_compliance_documents as string[]) || [])
  const requested: ComplianceDocWithToken[] = []

  for (const docType of documentTypes) {
    existingSet.add(docType)

    // Reuse a rejected/requested doc for the same type if one exists, otherwise create new.
    const { data: existing } = await supabase
      .from("partner_documents")
      .select("id")
      .eq("application_id", applicationId)
      .eq("document_type", docType)
      .in("verification_status", ["REQUESTED", "REJECTED"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    let docId: string
    if (existing) {
      docId = existing.id as string
      await supabase
        .from("partner_documents")
        .update({ verification_status: "REQUESTED", updated_at: now() })
        .eq("id", docId)
    } else {
      const { data: created, error: insertErr } = await supabase
        .from("partner_documents")
        .insert({
          application_id: applicationId,
          document_type: docType,
          verification_status: "REQUESTED",
          storage_path: "",
          original_filename: "",
          mime_type: "",
          file_size: 0,
          required: true,
          requested_by: adminUserId,
          uploaded_at: now(),
        })
        .select()
        .single()
      if (insertErr || !created) continue
      docId = created.id as string
    }

    const { token, hash } = generateToken()
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("partner_document_upload_tokens")
      .insert({
        partner_document_id: docId,
        token_hash: hash,
        email: (app.email as string).toLowerCase(),
        expires_at: tokenExpiry(),
        created_by: adminUserId,
      })
      .select()
      .single()

    if (tokenErr || !tokenRow) continue

    requested.push({
      id: docId,
      document_type: docType,
      verification_status: "REQUESTED",
      storage_path: null,
      original_filename: null,
      mime_type: null,
      file_size: null,
      required: true,
      uploaded_at: null,
      verified_at: null,
      verified_by: null,
      notes: null,
      signedUrl: null,
      latestToken: { hash, expiresAt: tokenExpiry(), usedAt: null },
    })

    // Send one email per document type with a one-time upload link.
    const uploadUrl = `${baseUrl}/partners/upload-compliance?token=${token}`
    const tpl = await renderEmailTemplate("compliance_doc_request", {
      fullName: (app.full_name as string) || (app.business_name as string) || "there",
      reference: app.reference_number,
      docType,
      uploadUrl,
    })
    await sendEmail({ to: app.email as string, subject: tpl.subject, text: tpl.text, html: tpl.html })
  }

  // Requesting compliance documents moves the application to COMPLIANCE_REQUIRED
  // so the status always reflects that we are waiting on the applicant.
  const previousStatus = (app.status as string) || null
  await supabase
    .from("partner_applications")
    .update({
      required_compliance_documents: Array.from(existingSet),
      status: "COMPLIANCE_REQUIRED",
      updated_at: now(),
    })
    .eq("id", applicationId)

  if (previousStatus && previousStatus !== "COMPLIANCE_REQUIRED") {
    await recordStatusHistory(
      applicationId,
      null,
      previousStatus,
      "COMPLIANCE_REQUIRED",
      `Compliance documents requested: ${documentTypes.join(", ")}`,
      adminUserId
    )
    await sendApplicationStatusEmail(
      app.email as string,
      (app.full_name as string) || (app.business_name as string) || "there",
      app.reference_number as string,
      "COMPLIANCE_REQUIRED",
      previousStatus,
      `Please submit: ${documentTypes.join(", ")}`
    )
  }

  return { ok: true, docs: requested }
}

export async function resendComplianceUploadToken(
  docId: string,
  adminUserId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: doc, error } = await supabase
    .from("partner_documents")
    .select("id, application_id, document_type, verification_status, partner_applications!application_id ( reference_number, full_name, business_name, email )")
    .eq("id", docId)
    .single()

  if (error || !doc) return { ok: false, error: "Document not found" }
  if (doc.verification_status === "VERIFIED" || doc.verification_status === "APPROVED") {
    return { ok: false, error: "Document is already verified" }
  }

  const app = doc.application_id as Record<string, unknown> | undefined
  const email = (app?.email as string) || ""
  if (!email) return { ok: false, error: "Applicant email not found" }

  const { token, hash } = generateToken()
  const { error: tokenErr } = await supabase.from("partner_document_upload_tokens").insert({
    partner_document_id: docId,
    token_hash: hash,
    email: email.toLowerCase(),
    expires_at: tokenExpiry(),
    created_by: adminUserId,
  })

  if (tokenErr) return { ok: false, error: "Failed to create upload token" }

  const uploadUrl = `${baseUrl}/partners/upload-compliance?token=${token}`
  const tpl = await renderEmailTemplate("compliance_doc_reminder", {
    fullName: (app?.full_name as string) || (app?.business_name as string) || "there",
    reference: (app?.reference_number as string) || "",
    docType: doc.document_type as string,
    uploadUrl,
  })
  await sendEmail({ to: email, subject: tpl.subject, text: tpl.text, html: tpl.html })

  return { ok: true }
}

export async function verifyApplicationComplianceDocument(
  docId: string,
  status: "VERIFIED" | "APPROVED" | "REJECTED" | "UNDER_REVIEW",
  notes: string,
  adminUserId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const updates: Record<string, unknown> = {
    verification_status: status,
    notes: notes || null,
    updated_at: now(),
    verified_at: ["VERIFIED", "APPROVED"].includes(status) ? now() : null,
    verified_by: ["VERIFIED", "APPROVED"].includes(status) ? adminUserId : null,
  }

  const { error } = await supabase.from("partner_documents").update(updates).eq("id", docId)
  if (error) return { ok: false, error: "Failed to update document" }

  return { ok: true }
}

export async function getComplianceDocumentByToken(token: string): Promise<{
  ok: boolean
  error?: string
  doc?: {
    id: string
    document_type: string
    status: string
    reference: string
    applicantName: string
  }
}> {
  if (!isSupabaseConfigured()) return { ok: false, error: "System not configured" }

  const hash = hashToken(token)
  const { data: tokenRow, error } = await supabase
    .from("partner_document_upload_tokens")
    .select("*, partner_documents(*, partner_applications!application_id ( reference_number, full_name, business_name ))")
    .eq("token_hash", hash)
    .single()

  if (error || !tokenRow) return { ok: false, error: "Invalid or expired upload link" }

  if (tokenRow.used_at) return { ok: false, error: "This upload link has already been used" }
  if (tokenRow.expires_at && tokenRow.expires_at < now()) return { ok: false, error: "This upload link has expired" }

  const doc = tokenRow.partner_documents as Record<string, unknown>
  const app = doc.partner_applications as Record<string, unknown> | undefined

  if (doc.verification_status === "VERIFIED" || doc.verification_status === "APPROVED") {
    return { ok: false, error: "This document has already been verified" }
  }

  return {
    ok: true,
    doc: {
      id: doc.id as string,
      document_type: doc.document_type as string,
      status: doc.verification_status as string,
      reference: (app?.reference_number as string) || "",
      applicantName: (app?.full_name as string) || (app?.business_name as string) || "",
    },
  }
}

export async function submitComplianceDocumentByToken(
  token: string,
  file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "System not configured" }

  const hash = hashToken(token)

  const { data: tokenRow, error } = await supabase
    .from("partner_document_upload_tokens")
    .select("*, partner_documents(*, partner_applications!application_id ( reference_number ))")
    .eq("token_hash", hash)
    .single()

  if (error || !tokenRow) return { ok: false, error: "Invalid or expired upload link" }
  if (tokenRow.used_at) return { ok: false, error: "This upload link has already been used" }
  if (tokenRow.expires_at && tokenRow.expires_at < now()) return { ok: false, error: "This upload link has expired" }

  const doc = tokenRow.partner_documents as Record<string, unknown>
  const applicationId = doc.application_id as string

  const fileBytes = Buffer.from(await file.arrayBuffer())
  const upload = await uploadPartnerDocument(applicationId, file.name, file.type, fileBytes)
  if (!upload.ok || !upload.doc) {
    return { ok: false, error: upload.error || "Failed to upload document" }
  }

  const { error: updateErr } = await supabase
    .from("partner_documents")
    .update({
      storage_path: upload.doc.storagePath,
      original_filename: upload.doc.originalFilename,
      mime_type: upload.doc.mimeType,
      file_size: upload.doc.fileSize,
      verification_status: "SUBMITTED",
      uploaded_at: now(),
      updated_at: now(),
    })
    .eq("id", doc.id as string)

  if (updateErr) return { ok: false, error: "Failed to save document" }

  await supabase
    .from("partner_document_upload_tokens")
    .update({ used_at: now(), updated_at: now() })
    .eq("id", tokenRow.id as string)

  return { ok: true }
}

/* ───────────────────────────  Compliance scoring  ─────────────────────────── */

export function deriveComplianceScoreAndStatus(
  docs: { verification_status: string; required?: boolean }[]
): { score: number | null; status: string; label: string; interpretation: string } {
  const required = docs.filter((d) => d.required !== false)
  if (required.length === 0) {
    return { score: null, status: "NOT_REQUIRED", label: "Not Required", interpretation: "No compliance documents are required for this partner." }
  }

  const ok = required.filter((d) => d.verification_status === "VERIFIED" || d.verification_status === "APPROVED").length
  const rejectedOrExpired = required.some((d) => d.verification_status === "REJECTED" || d.verification_status === "EXPIRED")
  const pending = required.some((d) => !["VERIFIED", "APPROVED", "REJECTED", "EXPIRED"].includes(d.verification_status))

  const score = Math.round((ok / required.length) * 100)

  if (rejectedOrExpired) {
    return { score, status: "ATTENTION", label: "Needs Attention", interpretation: "One or more required documents were rejected or have expired." }
  }
  if (ok === required.length) {
    return { score: 100, status: "COMPLIANT", label: "Compliant", interpretation: "All required compliance documents are verified and approved." }
  }
  if (pending) {
    return { score, status: "PENDING", label: "Pending", interpretation: "Some required documents are still requested, submitted or under review." }
  }

  return { score, status: "PENDING", label: "Pending", interpretation: "Compliance review is in progress." }
}
