import { NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase"
import { syncTikTokMetrics } from "@/lib/creator-social-metrics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return process.env.NODE_ENV !== "production"
  return request.headers.get("authorization") === `Bearer ${expected}`
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, skipped: "Supabase is not configured" })
  try {
    const result = await syncTikTokMetrics()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[creator-social-metrics] sync failed", error)
    return NextResponse.json({ ok: false, error: "Creator social metrics sync failed" }, { status: 500 })
  }
}
