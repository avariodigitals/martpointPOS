import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCreator } from "@/lib/creator-auth"
import { listCreatorTickets, createCreatorTicket, CREATOR_TICKET_TOPICS } from "@/lib/creator-support"

export const dynamic = "force-dynamic"

const createSchema = z.object({
  topic: z.enum(CREATOR_TICKET_TOPICS),
  subject: z.string().trim().min(4).max(200),
  message: z.string().trim().min(10).max(5000),
})

export async function GET() {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied
  const tickets = await listCreatorTickets(creator.id)
  return NextResponse.json({ tickets })
}

export async function POST(request: Request) {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied

  try {
    const body = createSchema.parse(await request.json())
    const result = await createCreatorTicket({
      creatorId: creator.id,
      topic: body.topic,
      subject: body.subject,
      message: body.message,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ success: true, ticketId: result.ticket!.id, ticketNumber: result.ticket!.ticket_number })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 })
  }
}
