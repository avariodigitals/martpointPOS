/* ───────────────────────  Meeting scheduling rules  ───────────────────────
 * Pure helpers shared by the admin settings UI, the public booking page and
 * the API. Availability lives in settings.data.scheduling; slots are generated
 * in the business timezone and returned as UTC instants so the lead can view
 * them in whatever timezone their browser reports.
 *
 * No Node-only imports here — this module reaches client bundles.
 */

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
}

export interface AvailabilityWindow {
  /** "HH:MM" 24h, business timezone */
  start: string
  end: string
}

export interface SchedulingSettings {
  timezone: string
  slotMinutes: number
  bufferMinutes: number
  minNoticeHours: number
  maxDaysAhead: number
  weekly: Record<Weekday, AvailabilityWindow[]>
}

export interface BusyInterval {
  start: string | Date
  end: string | Date
}

export const DEFAULT_SCHEDULING: SchedulingSettings = {
  timezone: "Africa/Lagos",
  slotMinutes: 30,
  bufferMinutes: 15,
  minNoticeHours: 12,
  maxDaysAhead: 14,
  weekly: {
    mon: [{ start: "09:00", end: "17:00" }],
    tue: [{ start: "09:00", end: "17:00" }],
    wed: [{ start: "09:00", end: "17:00" }],
    thu: [{ start: "09:00", end: "17:00" }],
    fri: [{ start: "09:00", end: "17:00" }],
    sat: [],
    sun: [],
  },
}

const HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Coerce a raw settings blob into a well-formed SchedulingSettings. */
export function normalizeScheduling(raw: unknown): SchedulingSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const rawWeekly = (r.weekly && typeof r.weekly === "object" ? r.weekly : {}) as Record<string, unknown>
  const weekly = {} as Record<Weekday, AvailabilityWindow[]>
  for (const day of WEEKDAYS) {
    const windows = Array.isArray(rawWeekly[day]) ? (rawWeekly[day] as unknown[]) : DEFAULT_SCHEDULING.weekly[day]
    weekly[day] = windows
      .map((w) => {
        const win = (w || {}) as Record<string, unknown>
        return { start: String(win.start || ""), end: String(win.end || "") }
      })
      .filter((w) => HM_RE.test(w.start) && HM_RE.test(w.end) && w.start < w.end)
  }
  const tz = typeof r.timezone === "string" && isValidTimeZone(r.timezone) ? r.timezone : DEFAULT_SCHEDULING.timezone
  return {
    timezone: tz,
    slotMinutes: clampInt(r.slotMinutes, DEFAULT_SCHEDULING.slotMinutes, 10, 240),
    bufferMinutes: clampInt(r.bufferMinutes, DEFAULT_SCHEDULING.bufferMinutes, 0, 120),
    minNoticeHours: clampInt(r.minNoticeHours, DEFAULT_SCHEDULING.minNoticeHours, 0, 168),
    maxDaysAhead: clampInt(r.maxDaysAhead, DEFAULT_SCHEDULING.maxDaysAhead, 1, 60),
    weekly,
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/* ─── Timezone math (no external deps) ─── */

function tzParts(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const out: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) if (p.type !== "literal") out[p.type] = p.value
  return out
}

function tzOffsetMs(date: Date, tz: string): number {
  const p = tzParts(date, tz)
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUtc - date.getTime()
}

/** Interpret "YYYY-MM-DD" + "HH:MM" as wall-clock time in `tz`, return the UTC instant. */
export function zonedTimeToUtc(ymd: string, hm: string, tz: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  const [h, mi] = hm.split(":").map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  let utc = guess - tzOffsetMs(new Date(guess), tz)
  utc = guess - tzOffsetMs(new Date(utc), tz)
  return new Date(utc)
}

export function ymdInTz(date: Date, tz: string): string {
  const p = tzParts(date, tz)
  return `${p.year}-${p.month}-${p.day}`
}

export function weekdayInTz(date: Date, tz: string): Weekday {
  return tzParts(date, tz).weekday.toLowerCase().slice(0, 3) as Weekday
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

/* ─── Slot generation ─── */

export interface GenerateSlotsOptions {
  settings: SchedulingSettings
  /** Meeting length; defaults to settings.slotMinutes */
  durationMinutes?: number
  /** Window start (defaults to now) */
  from?: Date
  /** Window end (defaults to from + maxDaysAhead) */
  to?: Date
  busy?: BusyInterval[]
  now?: Date
}

/**
 * Generate open slot start times (UTC instants) inside the weekly availability
 * windows, skipping anything that starts before the minimum notice or overlaps
 * a busy interval (padded by the buffer).
 */
export function generateSlots(opts: GenerateSlotsOptions): Date[] {
  const { settings } = opts
  const now = opts.now ?? new Date()
  const duration = opts.durationMinutes && opts.durationMinutes > 0 ? opts.durationMinutes : settings.slotMinutes
  const from = opts.from ?? now
  const to = opts.to ?? new Date(from.getTime() + settings.maxDaysAhead * 86_400_000)
  const earliest = new Date(Math.max(from.getTime(), now.getTime() + settings.minNoticeHours * 3_600_000))
  const bufferMs = settings.bufferMinutes * 60_000
  const durMs = duration * 60_000
  const stepMs = settings.slotMinutes * 60_000

  const busy = (opts.busy || [])
    .map((b) => ({ start: new Date(b.start).getTime() - bufferMs, end: new Date(b.end).getTime() + bufferMs }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)

  const slots: Date[] = []
  const tz = settings.timezone
  let day = ymdInTz(from, tz)
  const lastDay = ymdInTz(to, tz)

  while (day <= lastDay) {
    const weekday = weekdayInTz(zonedTimeToUtc(day, "12:00", tz), tz)
    for (const win of settings.weekly[weekday] || []) {
      const winStart = zonedTimeToUtc(day, win.start, tz).getTime()
      const winEnd = zonedTimeToUtc(day, win.end, tz).getTime()
      for (let t = winStart; t + durMs <= winEnd; t += stepMs) {
        if (t < earliest.getTime() || t > to.getTime()) continue
        const end = t + durMs
        if (busy.some((b) => t < b.end && end > b.start)) continue
        slots.push(new Date(t))
      }
    }
    day = addDaysYmd(day, 1)
  }

  return slots
}

/** Filter admin-proposed slots down to the ones still bookable. */
export function filterProposedSlots(
  proposed: string[],
  opts: { durationMinutes: number; busy?: BusyInterval[]; bufferMinutes?: number; now?: Date },
): Date[] {
  const now = opts.now ?? new Date()
  const bufferMs = (opts.bufferMinutes ?? 0) * 60_000
  const durMs = opts.durationMinutes * 60_000
  const busy = (opts.busy || []).map((b) => ({
    start: new Date(b.start).getTime() - bufferMs,
    end: new Date(b.end).getTime() + bufferMs,
  }))
  return proposed
    .map((s) => new Date(s))
    .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > now.getTime())
    .filter((d) => !busy.some((b) => d.getTime() < b.end && d.getTime() + durMs > b.start))
    .sort((a, b) => a.getTime() - b.getTime())
}

/** Group ISO slot strings by calendar day in the viewer's timezone. */
export function groupSlotsByDay(slots: string[], tz: string): { day: string; label: string; slots: string[] }[] {
  const groups = new Map<string, string[]>()
  for (const iso of slots) {
    const key = ymdInTz(new Date(iso), tz)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(iso)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, list]) => ({
      day,
      label: new Date(list[0]).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }),
      slots: list,
    }))
}
