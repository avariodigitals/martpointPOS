import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { AccessToken } from "livekit-server-sdk"
import { getSession, hasPermission } from "@/lib/admin-auth"
import { getSettings } from "@/lib/settings"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { normalizeOutboundPhone, outboundReady, voiceApi } from "@/lib/azera-outbound"

const err = (error: string, status: number) => NextResponse.json({ error }, { status })
export async function GET() {
  const session = await getSession()
  if (!session || !hasPermission(session.role, "azera")) return err("Forbidden", 403)
  const { livekit } = await getSettings()
  return NextResponse.json({ ready: outboundReady(livekit), setupUrl: "/admin/integrations" }, { headers: { "Cache-Control": "no-store" } })
}

// Preparation never dials a number. Staff must first join the room and publish
// their microphone, then explicitly invoke the owned call's dial endpoint.
export async function POST(request: Request) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, "azera")) return err("Forbidden", 403)
  if (!isSupabaseConfigured()) return err("Calling is temporarily unavailable.", 503)
  const { livekit } = await getSettings()
  if (!outboundReady(livekit)) return err("Browser calling needs LiveKit and SIP credentials in Admin → Integrations. Your device dialer will not be opened.", 503)
  try {
    const { conversationId } = await request.json()
    if (typeof conversationId !== "string" || !conversationId) return err("Choose a conversation first.", 400)
    const { data: conversation } = await supabase.from("azera_conversations")
      .select("id,business_id,customer_name,customer_phone").eq("id", conversationId).maybeSingle()
    if (!conversation) return err("Conversation not found.", 404)
    const phone = normalizeOutboundPhone(String(conversation.customer_phone || ""))
    if (!phone) return err("This contact needs a valid phone number, including its country code.", 400)
    const id = randomUUID()
    const room = `azera-out-${id}`
    const identity = `agent-${session.userId}`
    const now = new Date().toISOString()
    const { error } = await supabase.from("azera_calls").insert({ id, business_id: conversation.business_id,
      conversation_id: conversation.id, call_type: "sip", direction: "outbound", status: "ringing",
      agent_user_id: session.userId, agent_name: session.name, customer_name: conversation.customer_name,
      customer_phone: phone, sip_provider: "livekit", sip_from_number: livekit.sipNumber,
      sip_to_number: phone, webrtc_room: room, started_at: now, created_at: now, updated_at: now })
    if (error) return err("Could not prepare the call. Please try again.", 500)
    try {
      await voiceApi(livekit).room.createRoom({ name: room, maxParticipants: 2, emptyTimeout: 90, departureTimeout: 15 })
      const token = new AccessToken(livekit.apiKey, livekit.apiSecret, { identity, name: session.name, ttl: 900 })
      token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false })
      await supabase.from("azera_call_events").insert({ call_id: id, event_type: "call_initiated", actor_type: "agent",
        actor_id: session.userId, metadata: { provider: "livekit", stage: "prepared" }, created_at: now })
      return NextResponse.json({ id, room, phone, url: livekit.publicUrl, token: await token.toJwt() }, { headers: { "Cache-Control": "no-store" } })
    } catch {
      await voiceApi(livekit).room.deleteRoom(room).catch(() => {})
      await supabase.from("azera_calls").update({ status: "failed", ended_at: new Date().toISOString() }).eq("id", id)
      return err("The voice service could not connect. Check the LiveKit integration and try again.", 502)
    }
  } catch { return err("Could not prepare the call. Please try again.", 500) }
}
