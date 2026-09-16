import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { LiveKitAPI } from "livekit-server-sdk"
import { ParticipantInfo_Kind, ParticipantInfo_State } from "@livekit/protocol"
import { getSettings } from "@/lib/settings"

async function guard() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "customers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function GET() {
  const denied = await guard()
  if (denied) return denied

  const settings = await getSettings()
  const { serverUrl: livekitUrl, apiKey, apiSecret } = settings.livekit

  if (!livekitUrl || !apiKey || !apiSecret) {
    return NextResponse.json({ calls: [] })
  }

  try {
    const api = new LiveKitAPI({ host: livekitUrl, apiKey, secret: apiSecret })
    const rooms = await api.room.listRooms()
    const inbound = rooms.filter((r) => r.name.startsWith("inbound-"))

    const calls = []
    for (const room of inbound) {
      const participants = await api.room.listParticipants(room.name)
      const caller = participants.find(
        (p) => p.kind === ParticipantInfo_Kind.SIP && p.state === ParticipantInfo_State.ACTIVE
      )
      if (!caller) continue

      const phone = caller.attributes["sip.phoneNumber"] || caller.name || caller.identity
      calls.push({
        room: room.name,
        phone,
        joinedAt: Number(caller.joinedAtMs || room.creationTimeMs),
      })
    }

    return NextResponse.json({ calls })
  } catch (err) {
    console.error("[LiveKit calls error]", err)
    return NextResponse.json({ calls: [] })
  }
}
