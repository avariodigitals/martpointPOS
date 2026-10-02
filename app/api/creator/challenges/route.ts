import { NextResponse } from "next/server"
import { authorizeCreator } from "@/lib/creator-auth"
import { listChallengesForCreator } from "@/lib/creator-challenges"

export const dynamic = "force-dynamic"

export async function GET() {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied

  const cards = await listChallengesForCreator(creator)
  return NextResponse.json({
    challenges: cards.map((c) => ({
      id: c.challenge.id,
      slug: c.challenge.slug,
      name: c.challenge.name,
      description: c.challenge.description,
      theme: c.challenge.theme,
      status: c.challenge.status,
      startDate: c.challenge.start_date,
      submissionDeadline: c.challenge.submission_deadline,
      performanceCutoff: c.challenge.performance_cutoff,
      announcementDate: c.challenge.announcement_date,
      eligiblePlatforms: c.challenge.eligible_platforms,
      featured: c.challenge.featured,
      amended: c.challenge.rules_version > 1,
      joined: c.participant?.status === "JOINED",
      participantStatus: c.participant?.status ?? null,
      awardsCount: c.awardsCount,
      topPrizeLabel: c.topPrizeLabel,
      eligible: c.eligible,
      reasons: c.reasons,
    })),
  })
}
