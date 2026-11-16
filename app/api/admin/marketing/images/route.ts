import { NextResponse } from "next/server"
import crypto from "crypto"
import { getSession, hasPermissionForUser } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

const BUCKET = "marketing-assets"

const ALLOWED_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

const MAX_SIZE = 4 * 1024 * 1024

function matchesImageSignature(bytes: Buffer, mime: string): boolean {
  if (mime === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (mime === "image/jpeg" || mime === "image/jpg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === "image/gif") return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))
  if (mime === "image/webp") return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
  return false
}

/* ─── POST: upload a campaign/signature image → public URL ─── */
export async function POST(request: Request) {
  const session = await getSession()
  // Also used by Email Settings (signature logos), so settings admins may upload.
  if (!session || (!await hasPermissionForUser(session.userId, session.role, "marketing") && !await hasPermissionForUser(session.userId, session.role, "settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, content } = body || {}

    if (!name || !content) {
      return NextResponse.json({ error: "name and content are required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const mime = String(body.mimeType || "").toLowerCase()
    const ext = ALLOWED_MIME[mime]
    if (!ext) {
      return NextResponse.json({ error: "Only PNG, JPEG, WebP and GIF images are allowed" }, { status: 400 })
    }

    const bytes = Buffer.from(String(content), "base64")
    if (bytes.length === 0 || bytes.length > MAX_SIZE) {
      return NextResponse.json({ error: "Image must be under 4MB" }, { status: 400 })
    }
    if (!matchesImageSignature(bytes, mime)) {
      return NextResponse.json({ error: "The file contents do not match the selected image type" }, { status: 400 })
    }

    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: mime || `image/${ext.slice(1)}`,
      upsert: false,
    })

    if (error) {
      console.error("[Marketing Image Upload Error]", error)
      return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ success: true, url: data.publicUrl })
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
