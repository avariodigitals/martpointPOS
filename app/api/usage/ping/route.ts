import { NextResponse } from "next/server"
import { recordInstallCheckin } from "@/lib/client-checkins"

/* ───────────────────  Install check-in (installed POS → MartPoint)  ───────────────────
 * Installed MartPoint POS apps report activity here so MartPoint knows the
 * client is still using the system:
 *
 *   GET https://martpoint.com.ng/api/usage/ping?token=<private install token>
 *
 * The token is issued per business in admin → Settings → Client Check-ins
 * (rotation supported) and is the primary identity. The legacy
 * `key=<install url>` form still works — it is matched to exactly one
 * business or refused, never guessed.
 *
 *   type=system  → server health / cron / maintenance beat. Requires a token
 *                  and only stamps last_system_ping_at: a running server is
 *                  NOT app usage and never marks a client "recently active".
 *   (default)    → genuine POS usage; feeds the 30-day quiet-period review.
 *
 * Always answers 200 { ok, matched } — matched=true only when the activity
 * was confirmed saved; the reason for failure is never revealed.
 */

export const dynamic = "force-dynamic"

function paramsFrom(request: Request): { token: string; key: string; type: string } {
  const url = new URL(request.url)
  return {
    token: url.searchParams.get("token") || request.headers.get("x-install-token") || "",
    key: url.searchParams.get("key") || url.searchParams.get("url") || request.headers.get("x-install-url") || "",
    type: url.searchParams.get("type") || "",
  }
}

export async function GET(request: Request) {
  const { token, key, type } = paramsFrom(request)
  return NextResponse.json({
    ok: true,
    matched: (await recordInstallCheckin({ token, key, type: type === "system" ? "system" : "usage" })).matched,
  })
}

export async function POST(request: Request) {
  let { token, key, type } = paramsFrom(request)
  if (!token && !key) {
    try {
      const body = await request.json()
      token = String(body?.token || token)
      key = String(body?.key || body?.url || key)
      type = String(body?.type || type)
    } catch {
      // fall through — empty check-in is recorded as invalid
    }
  }
  return NextResponse.json({
    ok: true,
    matched: (await recordInstallCheckin({ token, key, type: type === "system" ? "system" : "usage" })).matched,
  })
}
