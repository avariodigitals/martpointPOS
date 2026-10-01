import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCreator } from "@/lib/creator-auth"
import { getLearningById } from "@/lib/creator-learning"
import {
  getAssessmentQuestions,
  listAttempts,
  submitAssessment,
} from "@/lib/creator-assessment"
import { trackCreatorEvent } from "@/lib/creator-analytics"

export const dynamic = "force-dynamic"

/** GET ?contentId= — questions without answers + attempt state. */
export async function GET(request: Request) {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied

  const contentId = new URL(request.url).searchParams.get("contentId")
  if (!contentId) return NextResponse.json({ error: "contentId required" }, { status: 400 })

  const content = await getLearningById(contentId)
  if (!content || content.status !== "PUBLISHED" || content.type !== "ASSESSMENT") {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
  }

  const [questions, attempts] = await Promise.all([
    getAssessmentQuestions(contentId),
    listAttempts(creator.id, contentId),
  ])
  const maxAttempts = content.assessmentConfig.maxAttempts ?? 3
  void trackCreatorEvent(creator.id, "ASSESSMENT_STARTED", { type: "assessment", id: contentId })

  return NextResponse.json({
    questions,
    attempts,
    passingScore: content.assessmentConfig.passingScore ?? 70,
    maxAttempts,
    attemptsLeft: Math.max(0, maxAttempts - attempts.length),
  })
}

const submitSchema = z.object({
  contentId: z.string().uuid(),
  answers: z.record(z.string(), z.array(z.string())),
})

export async function POST(request: Request) {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied

  try {
    const body = submitSchema.parse(await request.json())
    const content = await getLearningById(body.contentId)
    if (!content || content.status !== "PUBLISHED" || content.type !== "ASSESSMENT") {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }
    const result = await submitAssessment(
      creator.id,
      body.contentId,
      body.answers,
      content.assessmentConfig
    )
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Submission failed" }, { status: 500 })
  }
}
