import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import crypto from "crypto"
import { authorizeAdmin } from "@/lib/admin-auth"
import { buildGoogleAuthUrl, getGoogleSettings, isGoogleConfigured } from "@/lib/google-calendar"
import { googleRedirectUri, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-oauth-redirect"

/* ─── GET start the Google OAuth consent flow ─── */
export async function GET(request: Request) {
  const auth = await authorizeAdmin("settings")
  if (auth.denied) return auth.denied

  const s = await getGoogleSettings()
  if (!isGoogleConfigured(s)) {
    return NextResponse.redirect(new URL("/admin/settings?google=not_configured", request.url))
  }

  const state = crypto.randomBytes(24).toString("hex")
  const cookieStore = await cookies()
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  })

  return NextResponse.redirect(buildGoogleAuthUrl(s, googleRedirectUri(request), state))
}
