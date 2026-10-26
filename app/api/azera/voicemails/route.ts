import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { africaBrowserConfig } from "@/lib/africa-browser-voice"
import { resolveAfricaBusinessId } from "@/lib/africastalking"

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  return session && hasPermission(session.role as UserRole, "azera") ? session : null
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

async function currentBusinessId() {
  const config = await africaBrowserConfig()
  return resolveAfricaBusinessId(config.phone)
}

export async function GET(request: Request) {
  const session = await requireSession()
  if (!session) return errorResponse("Forbidden", 403)
  if (!isSupabaseConfigured()) return NextResponse.json({ success: true, data: [] })
  const businessId = await currentBusinessId()
  if (!businessId) return errorResponse("No business is configured for Azera", 400)

  const { searchParams } = new URL(request.url)
  let query = supabase.from("azera_voicemails").select("*, azera_calls (id, customer_phone, selected_department, status, created_at), assigned_user:users (id, name, username, role)").eq("business_id", businessId).order("created_at", { ascending: false }).limit(200)
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
  let agents: unknown[] = []
  if (searchParams.get("include_agents") === "1") {
    const result = await supabase.from("users").select("id,name,username,role").eq("status", "ACTIVE").in("role", ["Admin", "Sales", "Customer Care", "Tech"]).order("name")
    agents = result.data || []
  }
  return NextResponse.json({ success: true, data: safeData, agents })
}

export async function PATCH(request: Request) {
  const session = await requireSession()
  if (!session) return errorResponse("Forbidden", 403)
  if (!isSupabaseConfigured()) return errorResponse("Supabase not configured", 500)
  const businessId = await currentBusinessId()
  if (!businessId) return errorResponse("No business is configured for Azera", 400)

  try {
    const body = await request.json()
    const id = String(body.id || "")
    if (!id) return errorResponse("Voicemail id is required")
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (["new", "listened", "resolved"].includes(String(body.status))) updates.status = body.status
    if (body.notes !== undefined) updates.notes = String(body.notes || "")
    if (body.follow_up_at !== undefined) updates.follow_up_at = body.follow_up_at || null
    if (body.assigned_user_id !== undefined) {
      const assigned = body.assigned_user_id ? String(body.assigned_user_id) : null
      if (assigned) {
        const { data: user } = await supabase.from("users").select("id,status,role").eq("id", assigned).maybeSingle()
        if (!user || user.status !== "ACTIVE" || !["Admin", "Sales", "Customer Care", "Tech"].includes(user.role)) return errorResponse("That team member cannot receive voicemail follow-up.", 400)
      }
      updates.assigned_user_id = assigned
    }
    const { data, error } = await supabase.from("azera_voicemails").update(updates).eq("id", id).eq("business_id", businessId).select().single()
    if (error) return errorResponse(error.message, 500)
    return NextResponse.json({ success: true, data })
  } catch {
    return errorResponse("Invalid voicemail update")
  }
}
