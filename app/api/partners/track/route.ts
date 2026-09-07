import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { recordPartnerEvent, PARTNER_EVENT_TYPES, type PartnerEventType } from "@/lib/partners"

/* Public, anonymous engagement tracking for the partner directory.
 * Accepts { partnerId: "MP-NG-00001", event: "profile_view", meta?: {...} }.
 * Stores no personal data — see migration 027. */
export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "partner_track", max: 60, windowSeconds: 60 })
  if (!limit.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => null)
    const partnerId = typeof body?.partnerId === "string" ? body.partnerId : ""
    const event = body?.event as PartnerEventType
    const meta =
      body?.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? (body.meta as Record<string, unknown>)
        : undefined

    if (!PARTNER_EVENT_TYPES.includes(event)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    await recordPartnerEvent(partnerId, event, meta)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
