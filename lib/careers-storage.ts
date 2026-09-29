/* ───────────────────────────  Careers document storage  ───────────────────────────
 * CVs, cover letters and applicant-uploaded files live in the PRIVATE
 * `career-documents` Supabase bucket. Nothing here ever produces a public URL —
 * admins view files through short-lived signed URLs generated server-side.
 * Follows the same pattern as lib/partner-documents.ts.
 */

import { supabase, isSupabaseConfigured } from "./supabase"

export const CAREER_DOCUMENTS_BUCKET = "career-documents"

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
]

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024 // 5 MB

export function validateCareerFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    return "File type not allowed. Accepted: PDF, DOC, DOCX, PNG, JPEG, WEBP."
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return "File too large. Maximum size is 5 MB."
  }
  return null
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
  return base || "document"
}

/** Upload an applicant document to private storage, scoped by application id. */
export async function uploadCareerDocument(
  applicationId: string,
  filename: string,
  mimeType: string,
  fileBytes: Buffer | ArrayBuffer
): Promise<{ ok: boolean; storagePath?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Storage not configured" }

  const validation = validateCareerFile({ type: mimeType, size: fileBytes.byteLength })
  if (validation) return { ok: false, error: validation }

  const safeName = sanitizeFilename(filename)
  const storagePath = `${applicationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`

  const { error } = await supabase.storage.from(CAREER_DOCUMENTS_BUCKET).upload(storagePath, fileBytes, {
    contentType: mimeType,
    upsert: false,
  })
  if (error) {
    console.error("[career-documents] upload failed:", error.message)
    return { ok: false, error: "Failed to upload file" }
  }
  return { ok: true, storagePath }
}

/** Short-lived signed URL for an authorised admin to view a document. */
export async function createCareerDocSignedUrl(
  storagePath: string,
  expiresInSeconds = 120
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase.storage
    .from(CAREER_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data?.signedUrl) {
    console.error("[career-documents] signed url failed:", error?.message)
    return null
  }
  return data.signedUrl
}

export async function deleteCareerDocument(storagePath: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.storage.from(CAREER_DOCUMENTS_BUCKET).remove([storagePath])
  return !error
}
