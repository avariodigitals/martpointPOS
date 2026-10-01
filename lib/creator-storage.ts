/* ───────────────────────────  Creator file storage  ───────────────────────────
 * Profile photos, submission screenshots and analytics evidence live in the
 * PRIVATE `creator-files` Supabase bucket. Nothing here produces a public URL —
 * admins and owners view files through short-lived signed URLs generated
 * server-side. Follows lib/careers-storage.ts / lib/partner-documents.ts.
 */

import { supabase, isSupabaseConfigured } from "./supabase"

export const CREATOR_FILES_BUCKET = "creator-files"

export const ALLOWED_CREATOR_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]

export const ALLOWED_PHOTO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"]

export const MAX_CREATOR_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

export function validateCreatorFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_CREATOR_MIME_TYPES.includes(file.type)) {
    return "File type not allowed. Accepted: PDF, PNG, JPEG, WEBP."
  }
  if (file.size > MAX_CREATOR_FILE_BYTES) {
    return "File too large. Maximum size is 5 MB."
  }
  return null
}

export function validateCreatorPhoto(file: { type: string; size: number }): string | null {
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type)) {
    return "Photo must be a PNG, JPEG or WEBP image."
  }
  if (file.size > MAX_CREATOR_FILE_BYTES) {
    return "File too large. Maximum size is 5 MB."
  }
  return null
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
  return base || "file"
}

/** Upload a file to private storage, scoped by an arbitrary prefix. */
export async function uploadCreatorFile(
  scope: string,
  filename: string,
  mimeType: string,
  fileBytes: Buffer | ArrayBuffer
): Promise<{ ok: boolean; storagePath?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Storage not configured" }

  const validation = validateCreatorFile({ type: mimeType, size: fileBytes.byteLength })
  if (validation) return { ok: false, error: validation }

  const safeScope = scope.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80)
  const safeName = sanitizeFilename(filename)
  const storagePath = `${safeScope}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`

  const { error } = await supabase.storage.from(CREATOR_FILES_BUCKET).upload(storagePath, fileBytes, {
    contentType: mimeType,
    upsert: false,
  })
  if (error) {
    console.error("[creator-files] upload failed:", error.message)
    return { ok: false, error: "Failed to upload file" }
  }
  return { ok: true, storagePath }
}

/** Short-lived signed URL for an authorised viewer. */
export async function createCreatorFileSignedUrl(
  storagePath: string,
  expiresInSeconds = 120
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase.storage
    .from(CREATOR_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data?.signedUrl) {
    console.error("[creator-files] signed url failed:", error?.message)
    return null
  }
  return data.signedUrl
}

export async function deleteCreatorFile(storagePath: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.storage.from(CREATOR_FILES_BUCKET).remove([storagePath])
  return !error
}
