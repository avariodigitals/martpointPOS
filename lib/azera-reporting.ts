export interface ReportFilters {
  from: string
  to: string
  type: string | null
  direction: string | null
  status: string | null
  search: string
  page: number
  pageSize: number
}
export function callReportFilters(params: URLSearchParams): ReportFilters {
  const date = (value: string | null, fallback: Date, end = false) => {
    if (!value) return fallback.toISOString()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new Error("Use valid From and To dates.")
    const parsed = new Date(`${value}T00:00:00+01:00`)
    if (
      !Number.isFinite(parsed.getTime()) ||
      new Date(parsed.getTime() + 3_600_000).toISOString().slice(0, 10) !==
        value
    )
      throw new Error("Use valid From and To dates.")
    return new Date(parsed.getTime() + (end ? 86_400_000 : 0)).toISOString()
  }
  const now = new Date()
  const from = date(
    params.get("from"),
    new Date(now.getTime() - 30 * 86_400_000)
  )
  const to = date(params.get("to"), now, true)
  if (Date.parse(from) >= Date.parse(to))
    throw new Error("From must not be after To.")
  const choice = (key: string, allowed: string[]) => {
    const value = params.get(key)
    if (!value || value === "all") return null
    if (!allowed.includes(value)) throw new Error(`Invalid ${key} filter.`)
    return value
  }
  return {
    from,
    to,
    type: choice("type", ["webrtc", "sip"]),
    direction: choice("direction", ["inbound", "outbound"]),
    status: choice("status", [
      "ringing",
      "active",
      "ended",
      "missed",
      "failed",
      "busy",
    ]),
    search: (params.get("search") || "")
      .replace(/[^\p{L}\p{N}\s+@.-]/gu, "")
      .slice(0, 100),
    page: Math.max(1, Math.floor(Number(params.get("page")) || 1)),
    pageSize: 25,
  }
}
export function csvCell(value: unknown) {
  const text = String(value ?? "")
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`
}
