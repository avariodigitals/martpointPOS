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

    return ok(data || [])
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
    } = body

    if (!call_id || !business_id || !recording_url) {
      return err("call_id, business_id and recording_url are required")
    }

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
