import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { executeCampaign } from "@/lib/marketing"

/*
 * Sends scheduled campaigns whose time has come.
 * Called by the GitHub Actions workflow .github/workflows/marketing-cron.yml
 * (Authorization: Bearer <CRON_SECRET>) every 30 minutes.
 * Also callable by admins manually.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  const isCron = cronSecret && auth === `Bearer ${cronSecret}`

  if (!isCron) {
    const session = await getSession()
    if (!session || !hasPermission(session.role as UserRole, "marketing")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { data: due, error } = await supabase
    .from("marketing_campaigns")
    .select("id, subject")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(5)

  if (error) {
    console.error("[Marketing Send-Due Error]", error)
    return NextResponse.json({ error: "Failed to fetch due campaigns" }, { status: 500 })
  }

  const results = []
  for (const c of due || []) {
    const r = await executeCampaign(c.id)
    results.push({ campaignId: c.id, subject: c.subject, ...r })
  }

  return NextResponse.json({ processed: results.length, results })
}

/* GET delegates to the same logic (useful for manual browser hits / health checks). */
export async function GET(request: Request) {
  return POST(request)
}
