import { NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase"
import { runInvoiceReminderSweep } from "@/lib/invoice-emails"

/* ───────────────────────────  Invoice payment reminders  ───────────────────
 * Daily sweep: emails a payment reminder to the primary contact for unpaid
 * invoices (ISSUED / PARTIALLY_PAID / OVERDUE) due within 3 days or overdue.
 * Cadence: at most one reminder every 5 days, max 6 per invoice.
 * Per-invoice opt-out: invoices.reminders_paused.
 *
 * Triggering: Vercel cron (see vercel.json) sends
 * Authorization: Bearer <CRON_SECRET>. Manual run:
 *   GET /api/cron/invoice-reminders?secret=<CRON_SECRET>
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
    const result = await runInvoiceReminderSweep()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[invoice-reminders-cron]", err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Reminder sweep failed" }, { status: 500 })
  }
}

export const POST = GET
