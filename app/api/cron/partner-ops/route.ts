import { NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase"
import { runPartnerOpsSweep } from "@/lib/partner-ops"

/* ───────────────────────────  Partner operations sweep  ───────────────────
 * Scheduled partner lifecycle processing per the Portal Automation Blueprint:
 *   - PENDING commissions → ELIGIBLE once payment/business/partner/holding
 *     gates pass (REVERSED if the payment was clawed back)
 *   - Lead protection expiry
 *   - Certification expiry
 *   - Due/overdue milestone + expiry reminder emails (one-shot per record)
 *
 * Triggering: Vercel cron (see vercel.json) sends
 * Authorization: Bearer <CRON_SECRET>. Manual run:
 *   GET /api/cron/partner-ops?secret=<CRON_SECRET>
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
    return NextResponse.json({ ok: true, skipped: ["supabase not configured"] })
  }
  try {
    const result = await runPartnerOpsSweep()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[partner-ops-cron]", err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Partner ops sweep failed" }, { status: 500 })
  }
}

export const POST = GET
