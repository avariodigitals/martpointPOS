import { redirect } from "next/navigation"

// Keep profile, notification and bookmarked links pointing at the exact ticket,
// but use the persistent inbox rather than remounting an entire detail route.
export default async function SupportTicketLink({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  redirect(`/admin/support?ticket=${encodeURIComponent(ticketId)}`)
}
