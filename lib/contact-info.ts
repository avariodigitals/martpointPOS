export const MARTPOINT_PHONE = "+2342017001229"

/** Upgrade legacy values for the direct-call phone only. WhatsApp stays separately configured. */
export function normalizeMartPointPhone(value: unknown): string {
  const phone = String(value || "").trim()
  const digits = phone.replace(/\D/g, "")
  if (digits === "2348037978230" || digits === "08037978230") return MARTPOINT_PHONE
  return phone || MARTPOINT_PHONE
}
