import { NextResponse } from "next/server"
import { z } from "zod"
import { cookies } from "next/headers"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  CREATOR_REF_COOKIE,
  CREATOR_REF_PATTERN,
  encodeCreatorRef,
  resolveCreatorRef,
  recordCreatorReferral,
} from "@/lib/creator-attribution"

const schema = z.object({
  ref: z.string().max(20),
  utmSource: z.string().max(100).optional().nullable(),
  utmMedium: z.string().max(100).optional().nullable(),
  utmCampaign: z.string().max(100).optional().nullable(),
  utmContent: z.string().max(100).optional().nullable(),
  pagePath: z.string().max(300).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
})

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "creator-track", max: 30, windowSeconds: 60 })
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 })

  try {
    const body = schema.parse(await request.json())
    const code = body.ref.trim().toUpperCase()
    if (!CREATOR_REF_PATTERN.test(code)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const creator = await resolveCreatorRef(code)
    if (!creator) return NextResponse.json({ ok: false })

    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("cf-connecting-ip")

    const ref = {
      code: creator.referralCode,
      utmSource: body.utmSource ?? null,
      utmMedium: body.utmMedium ?? null,
      utmCampaign: body.utmCampaign ?? null,
      utmContent: body.utmContent ?? null,
    }

    // Persist attribution for 30 days (httpOnly — read server-side by lead/booking APIs).
    const store = await cookies()
    store.set(CREATOR_REF_COOKIE, encodeCreatorRef(ref), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    })

    void recordCreatorReferral({
      creatorId: creator.id,
      referralCode: creator.referralCode,
      eventType: "CLICK",
      utm: { source: ref.utmSource, medium: ref.utmMedium, campaign: ref.utmCampaign, content: ref.utmContent },
      pagePath: body.pagePath ?? null,
      referrer: body.referrer ?? null,
      ip,
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
