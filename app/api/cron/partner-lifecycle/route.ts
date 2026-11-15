import { NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase"
import { runPartnerLifecycleSweep } from "@/lib/partner-lifecycle"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return bearer === secret
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, skipped: "supabase not configured" })
  try {
    const result = await runPartnerLifecycleSweep()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[partner-lifecycle-cron]", error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Partner lifecycle evaluation failed" }, { status: 500 })
  }
}

export const POST = GET
