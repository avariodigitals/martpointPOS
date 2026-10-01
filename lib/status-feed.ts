import {
  INCIDENT_ACTIVE_STATUSES,
  MAINTENANCE_ACTIVE_STATUSES,
} from "./status-shared"
import type { StatusIncident } from "./status-shared"

/**
 * Contract for the public GET /api/status feed consumed by every installed
 * MartPoint POS instance (Updater::syncStatusFeed polls it ~every 15 min and
 * mirrors `incident` into the local banner). This is the ONLY remote trigger
 * for the fleet-wide banner — it reflects real incidents managed in
 * admin → Status (status_incidents table).
 *
 * severity ∈ investigating | identified | monitoring | maintenance
 * active:0 is the all-clear — installs clear only backend-sourced banners.
 */

export const STATUS_PAGE_URL = "https://www.martpoint.com.ng/status"

// Mirror of lib/status-page's module-private incidentIsLive(): a maintenance
// window only counts while it is actually underway — future-scheduled or
// expired windows must not raise the banner.
export function isLive(incident: StatusIncident, now: Date): boolean {
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

const IMPACT_RANK: Record<string, number> = {
  none: 0,
  maintenance: 1,
  minor: 2,
  major: 3,
  critical: 4,
}

// Banner severities on the installs: investigating | identified | monitoring | maintenance
export function mapSeverity(incident: StatusIncident): string {
  if (incident.kind === "maintenance") return "maintenance"
  if (incident.status === "identified") return "identified"
  if (incident.status === "monitoring" || incident.status === "verifying") return "monitoring"
  return "investigating"
}

/** The single most relevant live incident — a real incident outranks a
 *  maintenance window, then highest impact, then newest. */
export function pickLive(incidents: StatusIncident[], now: Date): StatusIncident | null {
  const live = incidents.filter((i) => isLive(i, now))
  if (live.length === 0) return null
  return [...live].sort((a, b) => {
    if ((a.kind === "maintenance") !== (b.kind === "maintenance")) {
      return a.kind === "maintenance" ? 1 : -1
    }
    const rank = (IMPACT_RANK[b.impact] || 0) - (IMPACT_RANK[a.impact] || 0)
    if (rank !== 0) return rank
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })[0]
}

export function buildFeedPayload(incidents: StatusIncident[], now: Date) {
  const live = pickLive(incidents, now)
  return {
    status: "ok",
    generated_at: now.toISOString(),
    incident: live
      ? {
          active: 1,
          id: live.id,
          severity: mapSeverity(live),
          message: live.updates[0]?.body?.trim() || live.title,
          url: STATUS_PAGE_URL,
          started_at: live.scheduledFor || live.createdAt,
          status: live.status,
          impact: live.impact,
          updated_at: live.updatedAt,
        }
      : { active: 0 },
  }
}
