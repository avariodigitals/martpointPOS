import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { AccessToken } from "livekit-server-sdk"
import { getSession, hasPermissionForUser } from "@/lib/admin-auth"
import { getSettings } from "@/lib/settings"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { normalizeOutboundPhone, outboundReady, voiceApi } from "@/lib/azera-outbound"
import { normalizeSipAddress } from "@/lib/browser-phone-target"
import { resolveCampaignBusinessId } from "@/lib/azera-campaigns"
import { checkRateLimit } from "@/lib/rate-limit"

const err = (error: string, status: number) => NextResponse.json({ error }, { status })
export async function GET() {
  const session = await getSession()
  if (!session || !await hasPermissionForUser(session.userId, session.role, "azera")) return err("Forbidden", 403)
  const { livekit } = await getSettings()
  return NextResponse.json({ ready: outboundReady(livekit), setupUrl: "/admin/integrations" }, { headers: { "Cache-Control": "no-store" } })
}

// Preparation never dials a number. Staff must first join the room and publish
// their microphone, then explicitly invoke the owned call's dial endpoint.
export async function POST(request: Request) {
  const session = await getSession()
  if (!session || !await hasPermissionForUser(session.userId, session.role, "azera")) return err("Forbidden", 403)
  if (!isSupabaseConfigured()) return err("Calling is temporarily unavailable.", 503)
  const { livekit } = await getSettings()
  if (!outboundReady(livekit)) return err("Browser calling needs LiveKit and SIP credentials in Admin → Integrations. Your device dialer will not be opened.", 503)
  try {
    const body = await request.json()
    const hasSipAddress = typeof body?.sipAddress === "string"
    const hasConversation = typeof body?.conversationId === "string" && Boolean(body.conversationId)
    if (hasSipAddress === hasConversation) return err("Choose a contact or enter one SIP address.", 400)
    let conversation: { id: string; business_id: string; customer_phone: string | null; customer_name: string | null } | null = null
    let sipAddress: string | null = null
    let businessId = ""
    let name = ""
    let destination = ""
    if (hasSipAddress) {
      sipAddress = normalizeSipAddress(body.sipAddress)
      if (!sipAddress) return err("Enter a SIP address in the form user@provider.example.", 400)
      const nameInput = body.name
      if (nameInput !== undefined && (typeof nameInput !== "string" || nameInput.length > 120 || /[\r\n]/.test(nameInput))) return err("Enter a short contact name.", 400)
      name = typeof nameInput === "string" && nameInput.trim() ? nameInput.trim() : sipAddress
      businessId = await resolveCampaignBusinessId() || ""
      destination = sipAddress
      const limit = await checkRateLimit(request, { key: `azera-sip-outbound:${session.userId}`, max: 20, windowSeconds: 3600 })
      if (!limit.allowed) return err("Too many call attempts. Please try again later.", 429)
    } else {
      conversation = (await supabase.from("azera_conversations")
        .select("id,business_id,customer_name,customer_phone").eq("id", body.conversationId).maybeSingle()).data
      if (!conversation) return err("Conversation not found.", 404)
      destination = normalizeOutboundPhone(String(conversation.customer_phone || "")) || ""
      if (!destination) return err("This contact needs a valid phone number, including its country code.", 400)
      businessId = conversation.business_id
      name = conversation.customer_name || "Contact"
    }
    if (!businessId) return err("Phone calling is not set up for this business. Ask an administrator for help.", 503)
    const id = randomUUID()
    const room = `azera-out-${id}`
    const identity = `agent-${session.userId}`
    const now = new Date().toISOString()
    const { error } = await supabase.from("azera_calls").insert({ id, business_id: businessId,
      conversation_id: conversation?.id || null, call_type: "sip", direction: "outbound", status: "ringing",
      agent_user_id: session.userId, agent_name: session.name, customer_name: name,
      customer_phone: destination, sip_provider: "livekit", sip_from_number: livekit.sipNumber,
      sip_to_number: destination, webrtc_room: room, started_at: now, created_at: now, updated_at: now })
    if (error) return err("Could not prepare the call. Please try again.", 500)
    try {
      await voiceApi(livekit).room.createRoom({ name: room, maxParticipants: 8, emptyTimeout: 90, departureTimeout: 15 })
      const token = new AccessToken(livekit.apiKey, livekit.apiSecret, { identity, name: session.name, ttl: 900 })
      token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false })
      await supabase.from("azera_call_events").insert({ call_id: id, event_type: "call_initiated", actor_type: "agent",
        actor_id: session.userId, metadata: { provider: "livekit", stage: "prepared" }, created_at: now })
      return NextResponse.json({ id, room, phone: destination, url: livekit.publicUrl, token: await token.toJwt() }, { headers: { "Cache-Control": "no-store" } })
    } catch {
      await voiceApi(livekit).room.deleteRoom(room).catch(() => {})
      await supabase.from("azera_calls").update({ status: "failed", ended_at: new Date().toISOString() }).eq("id", id)
      return err("The voice service could not connect. Check the LiveKit integration and try again.", 502)
    }
  } catch { return err("Could not prepare the call. Please try again.", 500) }
}
