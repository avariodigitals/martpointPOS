import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCreator } from "@/lib/creator-auth"
import { replyToCreatorTicket } from "@/lib/creator-support"

export const dynamic = "force-dynamic"

const replySchema = z.object({ message: z.string().trim().min(1).max(5000) })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied

  const { id } = await params
  try {
    const body = replySchema.parse(await request.json())
    const result = await replyToCreatorTicket(creator.id, id, body.message)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 })
  }
}
