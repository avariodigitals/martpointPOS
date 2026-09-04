import { supabase, isSupabaseConfigured } from "./supabase"

/* ───────────────────────────  Secure Document Storage  ───────────────────────────
 * Partner application documents are stored in a PRIVATE Supabase Storage bucket
 * (`partner-documents`). We never expose public storage URLs. Admin viewing uses
 * short-lived signed URLs generated server-side with the service role client.
 *
 * The service role key is NEVER exposed to the browser — all operations here run
 * server-side only.
 */

export const PARTNER_DOCUMENTS_BUCKET = "partner-documents"

export const ALLOWED_PARTNER_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

export const MAX_PARTNER_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export interface UploadedDoc {
  storagePath: string
  originalFilename: string
  mimeType: string
  fileSize: number
}

export interface UploadResult {
  ok: boolean
  doc?: UploadedDoc
  error?: string
}

function sanitizeFilename(name: string): string {
  // Keep it simple and safe for storage paths.
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
  return base || "document"
}

/** Validate file type and size before upload. */
export function validatePartnerFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_PARTNER_MIME_TYPES.includes(file.type)) {
    return "File type not allowed. Accepted: PDF, PNG, JPEG, WEBP, DOC, DOCX."
  }
  if (file.size > MAX_PARTNER_FILE_BYTES) {
    return "File too large. Maximum size is 10 MB."
  }
  return null
}

/**
 * Upload a partner document to private storage.
 * `fileBytes` is the raw file content (Buffer/ArrayBuffer). `applicationId` scopes
 * the storage path per application.
 */
export async function uploadPartnerDocument(
  applicationId: string,
  filename: string,
  mimeType: string,
  fileBytes: Buffer | ArrayBuffer
): Promise<UploadResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Storage not configured" }
  }
  const validation = validatePartnerFile({ type: mimeType, size: fileBytes.byteLength })
  if (validation) {
    return { ok: false, error: validation }
  }
  const safeName = sanitizeFilename(filename)
  const storagePath = `${applicationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`

  const { error } = await supabase
    .storage
    .from(PARTNER_DOCUMENTS_BUCKET)
    .upload(storagePath, fileBytes, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    console.error("[partner-docs] upload failed:", error.message)
    return { ok: false, error: "Failed to upload document" }
  }

  return {
    ok: true,
    doc: {
      storagePath,
      originalFilename: filename,
      mimeType,
      fileSize: fileBytes.byteLength,
    },
  }
}

/**
 * Generate a short-lived signed URL for an admin to view a partner document.
 * Never expose the service role key or public URLs.
 */
export async function createSignedDocUrl(
  storagePath: string,
  expiresInSeconds = 60
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .storage
    .from(PARTNER_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data?.signedUrl) {
    console.error("[partner-docs] signed url failed:", error?.message)
    return null
  }
  return data.signedUrl
}

/** Delete a partner document from private storage. */
export async function deletePartnerDocument(storagePath: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).remove([storagePath])
  return !error
}
