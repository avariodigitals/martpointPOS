import { NextResponse } from "next/server"
import { authorizeCreator } from "@/lib/creator-auth"
import { getCreatorTicket, listCreatorTicketMessages } from "@/lib/creator-support"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied

  const { id } = await params
  const ticket = await getCreatorTicket(creator.id, id)
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

  const messages = await listCreatorTicketMessages(ticket.id)
  return NextResponse.json({ ticket, messages })
}
