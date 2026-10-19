import { NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase"
import { completeExpiredMeetings } from "@/lib/meeting-status"

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
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, completed: 0, skipped: ["supabase not configured"] })

  try {
    const result = await completeExpiredMeetings()
    return NextResponse.json({ ok: true, completed: result.leadCompleted.length + result.partnerCompleted.length, ...result })
  } catch (err) {
    console.error("[meetings-cron]", err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Meeting lifecycle failed" }, { status: 500 })
  }
}

export const POST = GET
