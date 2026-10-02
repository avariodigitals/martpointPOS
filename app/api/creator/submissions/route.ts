import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCreator } from "@/lib/creator-auth"
import { supabase } from "@/lib/supabase"
import { recordAudit, auditContextFromCreatorSession, AUDIT_ACTIONS } from "@/lib/audit"
import { getChallenge, createSubmission, SUBMISSION_PLATFORMS } from "@/lib/creator-challenges"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function GET() {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied
  const { data } = await supabase
    .from("creator_submissions")
    .select("id, challenge_id, platform, content_url, tracking_token, status, caption, published_at, submitted_at, review_feedback, creator_challenges(name)")
    .eq("creator_id", creator.id)
    .order("submitted_at", { ascending: false })
    .limit(100)
  return NextResponse.json({ submissions: data ?? [] })
}

const schema = z.object({
  challengeId: z.string().uuid(),
  platform: z.enum(SUBMISSION_PLATFORMS),
  contentUrl: z.string().trim().min(8).max(1000),
  caption: z.string().max(2000).nullish(),
  publishedAt: z.string().nullish(),
  screenshotPath: z.string().max(500).nullish(),
  analyticsEvidencePath: z.string().max(500).nullish(),
  notes: z.string().max(2000).nullish(),
})

export async function POST(request: Request) {
  const { session, creator, denied } = await authorizeCreator()
  if (denied) return denied

  const limit = await checkRateLimit(request, { key: `creator-submit:${creator.id}`, max: 20, windowSeconds: 3600 })
  if (!limit.allowed) return NextResponse.json({ error: "Too many submissions — try again later." }, { status: 429 })

  try {
    const body = schema.parse(await request.json())
    const challenge = await getChallenge(body.challengeId)
    if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 })

    // Evidence paths must be ones this creator uploaded (scope check).
    for (const p of [body.screenshotPath, body.analyticsEvidencePath]) {
      if (p && !p.startsWith(`submissions/${creator.id}/`)) {
        return NextResponse.json({ error: "Invalid evidence file." }, { status: 400 })
      }
    }

    const result = await createSubmission(creator, challenge, {
      platform: body.platform,
      contentUrl: body.contentUrl,
      caption: body.caption,
      publishedAt: body.publishedAt,
      screenshotPath: body.screenshotPath,
      analyticsEvidencePath: body.analyticsEvidencePath,
      notes: body.notes,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    await recordAudit(auditContextFromCreatorSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_SUBMISSION_RECEIVED,
      entityType: "creator_submission", entityId: result.submission!.id,
      metadata: { challengeId: challenge.id, platform: body.platform },
    })
    return NextResponse.json({ success: true, submission: result.submission })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    return NextResponse.json({ error: "Submission failed" }, { status: 500 })
  }
}
