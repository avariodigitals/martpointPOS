import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3"])

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  return session && hasPermission(session.role as UserRole, "settings") ? session : null
}

function extension(file: File): string {
  if (file.type.includes("wav")) return "wav"
  return "mp3"
}

export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ success: false, error: "Supabase not configured" }, { status: 500 })

  const form = await request.formData()
  const file = form.get("file")
  const businessId = String(form.get("business_id") || "")
  if (!(file instanceof File) || !businessId) return NextResponse.json({ success: false, error: "Audio file and business_id are required" }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_AUDIO_BYTES) return NextResponse.json({ success: false, error: "Use a WAV or MP3 audio file up to 10 MB" }, { status: 400 })

  const path = `${businessId}/${crypto.randomUUID()}.${extension(file)}`
  const { error } = await supabase.storage.from("azera-voice-audio").upload(path, new Uint8Array(await file.arrayBuffer()), {
    contentType: file.type,
    upsert: false,
  })
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  const { data } = supabase.storage.from("azera-voice-audio").getPublicUrl(path)
  return NextResponse.json({ success: true, path, url: data.publicUrl })
}

export async function DELETE(request: Request) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ success: false, error: "Supabase not configured" }, { status: 500 })
  const path = String(new URL(request.url).searchParams.get("path") || "")
  if (!path || path.includes("..") || !path.includes("/")) return NextResponse.json({ success: false, error: "Invalid audio path" }, { status: 400 })
  const { error } = await supabase.storage.from("azera-voice-audio").remove([path])
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
