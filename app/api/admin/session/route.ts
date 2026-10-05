import { NextResponse } from "next/server"
import { getSession, refreshSessionActivity, clearAdminCookie, getAdminSessionTimeoutMs } from "@/lib/admin-auth"

/**
 * Sliding-session heartbeat for the admin portal.
 *
 * GET  → returns the current timeout (ms) and whether an authenticated session
 *        is still alive, WITHOUT mutating state. Used by the client to decide
 *        how long to wait before pinging.
 * POST → bumps `lastActive` on an active session (sliding renewal) and returns
 *        401 if the session is missing or already idle-expired.
 */
export async function GET() {
  const session = await getSession()
  return NextResponse.json({
    authenticated: session !== null,
    timeoutMs: getAdminSessionTimeoutMs(),
  })
}

export async function POST() {
  const session = await refreshSessionActivity()
  if (!session) {
    await clearAdminCookie()
    return NextResponse.json({ error: "Session expired" }, { status: 401 })
  }
  return NextResponse.json({ success: true, timeoutMs: getAdminSessionTimeoutMs() })
}
