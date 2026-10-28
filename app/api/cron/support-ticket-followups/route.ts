import { NextResponse } from "next/server"
import { runSupportTicketFollowups } from "@/lib/support-ticket-followups"

export const maxDuration = 60
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, ...(await runSupportTicketFollowups()) })
  } catch (error) {
    console.error("[support-ticket-followups]", error)
    return NextResponse.json({ error: "Support follow-up job failed" }, { status: 503 })
  }
}
