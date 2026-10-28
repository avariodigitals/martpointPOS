export type FollowupTicket = {
  status: string
  satisfaction_sent_at?: string | null
  satisfaction_reminder_sent_at?: string | null
  satisfaction_response?: string | null
  auto_close_at?: string | null
}
const DAY = 86400000
export function supportFollowupAction(
  ticket: FollowupTicket,
  now = Date.now()
): "confirm" | "remind" | "close" | null {
  if (ticket.status !== "RESOLVED" || ticket.satisfaction_response) return null
  if (!ticket.satisfaction_sent_at) return "confirm"
  if (!ticket.satisfaction_reminder_sent_at)
    return now - Date.parse(ticket.satisfaction_sent_at) >= 3 * DAY ? "remind" : null
  if (
    ticket.auto_close_at &&
    Date.parse(ticket.auto_close_at) <= now &&
    now - Date.parse(ticket.satisfaction_reminder_sent_at) >= 2 * DAY
  )
    return "close"
  return null
}
