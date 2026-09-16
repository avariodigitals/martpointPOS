import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { LiveKitAPI, AccessToken } from "livekit-server-sdk"
import { SIPOutboundConfig } from "@livekit/protocol"
import { getSettings } from "@/lib/settings"

async function guard() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "customers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "")
  if (digits.startsWith("+")) return digits
  if (digits.startsWith("0")) return "+234" + digits.slice(1)
  if (digits.startsWith("234")) return "+" + digits
  return "+234" + digits
}

export async function POST(request: Request) {
  const denied = await guard()
  if (denied) return denied

  const settings = await getSettings()
  const livekit = settings.livekit

  if (!livekit.serverUrl || !livekit.apiKey || !livekit.apiSecret || !livekit.sipHostname || !livekit.sipUsername || !livekit.sipPassword || !livekit.sipNumber) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 })
  }

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { customerId, phone } = body
    if (!customerId || !phone) {
      return NextResponse.json({ error: "customerId and phone are required" }, { status: 400 })
    }

    const to = normalizePhone(phone)
    const roomName = `call-${customerId}-${Date.now()}`
    const adminIdentity = `admin-${session.username}`

    const at = new AccessToken(livekit.apiKey, livekit.apiSecret, {
      identity: adminIdentity,
      name: session.username,
      ttl: 3600,
    })
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })
    const token = await at.toJwt()

    const api = new LiveKitAPI({ host: livekit.serverUrl, apiKey: livekit.apiKey, secret: livekit.apiSecret })
    const trunk = new SIPOutboundConfig({
      hostname: livekit.sipHostname,
      authUsername: livekit.sipUsername,
      authPassword: livekit.sipPassword,
      destinationCountry: livekit.destinationCountry,
    })

    await api.sip.createSipParticipant(
      "",
      to,
      roomName,
      {
        participantIdentity: "customer",
        participantName: "Customer",
        fromNumber: livekit.sipNumber,
        waitUntilAnswered: false,
      },
      trunk
    )

    return NextResponse.json({
      room: roomName,
      token,
      url: livekit.publicUrl,
      phone: to,
    })
  } catch (err) {
    console.error("[LiveKit call error]", err)
    return NextResponse.json({ error: "Failed to place call" }, { status: 500 })
  }
}
