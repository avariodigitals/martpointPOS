import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { isSupabaseConfigured } from "@/lib/supabase"
import { generateSlots } from "@/lib/scheduling"
import { getSchedulingSettings, getBusyForRange } from "@/lib/meeting-booking"

export const dynamic = "force-dynamic"

/* ─── GET open demo slots (public, for /book-demo) ─── */
export async function GET(request: Request) {
  const limit = await checkRateLimit(request, { key: "demo-slots", max: 60, windowSeconds: 3600 })
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Booking is temporarily unavailable" }, { status: 503 })
  }

  const settings = await getSchedulingSettings()
  const now = new Date()
  const to = new Date(now.getTime() + settings.maxDaysAhead * 86_400_000)
  const busy = await getBusyForRange(now, to)
  const slots = generateSlots({ settings, from: now, to, busy, now }).map((d) => d.toISOString())

  return NextResponse.json({
    slots,
    timezone: settings.timezone,
    durationMinutes: settings.slotMinutes,
  })
}
