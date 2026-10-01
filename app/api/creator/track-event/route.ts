import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCreator } from "@/lib/creator-auth"
import { trackCreatorEvent } from "@/lib/creator-analytics"
import { CREATOR_ACTIVITY_EVENTS } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

const schema = z.object({
  eventType: z.enum(CREATOR_ACTIVITY_EVENTS),
  entityType: z.string().max(60).optional(),
  entityId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/** Generic creator activity tracking (KB opens, resource views, etc.). */
export async function POST(request: Request) {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied
  try {
    const body = schema.parse(await request.json())
    await trackCreatorEvent(
      creator.id,
      body.eventType,
      { type: body.entityType, id: body.entityId },
      body.metadata
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
