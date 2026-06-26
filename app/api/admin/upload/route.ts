import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import path from "path"

const BUCKET = "uploads"

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
    const file = formData.get("file") as File
    const folder = (formData.get("folder") as string) || "general"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, WebP, and GIF images are allowed" }, { status: 400 })
    }

    const ext = path.extname(file.name).toLowerCase()
    const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif"]
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: "Invalid file extension" }, { status: 400 })
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
    }

    // Generate unique filename
    const safeExt = ext || ".jpg"
    const timestamp = Date.now()
    const filename = `${timestamp}-${Math.random().toString(36).substring(2, 8)}${safeExt}`
    const storagePath = `${folder}/${filename}`

    // Upload to Supabase Storage
    const bytes = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, Buffer.from(bytes), {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("[Supabase Upload Error]", uploadError)
      return NextResponse.json({ error: "Failed to upload file", details: uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      filename,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[Upload Error]", message)
    return NextResponse.json({ error: "Failed to upload file", details: message }, { status: 500 })
  }
}
