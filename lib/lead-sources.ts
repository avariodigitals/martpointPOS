/** Canonical lead-source values used by the admin lead forms and intake paths. */
export const LEAD_SOURCE_OPTIONS = [
  { value: "manual", label: "Manual Entry" },
  { value: "website", label: "Website" },
  { value: "google-search", label: "Google Search" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "referral", label: "Referral" },
  { value: "social-media", label: "Social Media" },
  { value: "cold-call", label: "Cold Call" },
  { value: "email", label: "Email" },
  { value: "event", label: "Event" },
  { value: "leadsrite", label: "LeadsRite" },
  { value: "other", label: "Other" },
] as const

/** Keep the old stored value readable while migrating records to LeadsRite. */
export function normalizeLeadSource(source: string | null | undefined): string {
  return (source || "").trim().toLowerCase() === "explee" ? "leadsrite" : (source || "")
}

export function leadSourceLabel(source: string | null | undefined): string {
  const normalized = normalizeLeadSource(source)
  return LEAD_SOURCE_OPTIONS.find((option) => option.value === normalized)?.label
    || normalized.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
