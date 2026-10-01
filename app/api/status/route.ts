import { NextResponse } from "next/server"
import { listIncidents } from "@/lib/status-page"
import { buildFeedPayload } from "@/lib/status-feed"
import { isSupabaseConfigured } from "@/lib/supabase"

/**
 * GET /api/status — public machine-readable feed consumed by every installed
 * MartPoint POS instance (~15 min poll, server-to-server). See
 * lib/status-feed.ts for the payload contract.
 *
 * On failure we return non-200 so installs keep their last known state —
 * a backend outage is exactly when the banner should keep showing.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ status: "error", error: "Status backend unavailable" }, { status: 503 })
  }

  try {
    const payload = buildFeedPayload(await listIncidents(), new Date())
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60" },
    })
  } catch (e) {
    console.error("[api/status]", e)
    return NextResponse.json({ status: "error", error: "Status backend unavailable" }, { status: 503 })
  }
}
