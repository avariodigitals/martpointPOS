import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, REPLY_TO } from "./email"
import { getPublicSiteSettings } from "./settings"
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

export async function listBusinessEmails(): Promise<string[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("businesses")
    .select("primary_email")
    .not("primary_email", "is", null)
  if (error || !data) return []
  return [...new Set(
    data
      .map((r) => String(r.primary_email || "").trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
  )]
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

const UPDATE_BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  investigating: { bg: "#DC2626", fg: "#FFFFFF" },
  identified: { bg: "#EA580C", fg: "#FFFFFF" },
  monitoring: { bg: "#2563EB", fg: "#FFFFFF" },
  verifying: { bg: "#2563EB", fg: "#FFFFFF" },
  in_progress: { bg: "#2563EB", fg: "#FFFFFF" },
  scheduled: { bg: "#64748B", fg: "#FFFFFF" },
  resolved: { bg: "#16A34A", fg: "#FFFFFF" },
  completed: { bg: "#16A34A", fg: "#FFFFFF" },
}

function buildStatusEmailHtml(
  incident: StatusIncident,
  update: StatusIncidentUpdate,
  affectedNames: string[],
  unsubUrl: string,
  base: string,
  logoUrl: string
): string {
  const statusLabel =
    INCIDENT_STATUS_LABELS[update.status as IncidentStatus] || update.status || "Update"
  const badge = UPDATE_BADGE_COLORS[update.status] || { bg: "#64748B", fg: "#FFFFFF" }
  const when = new Date(update.createdAt).toLocaleString("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const affectedBlock =
    affectedNames.length > 0
      ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280">Affected: ${affectedNames.map(escapeHtml).join(", ")}</p>`
      : ""

  const windowBlock =
    incident.kind === "maintenance" && (incident.scheduledFor || incident.scheduledUntil)
      ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280">Window: ${
          incident.scheduledFor
            ? new Date(incident.scheduledFor).toLocaleString("en-US", { timeZone: TIMEZONE, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
            : "—"
        } → ${
          incident.scheduledUntil
            ? new Date(incident.scheduledUntil).toLocaleString("en-US", { timeZone: TIMEZONE, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
            : "—"
        } WAT</p>`
      : ""

  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(statusLabel)} — ${escapeHtml(incident.title)}${"&zwnj;&nbsp;".repeat(20)}</div>
<div style="margin:0;padding:0;background:#f4f5f7">
  <div style="max-width:620px;margin:0 auto;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="padding:18px 24px;border-bottom:1px solid #f1f5f9">
        <img src="${logoUrl}" alt="MartPoint" height="34" style="height:34px;display:block" />
      </div>
      <div style="padding:24px;font-size:15px;line-height:1.65;color:#1f2937">
        <p style="margin:0 0 4px">
          <span style="display:inline-block;background:${badge.bg};color:${badge.fg};font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:4px 10px;border-radius:999px">${escapeHtml(statusLabel)}</span>
          ${incident.kind === "maintenance" ? '<span style="display:inline-block;background:#EBF1FF;color:#0057FF;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-left:6px">Maintenance</span>' : ""}
        </p>
        <h2 style="margin:12px 0 4px;font-size:20px;line-height:1.3;color:#111827">${escapeHtml(incident.title)}</h2>
        <p style="margin:0 0 16px;font-size:13px;color:#6b7280">${when} WAT</p>
        ${affectedBlock}
        ${windowBlock}
        <p style="margin:0 0 20px;white-space:pre-wrap">${escapeHtml(update.body)}</p>
        <p style="margin:0 0 8px">
          <a href="${base}/status" style="display:inline-block;background:#0057FF;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px">View Status Page</a>
        </p>
      </div>
      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #f1f5f9;font-size:13px;color:#4b5563;line-height:1.6">
        Need more insight? Our team is here —
        <a href="${base}/support" style="color:#0057FF;text-decoration:none">visit support</a>,
        email <a href="mailto:support@martpoint.com.ng" style="color:#0057FF;text-decoration:none">support@martpoint.com.ng</a>,
        or chat on <a href="https://wa.me/2348036028069" style="color:#0057FF;text-decoration:none">WhatsApp</a>.
      </div>
    </div>
    <div style="margin-top:24px;font-size:12px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;text-align:center">
      You are receiving this email because you subscribed to MartPoint status updates.<br>
      <a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline">Unsubscribe</a> from these emails &middot; MartPoint &middot; martpoint.com.ng
    </div>
  </div>
</div>`
}

/**
 * Email status update to subscribers — optionally expanding the audience to
 * every business's primary email (upserted as subscribers so they can
 * unsubscribe). Failures are logged via sendEmail's email_logs and never throw.
 */
export async function notifyStatusSubscribers(
  incident: StatusIncident,
  update: StatusIncidentUpdate,
  opts: { subscribers?: boolean; businesses?: boolean } = {}
) {
  if (!isSupabaseConfigured()) return
  const includeSubscribers = opts.subscribers !== false
  const includeBusinesses = opts.businesses === true
  if (!includeSubscribers && !includeBusinesses) return

  let businessSet = new Set<string>()
  if (includeBusinesses) {
    const businessEmails = await listBusinessEmails()
    businessSet = new Set(businessEmails)
    if (businessEmails.length > 0) {
      // Add as subscribers (deduped) so they get unsubscribe tokens.
      // ignoreDuplicates preserves unsubscribed_at for anyone who opted out.
      await supabase
        .from("status_subscribers")
        .upsert(businessEmails.map((email) => ({ email })), {
          onConflict: "email",
          ignoreDuplicates: true,
        })
    }
  }

  const [subscribers, components, site] = await Promise.all([
    listSubscribers(),
    listComponents(),
    getPublicSiteSettings(),
  ])

  const recipients = subscribers.filter(
    (s) => includeSubscribers || businessSet.has(s.email)
  )
  if (recipients.length === 0) return

  const affectedNames = components
    .filter((c) => incident.componentIds.includes(c.id))
    .map((c) => c.name)

  const base = baseUrl()
  const logoUrl = /^https?:\/\//i.test(site.logo) ? site.logo : `${base}${site.logo}`
  const statusLabel =
    INCIDENT_STATUS_LABELS[update.status as IncidentStatus] || update.status || "Update"
  const subject = `[${statusLabel}] ${incident.title} — MartPoint Status`
  const text = `${incident.title}\n\n${statusLabel} — ${update.body}\n\n${
    affectedNames.length ? `Affected: ${affectedNames.join(", ")}\n\n` : ""
  }View the status page: ${base}/status\n\nNeed help? support@martpoint.com.ng`

  await Promise.allSettled(
    recipients.map((sub) => {
      const unsubUrl = `${base}/status/unsubscribe?t=${encodeURIComponent(sub.token)}`
      return sendEmail({
        to: sub.email,
        subject,
        text,
        html: buildStatusEmailHtml(incident, update, affectedNames, unsubUrl, base, logoUrl),
        replyTo: REPLY_TO.support,
        headers: { "List-Unsubscribe": `<${unsubUrl}>` },
      })
    })
  )
}
