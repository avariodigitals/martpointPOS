import { NextResponse } from "next/server"
import { syncExpleeHotLeads } from "@/lib/explee"

/* ───────────────────────────  Explee hot-lead sync  ───────────────────────────
 * Pulls new hot leads from the Explee outreach platform into the Leads screen
 * and mirrors each conversation into the lead's Email tab. See lib/explee.ts.
 *
 * Triggering (same contract as /api/cron/email-sync):
 *   - Vercel cron: see vercel.json ("crons"). Vercel sends
 *     Authorization: Bearer <CRON_SECRET> automatically.
 *   - External cron (e.g. cron-job.org) or manual run:
 *     GET /api/cron/explee-sync?secret=<CRON_SECRET>
 *   - If CRON_SECRET is unset, INBOUND_EMAIL_WEBHOOK_SECRET is accepted via
 *     the Authorization header, x-webhook-secret header, or ?secret= param.
 *   - If neither secret is configured the route is open — set one in prod.
 *
 * Requires EXPLEE_API_KEY (https://explee.com/app-auto-gtm/api-keys).
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

  try {
    const result = await syncExpleeHotLeads()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[explee-sync]", err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Explee sync failed" },
      { status: 500 },
    )
  }
}

export const POST = GET
