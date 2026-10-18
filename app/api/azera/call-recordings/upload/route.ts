import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "support")) {
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

    // Upload to Supabase storage
    const fileName = `recordings/${callId}/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("call-recordings")
      .upload(fileName, file)

    if (uploadError) {
      console.error("[Recording upload error]", uploadError)
      return err("Failed to upload recording", 500)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("call-recordings")
      .getPublicUrl(fileName)

    // Save recording record
    const { data, error } = await supabase
      .from("azera_call_recordings")
      .insert({
        call_id: callId,
        business_id: businessId,
        recording_url: urlData.publicUrl,
        recording_path: fileName,
        duration_seconds: 0,
        file_size_bytes: file.size,
        mime_type: file.type || "audio/wav",
        recording_type: "manual",
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !data) return err("Failed to save recording record", 500)

    return ok(data)
  } catch (e) {
    return err(String(e), 500)
  }
}
