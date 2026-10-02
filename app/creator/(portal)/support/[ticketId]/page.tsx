import { notFound } from "next/navigation"
import { requireCreatorSession } from "@/lib/creator-auth"
import { getCreatorTicket, listCreatorTicketMessages } from "@/lib/creator-support"
import { TicketThread } from "./thread"

export default async function CreatorTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { creator } = await requireCreatorSession()
  const { ticketId } = await params
  const ticket = await getCreatorTicket(creator.id, ticketId)
  if (!ticket) notFound()

  const messages = await listCreatorTicketMessages(ticket.id)

  return (
    <TicketThread
      ticket={{
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        created_at: ticket.created_at,
      }}
      messages={messages.map((m) => ({
        id: m.id,
        author_type: m.author_type,
        message: m.message,
        created_at: m.created_at,
      }))}
    />
  )
}
