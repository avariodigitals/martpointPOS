import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  return session && hasPermission(session.role as UserRole, "azera") ? session : null
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(request: Request) {
  const session = await requireSession()
  if (!session) return errorResponse("Forbidden", 403)
  if (!isSupabaseConfigured()) return NextResponse.json({ success: true, data: [] })

  const { searchParams } = new URL(request.url)
  let query = supabase.from("azera_voicemails").select("*, azera_calls (id, customer_phone, selected_department, status, created_at)").order("created_at", { ascending: false }).limit(200)
  if (searchParams.get("business_id")) query = query.eq("business_id", searchParams.get("business_id") as string)
  if (searchParams.get("status")) query = query.eq("status", searchParams.get("status") as string)
  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)

  const safeData = await Promise.all((data || []).map(async (voicemail) => {
    let signedUrl: string | null = null
    if (voicemail.recording_path && (!voicemail.retention_expires_at || Date.parse(voicemail.retention_expires_at) > Date.now())) {
      const signed = await supabase.storage.from("azera-voicemails").createSignedUrl(voicemail.recording_path, 900)
      signedUrl = signed.data?.signedUrl || null
    }
    return { ...voicemail, recording_url: undefined, signed_url: signedUrl }
  }))
  return NextResponse.json({ success: true, data: safeData })
}

export async function PATCH(request: Request) {
  const session = await requireSession()
  if (!session) return errorResponse("Forbidden", 403)
  if (!isSupabaseConfigured()) return errorResponse("Supabase not configured", 500)

  try {
    const body = await request.json()
    const id = String(body.id || "")
    if (!id) return errorResponse("Voicemail id is required")
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (["new", "listened", "resolved"].includes(String(body.status))) updates.status = body.status
    if (body.notes !== undefined) updates.notes = String(body.notes || "")
    if (body.follow_up_at !== undefined) updates.follow_up_at = body.follow_up_at || null
    if (body.assigned_user_id !== undefined) updates.assigned_user_id = body.assigned_user_id || null
    const { data, error } = await supabase.from("azera_voicemails").update(updates).eq("id", id).select().single()
    if (error) return errorResponse(error.message, 500)
    return NextResponse.json({ success: true, data })
  } catch {
    return errorResponse("Invalid voicemail update")
  }
}
