import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ACRONYMS = new Set(["url", "id", "cta", "faq", "pdf", "sla", "api", "erp", "pos", "utm", "mp4"])

/** UPPER_SNAKE enum → plain-English label for UI ("IN_PROGRESS" → "In progress"). */
export function enumLabel(value: string | null | undefined): string {
  if (!value) return "—"
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
}

/** Support-ticket status as seen by internal staff. */
export const TICKET_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  WAITING_CUSTOMER: "Waiting on customer",
  WAITING_PARTNER: "Waiting on partner",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
}

/** Same statuses phrased for the person who opened the ticket. */
export const TICKET_STATUS_LABELS_REQUESTER: Record<string, string> = {
  NEW: "Submitted",
  ASSIGNED: "Received — being assigned",
  IN_PROGRESS: "In progress",
  WAITING_CUSTOMER: "Waiting for your reply",
  WAITING_PARTNER: "With our team",
  ESCALATED: "Escalated to senior team",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
}

export function ticketStatusLabel(status: string, forRequester = false): string {
  const map = forRequester ? TICKET_STATUS_LABELS_REQUESTER : TICKET_STATUS_LABELS
  return map[status] || enumLabel(status)
}
