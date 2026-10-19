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
  const businessId = searchParams.get("business_id")
  const status = searchParams.get("status") // ringing|active|ended|missed|failed|busy
  const agentId = searchParams.get("agent_id")

  try {
    let query = supabase
      .from("azera_calls")
      .select(`
        *,
        azera_call_events (
          id, event_type, actor_type, metadata, created_at
        )
      `)
      .order("created_at", { ascending: false })

    if (businessId) query = query.eq("business_id", businessId)
    if (status) query = query.eq("status", status)
    if (agentId) query = query.eq("agent_user_id", agentId)

    const { data, error } = await query.limit(200)

    if (error) return err(error.message, 500)

    return ok(data || [])
  } catch (e) {
    console.error("[Azera calls list error]", e)
    return err("We couldn't load call history right now. Please try again shortly.", 500)
  }
}

export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) return err("Forbidden", 403)

  if (!isSupabaseConfigured()) return err("Supabase not configured", 500)

  try {
    const body = await request.json()
    const {
      business_id,
      call_type = "webrtc",
      direction = "outbound",
      conversation_id,
      agent_user_id = session.userId,
      agent_name = session.name,
      customer_name,
      customer_phone,
      customer_external_id,
      sip_provider,
      sip_from_number,
      sip_to_number,
      webrtc_room,
    } = body

    if (!business_id) return err("business_id is required")

    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("azera_calls")
      .insert({
        business_id,
        conversation_id,
        call_type,
        direction,
        status: direction === "outbound" ? "ringing" : "ringing",
        agent_user_id,
        agent_name,
        customer_name,
        customer_phone,
        customer_external_id,
        sip_provider,
        sip_from_number,
        sip_to_number,
        webrtc_room,
        started_at: now,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error || !data) return err("We couldn't start the call right now. Please try again shortly.", 500)

    // Log call initiated event
    await supabase.from("azera_call_events").insert({
      call_id: data.id,
      event_type: "call_initiated",
      actor_type: "agent",
      actor_id: session.userId,
      metadata: { call_type, direction },
      created_at: now,
    })

    return ok(data)
  } catch (e) {
    console.error("[Azera call create error]", e)
    return err("We couldn't start the call right now. Please try again shortly.", 500)
  }
}
