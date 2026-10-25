import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

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

export async function GET(request: Request) {
  const session = await requireSession()
  if (!session) return err("Forbidden", 403)

  if (!isSupabaseConfigured()) return ok([])

  const { searchParams } = new URL(request.url)
  const callId = searchParams.get("call_id")
  const businessId = searchParams.get("business_id")

  try {
    let query = supabase
      .from("azera_call_recordings")
      .select("*")
      .order("created_at", { ascending: false })

    if (callId) query = query.eq("call_id", callId)
    if (businessId) query = query.eq("business_id", businessId)

    const { data, error } = await query.limit(200)

    if (error) return err(error.message, 500)

    const recordings = await Promise.all((data || []).map(async (recording) => {
      if (recording.retention_expires_at && Date.parse(recording.retention_expires_at) < Date.now()) return { ...recording, recording_url: null, expired: true }
      if (!recording.recording_path) return { ...recording, recording_url: /^https:\/\//.test(recording.recording_url) ? recording.recording_url : null }
      const { data: signed } = await supabase.storage.from("call-recordings").createSignedUrl(recording.recording_path, 300)
      return { ...recording, recording_url: signed?.signedUrl || null }
    }))
    return ok(recordings)
  } catch (e) {
    return err(String(e), 500)
  }
}

export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) return err("Forbidden", 403)

  if (!isSupabaseConfigured()) return err("Supabase not configured", 500)

  try {
    const body = await request.json()
    const {
      call_id,
      business_id,
      recording_url,
      recording_path,
      duration_seconds,
      file_size_bytes,
      mime_type = "audio/wav",
      recording_type = "manual",
      consent_confirmed,
    } = body

    if (!call_id || !business_id || !recording_url) {
      return err("call_id, business_id and recording_url are required")
    }
    if (consent_confirmed !== true) return err("Confirm that the participants consented to recording.")
    if (typeof recording_url !== "string" || !/^https:\/\//.test(recording_url)) return err("Use a secure recording URL.")
    const { data: call } = await supabase.from("azera_calls").select("id").eq("id", call_id).eq("business_id", business_id).maybeSingle()
    if (!call) return err("The recording must belong to the selected call and business.", 404)

    const { data, error } = await supabase
      .from("azera_call_recordings")
      .insert({
        call_id,
        business_id,
        recording_url,
        recording_path,
        duration_seconds,
        file_size_bytes,
        mime_type,
        recording_type,
        consent_confirmed_at: new Date().toISOString(),
        retention_expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !data) return err("Failed to save recording", 500)

    return ok(data)
  } catch (e) {
    return err(String(e), 500)
  }
}
