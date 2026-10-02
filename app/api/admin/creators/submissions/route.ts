import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/* Submission review queue — all challenges or filtered. */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("creator.submission.review")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ submissions: [] })

  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const challengeId = url.searchParams.get("challengeId")

  let q = supabase
    .from("creator_submissions")
    .select("*, creators(full_name, creator_id), creator_challenges(name, slug)")
    .order("submitted_at", { ascending: false })
    .limit(300)
  if (status) q = q.eq("status", status)
  if (challengeId) q = q.eq("challenge_id", challengeId)

  const { data } = await q
  const subs = data ?? []
  if (subs.length === 0) return NextResponse.json({ submissions: [] })

  const ids = subs.map((s) => s.id as string)
  const { data: flags } = await supabase
    .from("creator_flags").select("submission_id")
    .in("submission_id", ids).in("status", ["OPEN", "UNDER_REVIEW"])
  const flagCount = new Map<string, number>()
  for (const f of flags ?? []) {
    flagCount.set(f.submission_id as string, (flagCount.get(f.submission_id as string) ?? 0) + 1)
  }

  const { data: metrics } = await supabase
    .from("creator_submission_metrics").select("*").in("submission_id", ids)
    .order("captured_at", { ascending: false })
  const latest = new Map<string, Record<string, unknown>>()
  for (const m of metrics ?? []) {
    if (!latest.has(m.submission_id as string)) latest.set(m.submission_id as string, m)
  }

  return NextResponse.json({
    submissions: subs.map((s) => {
      const m = latest.get(s.id as string)
      return {
        id: s.id,
        challengeId: s.challenge_id,
        challengeName: (s.creator_challenges as { name?: string } | null)?.name ?? "—",
        creatorId: s.creator_id,
        creatorName: (s.creators as { full_name?: string } | null)?.full_name ?? "Unknown",
        creatorCode: (s.creators as { creator_id?: string } | null)?.creator_id ?? "",
        platform: s.platform,
        contentUrl: s.content_url,
        trackingToken: s.tracking_token,
        caption: s.caption,
        status: s.status,
        quarantined: s.quarantined,
        publishedAt: s.published_at,
        submittedAt: s.submitted_at,
        reviewFeedback: s.review_feedback,
        openFlags: flagCount.get(s.id as string) ?? 0,
        metrics: m ? { views: m.views, source: m.source, verified: m.verified } : null,
      }
    }),
  })
}
