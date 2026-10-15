import { NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase"
import { runAutomationSweep } from "@/lib/automations"
import { runDormancySweep } from "@/lib/client-checkins"

/* ───────────────────────────  Automation reminder sweep  ───────────────────
 * Runs the trigger → delay → action engine (lib/automations.ts). Picks up due,
 * pending automation_runs and executes their action (questionnaire / quote /
 * estimate reminders + founder client check-ins). Each successful send
 * reschedules the next step; runs stop early when the goal is met.
 * Also runs the dormancy sweep (30-days-no-login "we've missed you" note).
 *
 * Triggering: Vercel cron (see vercel.json) sends
 * Authorization: Bearer <CRON_SECRET>. Manual run:
 *   GET /api/cron/reminders?secret=<CRON_SECRET>
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
    const result = await runAutomationSweep()
    const dormancy = await runDormancySweep().catch((err) => {
      console.error("[reminders-cron] dormancy sweep failed:", err)
      return null
    })
    return NextResponse.json({ ok: true, ...result, dormancy })
  } catch (err) {
    console.error("[reminders-cron]", err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Reminder sweep failed" }, { status: 500 })
  }
}

export const POST = GET
