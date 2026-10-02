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
import { resolveSubmissionToken, raiseFlag } from "@/lib/creator-challenges"

const schema = z.object({
  ref: z.string().max(20),
  s: z.string().max(30).optional().nullable(),
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

    // Submission-level attribution: resolve the public token to the submission.
    // Only APPROVED submissions resolve — a token for a rejected/removed post
    // silently degrades to creator-level attribution.
    const submission = body.s ? await resolveSubmissionToken(body.s) : null

    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("cf-connecting-ip")

    const ref = {
      code: creator.referralCode,
      submissionToken: submission ? body.s!.toLowerCase() : null,
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

    // Dedupe: one CLICK per creator-or-submission per IP per hour.
    const hourBucket = Math.floor(Date.now() / 3600_000)
    void recordCreatorReferral({
      creatorId: creator.id,
      referralCode: creator.referralCode,
      eventType: "CLICK",
      challengeId: submission?.challengeId ?? null,
      submissionId: submission?.submissionId ?? null,
      utm: { source: ref.utmSource, medium: ref.utmMedium, campaign: ref.utmCampaign, content: ref.utmContent },
      pagePath: body.pagePath ?? null,
      referrer: body.referrer ?? null,
      ip,
      userAgent: request.headers.get("user-agent"),
      dedupeKey: `CLICK:${submission?.submissionId ?? creator.id}:${ip ?? "unknown"}:${hourBucket}`,
    })

    // Self-referral heuristic: a submission token used from an IP that also
    // clicked the SAME creator's link repeatedly in a burst → flag for review.
    if (submission && ip) {
      void flagSuspiciousSelfReferral(creator.id, submission.submissionId, submission.challengeId, ip)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}

async function flagSuspiciousSelfReferral(
  creatorId: string, submissionId: string, challengeId: string, ip: string,
): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("@/lib/supabase")
    if (!isSupabaseConfigured()) return
    // >10 clicks on the same submission link from one IP in an hour is anomalous.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await supabase
      .from("creator_referrals")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", submissionId)
      .eq("ip", ip)
      .gte("created_at", hourAgo)
    if ((count ?? 0) > 10) {
      await raiseFlag({
        creatorId, submissionId, challengeId,
        type: "CLICK_ANOMALY", severity: "MEDIUM",
        description: `Unusually high click volume on a single submission link from one IP (${count} in 1h).`,
        evidence: { ip, count },
      })
    }
  } catch { /* best-effort */ }
}
