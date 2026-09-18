import { NextResponse } from "next/server"
import crypto from "crypto"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

const BUCKET = "marketing-assets"

const ALLOWED_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

const MAX_SIZE = 4 * 1024 * 1024

/* ─── POST: upload a campaign image → public URL ─── */
export async function POST(request: Request) {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "marketing")) {
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

    const mime = String(body.mimeType || "")
    const ext = ALLOWED_MIME[mime] || String(name).toLowerCase().match(/\.(png|jpe?g|webp|gif)$/)?.[0]
    if (!ext) {
      return NextResponse.json({ error: "Only PNG, JPEG, WebP and GIF images are allowed" }, { status: 400 })
    }

    const bytes = Buffer.from(String(content), "base64")
    if (bytes.length === 0 || bytes.length > MAX_SIZE) {
      return NextResponse.json({ error: "Image must be under 4MB" }, { status: 400 })
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
