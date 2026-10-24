import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getCallAccess } from "@/lib/azera-call-access"

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
  const { id } = await params

  if (!isSupabaseConfigured()) return err("Supabase not configured", 500)

  try {
    const access = await getCallAccess(request, id)
    if (!access) return err("Please refresh the page before starting another call.", 401)
    const { call, actor } = access
    const body = await request.json()
    if (call.call_type === "webrtc") {
      if (actor.type === "agent" && call.agent_user_id && call.agent_user_id !== actor.id) return err("Another team member is handling this call.", 409)
      if (!["ringing", "active"].includes(call.status)) return ok({ status: call.status })
      const accepting = body.action === "accept"
      const nextStatus = accepting ? "ringing" : body.status === "answered" ? "active" : body.status
      if (!["active", "ended", "failed", "missed", "busy"].includes(nextStatus) && !accepting) return err("Invalid call status")
      if ((accepting || nextStatus === "active") && actor.type !== "agent") return err("Only a team member can answer this call.", 403)
      if (accepting && call.status !== "ringing") return err("This call is no longer ringing.", 409)
      const now = new Date().toISOString()
      const updates: Record<string, unknown> = { updated_at: now, status: nextStatus }
      if (accepting || nextStatus === "active") updates.agent_user_id = actor.id
      if (nextStatus === "active") updates.answered_at = call.answered_at || now
      if (["ended", "failed", "missed", "busy"].includes(nextStatus)) {
        updates.ended_at = now
        updates.duration_seconds = call.answered_at ? Math.max(0, Math.floor((Date.now() - Date.parse(call.answered_at)) / 1000)) : 0
      }
      let query = supabase.from("azera_calls").update(updates).eq("id", id).eq("status", call.status)
      query = call.agent_user_id ? query.eq("agent_user_id", call.agent_user_id) : query.is("agent_user_id", null)
      const { data, error } = await query.select("status").maybeSingle()
      if (error) return err("Could not update the call.", 500)
      if (!data) return err("The call changed. Please try again.", 409)
      if (!accepting) await supabase.from("azera_call_events").insert({
        call_id: id, event_type: nextStatus === "active" ? "answered" : nextStatus,
        actor_type: actor.type, actor_id: actor.id,
        metadata: { status: nextStatus, duration_seconds: updates.duration_seconds }, created_at: now,
      })
      return ok(data)
    }
    // Telecom updates remain staff-only; a visitor cannot alter billing,
    // destinations or provider references through the browser-call endpoint.
    if (actor.type !== "agent") return err("Forbidden", 403)
    const session = { userId: actor.id }
    const {
      status,
      answered_at,
      ended_at,
      duration_seconds,
      sip_call_sid,
      sip_cost_cents,
      webrtc_room,
      selected_department,
      follow_up_status,
      follow_up_notes,
      follow_up_at,
      agent_user_id,
    } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status !== undefined) updates.status = status
    if (answered_at !== undefined) updates.answered_at = answered_at
    if (ended_at !== undefined) updates.ended_at = ended_at
    if (duration_seconds !== undefined) updates.duration_seconds = duration_seconds
    if (sip_call_sid !== undefined) updates.sip_call_sid = sip_call_sid
    if (sip_cost_cents !== undefined) updates.sip_cost_cents = sip_cost_cents
    if (webrtc_room !== undefined) updates.webrtc_room = webrtc_room
    if (selected_department !== undefined) updates.selected_department = selected_department
    if (["new", "assigned", "contacted", "resolved"].includes(String(follow_up_status))) updates.follow_up_status = follow_up_status
    if (follow_up_notes !== undefined) updates.follow_up_notes = follow_up_notes
    if (follow_up_at !== undefined) updates.follow_up_at = follow_up_at
    if (agent_user_id !== undefined) updates.agent_user_id = agent_user_id

    const { data, error } = await supabase
      .from("azera_calls")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error || !data) return err("Failed to update call", 500)

    // Log status change event
    const now = new Date().toISOString()
    if (status) {
      const eventType = status === "answered" ? "answered" : status === "ended" ? "ended" : status
      if (["ringing", "answered", "ended", "missed", "failed", "busy"].includes(eventType)) {
        await supabase.from("azera_call_events").insert({
          call_id: id,
          event_type: eventType,
          actor_type: "agent",
          actor_id: session.userId,
          metadata: { status, duration_seconds },
          created_at: now,
        })
      }
    }

    return ok(data)
  } catch (e) {
    console.error("[Azera call update error]", e)
    return err("We couldn't update this call right now. Please try again shortly.", 500)
  }
}
