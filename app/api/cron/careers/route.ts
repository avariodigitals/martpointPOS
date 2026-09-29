import { NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase"
import { runCareersLifecycle } from "@/lib/careers"

/* ───────────────────────────  Careers lifecycle sweep  ───────────────────
 * Applies automatic vacancy/deployment transitions:
 *   SCHEDULED → PUBLISHED when the scheduled time passes
 *   PUBLISHED → CLOSED when the application deadline passes (auto-close)
 *   PUBLISHED → CLOSED when the application cap is reached (auto-close)
 *   Deployment PLANNED/ACTIVE → COMPLETED after the end date
 *
 * Triggering: Vercel cron (see vercel.json) sends
 * Authorization: Bearer <CRON_SECRET>. Manual run:
 *   GET /api/cron/careers?secret=<CRON_SECRET>
 * If CRON_SECRET is unset, INBOUND_EMAIL_WEBHOOK_SECRET is also accepted.
 * If neither is configured the route is open — set one in prod.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  const inboundSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET
  if (!cronSecret && !inboundSecret) return true
  const auth = request.headers.get("authorization")
  const provided =
    (auth?.startsWith("Bearer ") ? auth.slice(7) : null) ||
    request.headers.get("x-webhook-secret") ||
    new URL(request.url).searchParams.get("secret")
  return provided === cronSecret || provided === inboundSecret
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, published: 0, closed: 0, deploymentsCompleted: 0, skipped: ["supabase not configured"] })
  }
  try {
    const result = await runCareersLifecycle()
    return NextResponse.json({
      ok: true,
      published: result.published.length,
      closed: result.closed.length,
      deploymentsCompleted: result.deploymentsCompleted.length,
    })
  } catch (err) {
    console.error("[careers-cron]", err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Lifecycle sweep failed" }, { status: 500 })
  }
}

export const POST = GET
