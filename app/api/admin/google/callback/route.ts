import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { exchangeGoogleCode, getGoogleSettings, saveGoogleSettings } from "@/lib/google-calendar"
import { googleRedirectUri, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-oauth-redirect"

function back(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/settings", request.url)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.hash = "google-meet"
  return NextResponse.redirect(url)
}

/* ─── GET OAuth redirect target ───
 * Google redirects here cross-site, so the SameSite=Strict admin cookie is not
 * sent. Auth is instead enforced by the state cookie issued in /connect (which
 * already required an authorized admin session) — a valid matching state proves
 * the flow was started by that admin in this browser.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const oauthError = searchParams.get("error")

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE)

  if (oauthError) return back(request, { google: "error", message: oauthError })
  if (!code || !state || !expectedState || state !== expectedState) {
    return back(request, { google: "error", message: "Invalid OAuth state. Please try connecting again." })
  }

  try {
    const s = await getGoogleSettings()
    const { refreshToken, email, grantedScopes } = await exchangeGoogleCode(s, code, googleRedirectUri(request))
    const ok = await saveGoogleSettings({
      refreshToken,
      email,
      connectedAt: new Date().toISOString(),
      grantedScopes,
    })
    if (!ok) return back(request, { google: "error", message: "Could not save Google credentials." })
    return back(request, { google: "connected" })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google connection failed"
    console.error("[google callback]", message)
    return back(request, { google: "error", message })
  }
}
