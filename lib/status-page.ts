import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, REPLY_TO } from "./email"
import {
  COMPONENT_STATUS_META,
  INCIDENT_STATUS_LABELS,
  INCIDENT_ACTIVE_STATUSES,
  MAINTENANCE_ACTIVE_STATUSES,
} from "./status-shared"
import type {
  ComponentStatus,
  IncidentStatus,
  IncidentKind,
  IncidentImpact,
  StatusComponent,
  StatusIncident,
  StatusIncidentUpdate,
  PublicComponent,
  StatusPageData,
} from "./status-shared"

export * from "./status-shared"

/* ───────────────────────────  Constants  ─────────────────────────── */

const IMPACT_TO_COMPONENT: Record<IncidentImpact, ComponentStatus | null> = {
  none: null,
  minor: "degraded_performance",
  major: "partial_outage",
  critical: "major_outage",
  maintenance: "under_maintenance",
}

const TIMEZONE = "Africa/Lagos"
const UPTIME_DAYS = 90
const HISTORY_DAYS = 14

/* ───────────────────────────  Row mappers  ─────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComponent(row: any): StatusComponent {
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    groupName: row.group_name || "",
    status: (row.status || "operational") as ComponentStatus,
    sortOrder: Number(row.sort_order) || 0,
    showcase: row.showcase !== false,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUpdate(row: any): StatusIncidentUpdate {
  return {
    id: row.id,
    incidentId: row.incident_id,
    status: row.status || "",
    body: row.body || "",
    createdBy: row.created_by || "",
    createdAt: row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIncident(row: any): StatusIncident {
  return {
    id: row.id,
    title: row.title || "",
    kind: (row.kind || "incident") as IncidentKind,
    status: (row.status || "investigating") as IncidentStatus,
    impact: (row.impact || "minor") as IncidentImpact,
    componentIds: Array.isArray(row.component_ids) ? row.component_ids : [],
    scheduledFor: row.scheduled_for || null,
    scheduledUntil: row.scheduled_until || null,
    resolvedAt: row.resolved_at || null,
    createdBy: row.created_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updates: [],
  }
}

/* ───────────────────────────  Queries  ─────────────────────────── */

export async function listComponents(): Promise<StatusComponent[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("status_components")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error || !data) return []
  return data.map(mapComponent)
}

export async function listIncidents(): Promise<StatusIncident[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("status_incidents")
    .select("*")
    .order("created_at", { ascending: false })
  if (error || !data) return []

  const ids = data.map((r) => r.id)
  const updatesByIncident: Record<string, StatusIncidentUpdate[]> = {}
  if (ids.length > 0) {
    const { data: updates } = await supabase
      .from("status_incident_updates")
      .select("*")
      .in("incident_id", ids)
      .order("created_at", { ascending: false })
    for (const u of updates || []) {
      const mapped = mapUpdate(u)
      ;(updatesByIncident[mapped.incidentId] ||= []).push(mapped)
    }
  }

  return data.map((row) => ({ ...mapIncident(row), updates: updatesByIncident[row.id] || [] }))
}

export async function listSubscribers(): Promise<Array<{ email: string; token: string; createdAt: string }>> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("status_subscribers")
    .select("email, token, created_at")
    .is("unsubscribed_at", null)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return data.map((r) => ({ email: r.email, token: r.token, createdAt: r.created_at }))
}

/* ───────────────────────────  Uptime math  ─────────────────────────── */

function dayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE })
}

