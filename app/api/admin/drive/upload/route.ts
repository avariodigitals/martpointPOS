import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { isSupabaseConfigured } from "@/lib/supabase"
import {
  MAX_DRIVE_FILE_BYTES,
  MAX_DRIVE_UPLOAD_FILES,
  ensureOwnerFolder,
  normalizeOwnerType,
  uploadFileToFolder,
  validateDriveFile,
} from "@/lib/drive-storage"

/* ───────────────  Admin: upload files into a Drive owner folder  ───────────────
 * Files are filed as <root>/<Owner Type>/<owner id>/ in the shared Google Drive.
 * If the folder tree does not exist yet it is created on the spot.
 *
 * POST multipart/form-data:
 *   ownerType  "business" | "lead" | "partner" | "creator" | "admin"
 *   ownerId    the business/lead/partner/creator UUID (or admin id)
 *   file       one or more files (repeat the field to send many)
 *
 * A legacy json `files` payload is NOT supported — send real files.
 */
export async function POST(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const ownerType = normalizeOwnerType(String(formData.get("ownerType") || formData.get("owner_type") || ""))
    const ownerId = String(formData.get("ownerId") || formData.get("owner_id") || "").trim()

    if (!ownerType) {
      return NextResponse.json(
        { error: "ownerType must be one of business, lead, partner, creator or admin" },
        { status: 400 }
      )
    }
    if (!ownerId) {
      return NextResponse.json({ error: "ownerId is required" }, { status: 400 })
    }

    const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0)
    if (files.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (files.length > MAX_DRIVE_UPLOAD_FILES) {
      return NextResponse.json(
        { error: `Too many files. Upload at most ${MAX_DRIVE_UPLOAD_FILES} at a time.` },
        { status: 400 }
      )
    }
    if (files.some((f) => f.size > MAX_DRIVE_FILE_BYTES)) {
      return NextResponse.json({ error: "One or more files exceed the 15 MB limit" }, { status: 400 })
    }

    for (const file of files) {
      const invalid = validateDriveFile({ type: file.type, size: file.size })
      if (invalid) return NextResponse.json({ error: `${file.name}: ${invalid}` }, { status: 400 })
    }

    // Creates <root>/<Owner Type>/<owner id> if any part is missing.
    const folder = await ensureOwnerFolder(ownerType, ownerId)

    const uploaded: { name: string; fileId: string; link?: string }[] = []
    const failed: { name: string; error: string }[] = []

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const result = await uploadFileToFolder(folder.folderId, file.name, file.type, bytes)
      if (result.ok && result.fileId) {
        uploaded.push({ name: result.name || file.name, fileId: result.fileId, link: result.webViewLink })
      } else {
        failed.push({ name: file.name, error: result.error || "Upload failed" })
      }
    }

    if (uploaded.length === 0) {
      return NextResponse.json(
        { error: failed[0]?.error || "Failed to upload files", failed },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      ownerType,
      ownerId,
      folderId: folder.folderId,
      folderLink: folder.webViewLink || null,
      uploaded,
      failed,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[drive upload]", message)
    return NextResponse.json({ error: "Failed to upload to Google Drive", details: message }, { status: 500 })
  }
}
