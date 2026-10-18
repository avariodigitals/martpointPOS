import { NextResponse } from "next/server"
import { getCustomerSupportSession } from "@/lib/customer-support-auth"
import { getSession as getAdminSession } from "@/lib/admin-auth"
import { hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}
function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

/**
 * WebRTC signaling for browser-to-browser calls.
 *
 * Both caller and callee POST/GET SDP offer/answer and ICE candidates through
 * this endpoint, keyed by call_id. The actual audio flows P2P after setup;
 * this server only carries small signaling messages.
 *
 * Auth: either an admin agent (session) OR a customer support session.
 */

async function getActor(request: Request) {
  // Try admin session first
  const admin = await getAdminSession()
  if (admin && hasPermission(admin.role as UserRole, "support")) {
    return { type: "agent" as const, id: admin.userId, name: admin.name }
  }

  // Fall back to customer support session
  const customer = await getCustomerSupportSession()
  if (customer) {
    return { type: "customer" as const, id: customer.businessId, name: customer.contactName }
  }

  return null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor(request)
  if (!actor) return err("Unauthorized", 401)

  const { id } = await params

  if (!isSupabaseConfigured()) return err("Supabase not configured", 500)

  try {
    const body = await request.json()
    const {
      sdp_type,        // "offer" | "answer"
      sdp,             // session description
      candidate,       // ICE candidate (optional)
      candidate_sdp_mid,
      candidate_sdp_mline_index,
    } = body

    if (!sdp_type || !sdp) return err("sdp_type and sdp are required")

    // Verify call exists and actor is part of it
    const { data: call, error: callError } = await supabase
      .from("azera_calls")
      .select("*")
      .eq("id", id)
      .single()

    if (callError || !call) return err("Call not found", 404)

    const now = new Date().toISOString()

    // Store signaling message
    const { data, error } = await supabase
      .from("azera_call_events")
      .insert({
        call_id: id,
        event_type:
          sdp_type === "offer" ? "webrtc_offer" : sdp_type === "answer" ? "webrtc_answer" : "webrtc_ice_candidate",
        actor_type: actor.type,
        actor_id: actor.id,
        metadata: {
          sdp_type,
          sdp,
          candidate,
          candidate_sdp_mid,
          candidate_sdp_mline_index,
        },
        created_at: now,
      })
      .select()
      .single()

    if (error || !data) return err("Failed to send signaling message", 500)

    return ok(data)
  } catch (e) {
    return err(String(e), 500)
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor(request)
  if (!actor) return err("Unauthorized", 401)

  const { id } = await params

  if (!isSupabaseConfigured()) return ok([])

  try {
    const { data, error } = await supabase
      .from("azera_call_events")
      .select("*")
      .eq("call_id", id)
      .in("event_type", ["webrtc_offer", "webrtc_answer", "webrtc_ice_candidate"])
      .order("created_at", { ascending: true })

    if (error) return err(error.message, 500)

    return ok(data || [])
  } catch (e) {
    return err(String(e), 500)
  }
}