/** Inclusive day keys covered by an incident's active window. */
function incidentDayKeys(incident: StatusIncident, now: Date): Set<string> {
  const startIso = incident.scheduledFor || incident.createdAt
  const endIso = incident.resolvedAt || incident.scheduledUntil || now.toISOString()
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (isNaN(start.getTime())) return new Set()
  const keys = new Set<string>()
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  let guard = 0
  while (cursor <= endDay && guard++ < 400) {
    keys.add(dayKey(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return keys
}

function worst(a: ComponentStatus, b: ComponentStatus): ComponentStatus {
  return COMPONENT_STATUS_META[b].rank > COMPONENT_STATUS_META[a].rank ? b : a
}

/** Whether an incident currently contributes to a component's displayed status. */
function incidentIsLive(incident: StatusIncident, now: Date): boolean {
  if (incident.kind === "maintenance") {
    if (!MAINTENANCE_ACTIVE_STATUSES.includes(incident.status)) return false
    const start = new Date(incident.scheduledFor || incident.createdAt)
    const end = incident.scheduledUntil ? new Date(incident.scheduledUntil) : null
    if (incident.status === "scheduled" && start > now) return false
    if (end && end < now) return false
    return true
  }
  return INCIDENT_ACTIVE_STATUSES.includes(incident.status)
}

export async function getStatusPageData(): Promise<StatusPageData> {
  const [components, incidents] = await Promise.all([listComponents(), listIncidents()])
  const now = new Date()

  const days: string[] = []
  for (let i = UPTIME_DAYS - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(dayKey(d))
  }

  const publicComponents: PublicComponent[] = components.map((c) => {
    const perDay: Record<string, ComponentStatus> = {}
    for (const incident of incidents) {
      if (!incident.componentIds.includes(c.id)) continue
      const mapped = IMPACT_TO_COMPONENT[incident.impact]
      if (!mapped) continue
      for (const key of incidentDayKeys(incident, now)) {
        perDay[key] = perDay[key] ? worst(perDay[key], mapped) : mapped
      }
    }

    let effective: ComponentStatus = c.status
    for (const incident of incidents) {
      if (!incident.componentIds.includes(c.id) || !incidentIsLive(incident, now)) continue
      const mapped = IMPACT_TO_COMPONENT[incident.impact]
      if (mapped) effective = worst(effective, mapped)
    }

    let upDays = 0
    const dayList = days.map((date) => {
      const status = perDay[date] || "operational"
      if (status !== "partial_outage" && status !== "major_outage") upDays++
      return { date, status }
    })

    return {
      ...c,
      effectiveStatus: effective,
      days: dayList,
      uptimePct: Math.round((upDays / UPTIME_DAYS) * 1000) / 10,
    }
  })

  const activeIncidents = incidents.filter(
    (i) => i.kind === "incident" && INCIDENT_ACTIVE_STATUSES.includes(i.status)
  )
  const maintenance = incidents
    .filter((i) => i.kind === "maintenance" && MAINTENANCE_ACTIVE_STATUSES.includes(i.status))
    .sort(
      (a, b) =>
        new Date(a.scheduledFor || a.createdAt).getTime() -
        new Date(b.scheduledFor || b.createdAt).getTime()
    )

  const history: StatusPageData["history"] = []
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = dayKey(d)
    const dayIncidents = incidents.filter(
      (inc) => dayKey(new Date(inc.scheduledFor || inc.createdAt)) === key
    )
    history.push({
      date: key,
      label: d.toLocaleDateString("en-US", {
        timeZone: TIMEZONE,
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      incidents: dayIncidents,
    })
  }

  let overall: StatusPageData["overall"] = "operational"
  for (const c of publicComponents) {
    if (c.effectiveStatus === "major_outage") overall = "major"
    else if (c.effectiveStatus === "partial_outage" && overall !== "major") overall = "partial"
    else if (c.effectiveStatus === "degraded_performance" && !["major", "partial"].includes(overall))
      overall = "degraded"
    else if (c.effectiveStatus === "under_maintenance" && overall === "operational")
      overall = "maintenance"
  }

  return { components: publicComponents, activeIncidents, maintenance, history, overall }
}

/* ───────────────────────────  Subscriber notifications  ─────────────────────────── */

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "https://www.martpoint.com.ng").replace(/\/$/, "")
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Email all active subscribers about an incident create/update.
 * Failures are logged via sendEmail's email_logs integration and never throw.
 */
export async function notifyStatusSubscribers(incident: StatusIncident, update: StatusIncidentUpdate) {
  if (!isSupabaseConfigured()) return
  const subscribers = await listSubscribers()
  if (subscribers.length === 0) return

  const base = baseUrl()
  const statusLabel =
    INCIDENT_STATUS_LABELS[update.status as IncidentStatus] || update.status || "Update"
  const subject = `[${statusLabel}] ${incident.title} — MartPoint Status`
  const text = `${incident.title}\n\n${statusLabel} — ${update.body}\n\nView the status page: ${base}/status`

  await Promise.allSettled(
    subscribers.map((sub) => {
      const unsubUrl = `${base}/status/unsubscribe?t=${encodeURIComponent(sub.token)}`
      const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="margin:0 0 4px">${escapeHtml(incident.title)}</h2>
  <p style="margin:0 0 12px;color:#6b7280;font-size:13px">${escapeHtml(statusLabel)}</p>
  <p style="white-space:pre-wrap;line-height:1.5">${escapeHtml(update.body)}</p>
  <p><a href="${base}/status" style="color:#0047CC">View status page</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px" />
  <p style="font-size:12px;color:#6b7280">
    You are receiving this because you subscribed to MartPoint status updates.
    <a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline">Unsubscribe</a>
  </p>
</div>`
      return sendEmail({
        to: sub.email,
        subject,
        text,
        html,
        replyTo: REPLY_TO.noreply,
        headers: { "List-Unsubscribe": `<${unsubUrl}>` },
      })
    })
  )
}
