import { NextResponse } from "next/server"
import { authorizeAdmin, getSession } from "@/lib/admin-auth"
import { getGoogleSettings, isGoogleConfigured, isGoogleConnected, saveGoogleSettings } from "@/lib/google-calendar"
import { googleRedirectUri } from "@/lib/google-oauth-redirect"

/* ─── GET connection status (any admin) ─── */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const s = await getGoogleSettings()
  return NextResponse.json({
    configured: isGoogleConfigured(s),
    connected: isGoogleConnected(s),
    email: s.email || null,
    connectedAt: s.connectedAt || null,
    calendarId: s.calendarId,
    redirectUri: googleRedirectUri(request),
  })
}

/* ─── DELETE disconnect the Google account ─── */
export async function DELETE() {
  const auth = await authorizeAdmin("settings")
  if (auth.denied) return auth.denied

  const ok = await saveGoogleSettings({ refreshToken: "", email: "", connectedAt: "" })
  if (!ok) return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 })
  return NextResponse.json({ success: true })
}
