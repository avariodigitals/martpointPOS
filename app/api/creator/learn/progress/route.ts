import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCreator } from "@/lib/creator-auth"
import {
  markLessonStarted,
  markLessonCompleted,
  updateVideoProgress,
  getLearningById,
} from "@/lib/creator-learning"

export const dynamic = "force-dynamic"

const schema = z.object({
  contentId: z.string().uuid(),
  action: z.enum(["start", "complete", "video-progress"]),
  videoPct: z.number().min(0).max(100).optional(),
})

export async function POST(request: Request) {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied

  try {
    const body = schema.parse(await request.json())
    const content = await getLearningById(body.contentId)
    if (!content || content.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    if (body.action === "start") {
      await markLessonStarted(creator.id, body.contentId)
    } else if (body.action === "video-progress") {
      await updateVideoProgress(creator.id, body.contentId, body.videoPct ?? 0)
    } else {
      // Manual completion — not allowed for videos (watch-through required)
      // or assessments (graded server-side).
      if (content.type === "VIDEO") {
        return NextResponse.json(
          { error: "Videos complete automatically when watched." },
          { status: 400 }
        )
      }
      if (content.type === "ASSESSMENT") {
        return NextResponse.json(
          { error: "Assessments complete via submission." },
          { status: 400 }
        )
      }
      await markLessonCompleted(creator.id, body.contentId)
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 })
  }
}
