import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import {
  MAX_DRIVE_FILE_BYTES,
  MAX_DRIVE_UPLOAD_FILES,
  ensureOwnerFolder,
  uploadFileToFolder,
  validateDriveFile,
} from "@/lib/drive-storage"

/* ─────────────  Public: client onboarding file uploads → Google Drive  ─────────────
 * The client onboarding page (/onboarding/<id>) is PUBLIC — the client has no
 * admin session, so it cannot call /api/admin/drive/upload. This route exists
 * for exactly that case and is scoped by the onboarding record id, which is a
 * random UUID the client received by email (the same capability/trust model the
 * public onboarding page and its responses endpoint already use).
 *
 * It never trusts a caller-supplied owner id: the business is resolved from the
 * onboarding record itself, so a client cannot file uploads against another
 * tenant. Files land in <root>/Business/<business_id>/ ; if the onboarding is
 * not yet linked to a business we file under Lead/<lead_id> instead.
 *
 * POST multipart/form-data:
 *   onboardingId  the onboarding record UUID (from the client's link)
 *   file          one or more files
 */

/** Turn an arbitrary scope into a safe Drive folder segment. */
function scopeSegment(value: string): string {
  const base = (value || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
  return /^[._-]+$/.test(base) ? "unknown" : base || "unknown"
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const onboardingId = String(formData.get("onboardingId") || "").trim()

    if (!onboardingId) {
      return NextResponse.json({ error: "onboardingId is required" }, { status: 400 })
    }

    // Resolve the owner FROM THE RECORD — never from the request body.
    const { data: record } = await supabase
      .from("onboarding")
      .select("id, lead_id, business_id, status")
      .eq("id", onboardingId)
      .single()

    if (!record) {
      return NextResponse.json({ error: "Onboarding record not found" }, { status: 404 })
    }
    if (record.status === "Completed" || record.status === "Rejected") {
      return NextResponse.json({ error: "This onboarding is already finalized" }, { status: 400 })
    }

    // Prefer the business; fall back to the lead while conversion is pending.
    let ownerType: "business" | "lead" | null = null
    let ownerId: string | null = null

    if (record.business_id) {
      ownerType = "business"
      ownerId = record.business_id as string
    } else if (record.lead_id) {
      // The record may predate the business link — try to resolve it via the lead.
      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("source_lead_id", record.lead_id)
        .maybeSingle()
      if (business?.id) {
        ownerType = "business"
        ownerId = business.id as string
      } else {
        ownerType = "lead"
        ownerId = record.lead_id as string
      }
    }

    if (!ownerType || !ownerId) {
      return NextResponse.json(
        { error: "This onboarding is not linked to a business or lead yet." },
        { status: 409 }
      )
    }

    const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0)
    if (files.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (files.length > MAX_DRIVE_UPLOAD_FILES) {
      return NextResponse.json({ error: `Upload at most ${MAX_DRIVE_UPLOAD_FILES} files at a time.` }, { status: 400 })
    }
    if (files.some((f) => f.size > MAX_DRIVE_FILE_BYTES)) {
      return NextResponse.json({ error: "One or more files exceed the 15 MB limit" }, { status: 400 })
    }
    for (const file of files) {
      const invalid = validateDriveFile({ type: file.type, size: file.size })
      if (invalid) return NextResponse.json({ error: `${file.name}: ${invalid}` }, { status: 400 })
    }

    const folder = await ensureOwnerFolder(ownerType, scopeSegment(ownerId))

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
      return NextResponse.json({ error: failed[0]?.error || "Failed to upload files", failed }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      ownerType,
      folderId: folder.folderId,
      uploaded,
      failed,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[onboarding drive upload]", message)
    return NextResponse.json({ error: "Failed to upload to Google Drive", details: message }, { status: 500 })
  }
}
