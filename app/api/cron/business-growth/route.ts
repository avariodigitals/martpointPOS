import { NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase"
import { runBusinessGrowthJobs } from "@/lib/business-growth-programme"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") === secret
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, skipped: "supabase not configured" })
  try {
    return NextResponse.json({ ok: true, ...await runBusinessGrowthJobs(20) })
  } catch (error) {
    console.error("[business-growth-cron]", error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Programme job run failed" }, { status: 500 })
  }
}

export const POST = GET
