import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { generateDraftFromAiReview } from "@/lib/creator-application-questions"

/** Build an unsent draft question round from the application's latest AI review. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("creator.application.review")
  if (auth.denied) return auth.denied
  const { id } = await params
  const draft = await generateDraftFromAiReview(id)
  if (!draft.ok) return NextResponse.json({ error: draft.error }, { status: 400 })
  return NextResponse.json(draft)
}
