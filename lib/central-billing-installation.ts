/** Normalize only harmless URL representation differences for installation identity. */
export function normalizeCentralInstallUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash) return null
    const path = url.pathname.replace(/\/+$/, "")
    return `${url.origin}${path}`
  } catch {
    return null
  }
}
