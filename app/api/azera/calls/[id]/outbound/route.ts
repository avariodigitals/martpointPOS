import { NextResponse } from "next/server"
import { SIPOutboundConfig, TrackType } from "@livekit/protocol"
import { getSession, hasPermission } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { getSettings } from "@/lib/settings"
import { voiceApi, outboundReady, finishOutbound, deleteVoiceRoom } from "@/lib/azera-outbound"

const err = (error: string, status: number) => NextResponse.json({ error }, { status })
type Context = { params: Promise<{ id: string }> }
async function ownedCall(context: Context) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, "azera")) return null
  const { id } = await context.params
  const { data: call } = await supabase.from("azera_calls").select("*").eq("id", id)
    .eq("agent_user_id", session.userId).eq("sip_provider", "livekit").eq("direction", "outbound").maybeSingle()
  return call ? { call, session } : null
}

export async function POST(_request: Request, context: Context) {
  try {
    const owned = await ownedCall(context)
    if (!owned) return err("Call not found or access denied.", 403)
    const { call, session } = owned
    if (call.status !== "ringing") return err("This call is no longer waiting to dial.", 409)
    const { livekit } = await getSettings()
    if (!outboundReady(livekit)) return err("Complete the voice integration before calling.", 503)
    const api = voiceApi(livekit)
    const participants = await api.room.listParticipants(call.webrtc_room)
    if (!participants.some((participant) => participant.identity === `agent-${session.userId}` && participant.tracks.some((track) => track.type === TrackType.AUDIO && !track.muted))) {
      return err("Connect your microphone before dialing.", 409)
    }
    // A retry/double click must never place a second paid telephone call.
    const { data: claimed, error } = await supabase.from("azera_calls").update({ sip_call_sid: `dialing-${call.id}` })
      .eq("id", call.id).eq("status", "ringing").is("sip_call_sid", null).select("id").maybeSingle()
    if (error) return err("Could not start the call.", 500)
    if (!claimed) return NextResponse.json({ status: call.status })
    try {
      const participant = await api.sip.createSipParticipant("", call.sip_to_number, call.webrtc_room, {
        participantIdentity: `phone-${call.id}`, participantName: call.customer_name || "Customer",
        fromNumber: livekit.sipNumber, waitUntilAnswered: false, ringingTimeout: 60, maxCallDuration: 3600, playDialtone: true,
      }, new SIPOutboundConfig({ hostname: livekit.sipHostname, authUsername: livekit.sipUsername,
        authPassword: livekit.sipPassword, destinationCountry: livekit.destinationCountry }))
      const { data: persisted } = await supabase.from("azera_calls").update({ sip_call_sid: participant.sipCallId || participant.participantId,
        updated_at: new Date().toISOString() }).eq("id", call.id).eq("status", "ringing").select("id").maybeSingle()
      if (!persisted) { await deleteVoiceRoom(api, call.webrtc_room); return err("The call was cancelled.", 409) }
      await supabase.from("azera_call_events").insert({ call_id: call.id, event_type: "ringing", actor_type: "agent", actor_id: session.userId, metadata: { provider: "livekit" } })
      return NextResponse.json({ status: "ringing" })
    } catch {
      await deleteVoiceRoom(api, call.webrtc_room).catch(() => {})
      await finishOutbound(call, "failed", session.userId)
      return err("The phone call could not connect. Check your SIP provider credentials, balance and number permissions.", 502)
    }
  } catch { return err("The voice service is temporarily unavailable.", 502) }
}

export async function GET(_request: Request, context: Context) {
  try {
    const owned = await ownedCall(context)
    if (!owned) return NextResponse.json({ status: "transferred", error: "This call is no longer assigned to you." }, { status: 403 })
    const { call, session } = owned
    let status = call.status
    if (["ringing", "active"].includes(status) && call.sip_call_sid && !call.sip_call_sid.startsWith("dialing-")) {
      const { livekit } = await getSettings()
      const participants = await voiceApi(livekit).room.listParticipants(call.webrtc_room).catch((error: unknown) => {
        if (error && typeof error === "object" && "code" in error && error.code === "not_found") return []
        throw error
      })
      const phone = participants.find((participant) => participant.identity === `phone-${call.id}`)
      if (phone?.attributes["sip.callStatus"] === "active" && status !== "active") status = await finishOutbound(call, "active", session.userId)
      else if (!phone && (status === "active" || Date.now() - Date.parse(call.started_at) > 5000)) {
        status = await finishOutbound(call, status === "active" ? "ended" : "missed", session.userId)
        await deleteVoiceRoom(voiceApi(livekit), call.webrtc_room).catch(() => {})
      }
    }
    return NextResponse.json({ status }, { headers: { "Cache-Control": "no-store" } })
  } catch { return err("Could not check the call connection.", 502) }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const owned = await ownedCall(context)
    if (!owned) return err("Call not found or access denied.", 403)
    const { call, session } = owned
    if (!["ringing", "active"].includes(call.status)) return NextResponse.json({ status: call.status })
    const { livekit } = await getSettings()
    // End both the browser and telephone legs, not only the local audio.
    await deleteVoiceRoom(voiceApi(livekit), call.webrtc_room)
    const reason = new URL(request.url).searchParams.get("reason")
    const status = await finishOutbound(call, reason === "failed" ? "failed" : reason === "missed" ? "missed" : "ended", session.userId)
    return NextResponse.json({ status })
  } catch { return err("Could not end the telephone call. Try End call again.", 502) }
}
