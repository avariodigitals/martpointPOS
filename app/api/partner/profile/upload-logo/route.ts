import crypto from "crypto"
import { NextResponse } from "next/server"
import { authorizePartner, getPartnerSession } from "@/lib/partner-auth"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

const BUCKET = "partner-logos"
const MAX_BYTES = 5 * 1024 * 1024
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

export async function POST(request: Request) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:profile:update" })
  if (!auth.authorized) return auth.response!
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Storage is not configured" }, { status: 500 })

  try {
    const form = await request.formData()
    const file = form.get("file")
    const requestedPartnerId = String(form.get("partnerId") || "")

    if (requestedPartnerId && requestedPartnerId !== session.partnerId) {
      return NextResponse.json({ error: "You can only upload a logo for your organisation" }, { status: 403 })
    }
    if (!(file instanceof File)) return NextResponse.json({ error: "No logo file provided" }, { status: 400 })

    const extension = MIME_EXTENSIONS[file.type]
    if (!extension) return NextResponse.json({ error: "Use a JPG, PNG, WebP, or GIF image" }, { status: 400 })
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Logo must be between 1 byte and 5 MB" }, { status: 400 })
    }

    const storagePath = `${session.partnerId}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    })
    if (error) {
      console.error("[partner logo upload]", error.message)
      return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 })
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    if (!data.publicUrl) return NextResponse.json({ error: "Uploaded logo URL unavailable" }, { status: 500 })
    return NextResponse.json({ success: true, url: data.publicUrl })
  } catch {
    return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 })
  }
}
