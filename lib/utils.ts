import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { PARTNER_ROLE_LABELS, type PartnerUserRole } from "./partner-permissions"

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

/** Display roles without exposing the codes used by permission checks. */
export function roleLabel(value: string | null | undefined): string {
  const role = value?.trim()
  if (!role) return "—"
  const code = role.toUpperCase().replace(/[\s-]+/g, "_")
  if (Object.hasOwn(PARTNER_ROLE_LABELS, code)) return PARTNER_ROLE_LABELS[code as PartnerUserRole]
  // New partner roles still need readable labels before a dedicated label is added.
  if (code.startsWith("PARTNER_")) return enumLabel(code.slice("PARTNER_".length))
  if (code === "HR_MANAGER") return "HR Manager"
  if (["CEO", "CTO", "CFO", "COO", "HR"].includes(code)) return code
  return /[_-]|^[A-Z\d\s]+$/.test(role) ? enumLabel(role.replace(/-/g, "_")) : role
}

/** Existing messages and audit records may contain a role code in prose. */
export function readableRoleText(value: string | null | undefined): string {
  return (value || "").replace(/\bPARTNER_[A-Z][A-Z_]*\b/gi, (role) => roleLabel(role))
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
