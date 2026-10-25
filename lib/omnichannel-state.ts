export interface InboxMessage {
  id: string
  author_type: "customer" | "agent" | "ai" | "system"
  author_id?: string | null
  message: string
  direction: "inbound" | "outbound"
  created_at: string
  message_type?: string
  attachment_url?: string | null
  attachment_name?: string | null
  attachment_mime?: string | null
  metadata?: Record<string, unknown>
  delivery_status?: string
  delivery_error?: string | null
}

export function messageDeliveryLabel(status?: string) {
  return ({ pending: "Sending…", accepted: "Provider accepted", sent: "Sent", delivered: "Delivered", read: "Read", failed: "Not sent", unknown: "Send result unknown", received: "Received", not_required: "Saved in conversation" } as Record<string, string>)[status || ""] || "Saved · delivery not tracked"
}

/** Preserve existing rows, pending sends and history during background sync. */
export function mergeInboxMessages(current: InboxMessage[], incoming: InboxMessage[]) {
  const rows = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) {
    const pendingId = message.metadata?.client_message_id
    if (message.author_type === "agent" && typeof pendingId === "string" && pendingId.startsWith("optimistic-")) rows.delete(pendingId)
    const old = rows.get(message.id)
    rows.set(message.id, old && JSON.stringify(old) === JSON.stringify(message) ? old : message)
  }
  const next = [...rows.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  return next.length === current.length && next.every((item, index) => item === current[index]) ? current : next
}
