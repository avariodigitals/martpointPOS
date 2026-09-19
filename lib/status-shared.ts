/* ───────────────────────────  Status page shared types  ───────────────────────────
 * Client-safe: no server-only imports. Both the public page and the admin UI
 * import types/constants from here; data access lives in lib/status-page.ts.
 */

export type ComponentStatus =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "under_maintenance"

export type IncidentStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved"
  | "scheduled"
  | "in_progress"
  | "verifying"
  | "completed"

export type IncidentKind = "incident" | "maintenance"
export type IncidentImpact = "none" | "minor" | "major" | "critical" | "maintenance"

export interface StatusComponent {
  id: string
  name: string
  description: string
  groupName: string
  status: ComponentStatus
  sortOrder: number
  showcase: boolean
}

export interface StatusIncidentUpdate {
  id: string
  incidentId: string
  status: string
  body: string
  createdBy: string
  createdAt: string
}

export interface StatusIncident {
  id: string
  title: string
  kind: IncidentKind
  status: IncidentStatus
  impact: IncidentImpact
  componentIds: string[]
  scheduledFor: string | null
  scheduledUntil: string | null
  resolvedAt: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  updates: StatusIncidentUpdate[]
}

export interface PublicComponent extends StatusComponent {
  effectiveStatus: ComponentStatus
  /** Last 90 days, oldest first. */
  days: Array<{ date: string; status: ComponentStatus }>
  uptimePct: number
}

export type OverallStatus = "operational" | "degraded" | "partial" | "major" | "maintenance"

export interface StatusPageData {
  components: PublicComponent[]
  /** Unresolved incidents, newest first. */
  activeIncidents: StatusIncident[]
  /** Scheduled or in-progress maintenance, soonest first. */
  maintenance: StatusIncident[]
  /** Past days, today first. Each entry lists incidents that started that day. */
  history: Array<{ date: string; label: string; incidents: StatusIncident[] }>
  overall: OverallStatus
}

export const COMPONENT_STATUS_META: Record<ComponentStatus, { label: string; rank: number }> = {
  operational: { label: "Operational", rank: 0 },
  under_maintenance: { label: "Maintenance", rank: 1 },
  degraded_performance: { label: "Degraded Performance", rank: 2 },
  partial_outage: { label: "Partial Outage", rank: 3 },
  major_outage: { label: "Major Outage", rank: 4 },
}

export const INCIDENT_STATUSES: IncidentStatus[] = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "scheduled",
  "in_progress",
  "verifying",
  "completed",
]

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  scheduled: "Scheduled",
  in_progress: "In progress",
  verifying: "Verifying",
  completed: "Completed",
}

export const IMPACT_LABELS: Record<IncidentImpact, string> = {
  none: "None",
  minor: "Minor",
  major: "Major",
  critical: "Critical",
  maintenance: "Maintenance",
}

export const INCIDENT_ACTIVE_STATUSES: IncidentStatus[] = [
  "investigating",
  "identified",
  "monitoring",
  "verifying",
]

export const MAINTENANCE_ACTIVE_STATUSES: IncidentStatus[] = ["scheduled", "in_progress", "verifying"]
