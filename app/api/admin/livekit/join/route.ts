import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { AccessToken } from "livekit-server-sdk"
import { getSettings } from "@/lib/settings"

async function guard() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "customers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function POST(request: Request) {
  const denied = await guard()
  if (denied) return denied

  const settings = await getSettings()
  const { apiKey, apiSecret, publicUrl } = settings.livekit

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 })
  }

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { room } = body
    if (!room) {
      return NextResponse.json({ error: "room is required" }, { status: 400 })
    }

    const adminIdentity = `admin-${session.username}`
    const at = new AccessToken(apiKey, apiSecret, {
      identity: adminIdentity,
      name: session.username,
      ttl: 3600,
    })
    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })
    const token = await at.toJwt()

    return NextResponse.json({
      token,
      url: publicUrl,
      room,
    })
  } catch (err) {
    console.error("[LiveKit join error]", err)
    return NextResponse.json({ error: "Failed to join call" }, { status: 500 })
  }
}
