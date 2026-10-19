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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return err("Forbidden", 403)

  const { id } = await params

  if (!isSupabaseConfigured()) return err("Supabase not configured", 500)

  try {
    const { data, error } = await supabase
      .from("azera_calls")
      .select(`
        *,
        azera_call_events (
          id, event_type, actor_type, metadata, created_at
        )
      `)
      .eq("id", id)
      .single()

    if (error || !data) return err("Call not found", 404)

    return ok(data)
  } catch (e) {
    console.error("[Azera call read error]", e)
    return err("We couldn't load this call right now. Please try again shortly.", 500)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return err("Forbidden", 403)

  const { id } = await params

  if (!isSupabaseConfigured()) return err("Supabase not configured", 500)

  try {
    const body = await request.json()
    const {
      status,
      answered_at,
      ended_at,
      duration_seconds,
      sip_call_sid,
      sip_cost_cents,
      webrtc_room,
    } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status !== undefined) updates.status = status
    if (answered_at !== undefined) updates.answered_at = answered_at
    if (ended_at !== undefined) updates.ended_at = ended_at
    if (duration_seconds !== undefined) updates.duration_seconds = duration_seconds
    if (sip_call_sid !== undefined) updates.sip_call_sid = sip_call_sid
    if (sip_cost_cents !== undefined) updates.sip_cost_cents = sip_cost_cents
    if (webrtc_room !== undefined) updates.webrtc_room = webrtc_room

    const { data, error } = await supabase
      .from("azera_calls")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error || !data) return err("Failed to update call", 500)

    // Log status change event
    const now = new Date().toISOString()
    const eventType = status === "answered" ? "answered" : status === "ended" ? "ended" : status

    await supabase.from("azera_call_events").insert({
      call_id: id,
      event_type: eventType,
      actor_type: "agent",
      actor_id: session.userId,
      metadata: { status, duration_seconds },
      created_at: now,
    })

    return ok(data)
  } catch (e) {
    console.error("[Azera call update error]", e)
    return err("We couldn't update this call right now. Please try again shortly.", 500)
  }
}
