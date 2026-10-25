import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { randomUUID } from "node:crypto"

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "azera")) {
    return null
  }
  return session
}

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}
function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) return err("Forbidden", 403)

  if (!isSupabaseConfigured()) return err("Supabase not configured", 500)

  try {
    const formData = await request.formData()
    const callId = formData.get("call_id") as string
    const businessId = formData.get("business_id") as string
    const file = formData.get("file") as File

    if (!callId || !businessId || !file) {
      return err("call_id, business_id and file are required")
    }
    if (!(file instanceof File) || file.size === 0 || file.size > 4 * 1024 * 1024 || !/^audio\/(wav|x-wav|mp3|mpeg|ogg|webm|mp4)(;.*)?$/.test(file.type)) return err("Choose a supported audio recording up to 4 MB.")
    if (formData.get("consent_confirmed") !== "true") return err("Confirm that both participants consented to recording.")
    const { data: call } = await supabase.from("azera_calls").select("id").eq("id", callId).eq("business_id", businessId).maybeSingle()
    if (!call) return err("Call and business do not match.", 404)

    // Upload to Supabase storage
    const fileName = `${businessId}/${callId}/${randomUUID()}.audio`
    const { error: uploadError } = await supabase.storage
      .from("call-recordings")
      .upload(fileName, file)

    if (uploadError) {
      console.error("[Recording upload error]", uploadError)
      return err("Failed to upload recording", 500)
    }

    // Get public URL
    const { data: urlData } = await supabase.storage
      .from("call-recordings")
      .createSignedUrl(fileName, 300)

    // Save recording record
    const { data, error } = await supabase
      .from("azera_call_recordings")
      .insert({
        call_id: callId,
        business_id: businessId,
        recording_url: "",
        recording_path: fileName,
        duration_seconds: 0,
        file_size_bytes: file.size,
        mime_type: file.type || "audio/wav",
        recording_type: "manual",
        consent_confirmed_at: new Date().toISOString(),
        retention_expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !data) {
      await supabase.storage.from("call-recordings").remove([fileName])
      return err("Failed to save recording record", 500)
    }

    return ok({ ...data, recording_url: urlData?.signedUrl || null })
  } catch (e) {
    return err(String(e), 500)
  }
}
