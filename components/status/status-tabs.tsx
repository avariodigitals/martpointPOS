"use client"

import { useState } from "react"
import { Activity, ChevronLeft, ChevronRight, History } from "lucide-react"
import { COMPONENT_STATUS_META, INCIDENT_STATUS_LABELS } from "@/lib/status-shared"
import type {
  ComponentStatus,
  IncidentStatus,
  PublicComponent,
  StatusIncident,
  StatusPageData,
} from "@/lib/status-shared"

const TIMEZONE = "Africa/Lagos"

const STATUS_COLORS: Record<ComponentStatus, { dot: string; text: string; bar: string }> = {
  operational: { dot: "bg-green-500", text: "text-green-700", bar: "bg-green-500" },
  degraded_performance: { dot: "bg-amber-400", text: "text-amber-600", bar: "bg-amber-400" },
  partial_outage: { dot: "bg-orange-500", text: "text-orange-600", bar: "bg-orange-500" },
  major_outage: { dot: "bg-red-600", text: "text-red-700", bar: "bg-red-600" },
  under_maintenance: { dot: "bg-blue-500", text: "text-blue-600", bar: "bg-blue-400" },
}

const UPDATE_STATUS_COLORS: Record<string, string> = {
  investigating: "text-red-600",
  identified: "text-orange-600",
  monitoring: "text-blue-600",
  verifying: "text-blue-600",
  resolved: "text-green-600",
  scheduled: "text-muted-foreground",
  in_progress: "text-blue-600",
  completed: "text-green-600",
}

function fmtDateTime(iso: string): string {
  try {
    return (
      new Date(iso).toLocaleString("en-US", {
        timeZone: TIMEZONE,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }) + " WAT"
    )
  } catch {
    return iso
  }
}

function fmtWindow(startIso: string | null, endIso: string | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }
  try {
    if (!startIso) {
      if (!endIso) return ""
      return `Until ${new Date(endIso).toLocaleString("en-US", opts)} WAT`
    }
    const start = new Date(startIso).toLocaleString("en-US", opts)
    if (!endIso) return `${start} WAT`
    const sameDay =
      new Date(startIso).toLocaleDateString("en-CA", { timeZone: TIMEZONE }) ===
      new Date(endIso).toLocaleDateString("en-CA", { timeZone: TIMEZONE })
    const end = sameDay
      ? new Date(endIso).toLocaleTimeString("en-US", {
          timeZone: TIMEZONE,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : new Date(endIso).toLocaleString("en-US", opts)
    return `${start} – ${end} WAT`
  } catch {
    return ""
  }
}

function UptimeBar({ component }: { component: PublicComponent }) {
  return (
    <div>
      <div className="flex gap-px h-8" role="img" aria-label={`90-day uptime history for ${component.name}`}>
        {component.days.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${COMPONENT_STATUS_META[d.status].label}`}
            className={`flex-1 rounded-[2px] ${STATUS_COLORS[d.status].bar} ${
              d.status === "operational" ? "opacity-90 hover:opacity-100" : ""
            }`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>90 days ago</span>
        <span className="font-medium text-foreground">{component.uptimePct}% uptime</span>
        <span>Today</span>
      </div>
    </div>
  )
}

function IncidentCard({ incident }: { incident: StatusIncident }) {
  return (
    <div className="border-t border-border py-4 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-semibold text-foreground">{incident.title}</h3>
        {incident.kind === "maintenance" && (
          <span className="shrink-0 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
            Maintenance
          </span>
        )}
      </div>
      {incident.kind === "maintenance" && (incident.scheduledFor || incident.scheduledUntil) && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {fmtWindow(incident.scheduledFor, incident.scheduledUntil)}
        </p>
      )}
      <div className="mt-3 space-y-3">
        {incident.updates.map((u) => (
          <div key={u.id}>
            <p className={`text-sm font-semibold ${UPDATE_STATUS_COLORS[u.status] || "text-foreground"}`}>
              {INCIDENT_STATUS_LABELS[u.status as IncidentStatus] || u.status}
              <span className="ml-2 font-normal text-muted-foreground">{u.body}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(u.createdAt)}</p>
          </div>
        ))}
        {incident.updates.length === 0 && (
          <p className="text-xs text-muted-foreground">Posted {fmtDateTime(incident.createdAt)}</p>
        )}
      </div>
    </div>
  )
}

function IncidentSection({ title, incidents }: { title: string; incidents: StatusIncident[] }) {
  return (
    <section className="w-full bg-background">
      <div className="container-martpoint py-10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-lg font-bold text-foreground mb-4">{title}</h2>
          <div className="rounded-xl border border-border p-5">
            {incidents.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const TABS = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "incidents", label: "Incidents", icon: History },
] as const

type TabKey = (typeof TABS)[number]["key"]

export function StatusTabs({ data }: { data: StatusPageData }) {
  const [tab, setTab] = useState<TabKey>("overview")
  // Months arrive newest-first; index 0 is the most recent month.
  const [monthIdx, setMonthIdx] = useState(0)
  const month = data.months[Math.min(monthIdx, data.months.length - 1)]

  const groups = new Map<string, PublicComponent[]>()
  for (const c of data.components.filter((c) => c.showcase)) {
    const key = c.groupName || ""
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }

  return (
    <>
      {data.activeIncidents.length > 0 && (
        <IncidentSection title="Active Incidents" incidents={data.activeIncidents} />
      )}
      {data.maintenance.length > 0 && (
        <IncidentSection title="Scheduled Maintenance" incidents={data.maintenance} />
      )}

      <section className="w-full bg-background">
        <div className="container-martpoint py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            {/* Tab bar */}
            <div role="tablist" aria-label="Status sections" className="inline-flex gap-1 rounded-lg border border-border bg-muted/40 p-1 mb-8">
              {TABS.map((t) => {
                const Icon = t.icon
                const active = tab === t.key
                return (
                  <button
                    key={t.key}
                    role="tab"
                    id={`status-tab-${t.key}`}
                    aria-selected={active}
                    aria-controls={`status-panel-${t.key}`}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      active
                        ? "bg-background text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                )
              })}
            </div>

            <div
              role="tabpanel"
              id="status-panel-overview"
              aria-labelledby="status-tab-overview"
              hidden={tab !== "overview"}
            >
                <p className="text-sm text-muted-foreground mb-6">
                  Uptime over the past 90 days.
                </p>

                {[...groups.entries()].map(([group, components]) => (
                  <div key={group || "default"} className="mb-8 last:mb-0">
                    {group && (
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                        {group}
                      </h3>
                    )}
                    <div className="rounded-xl border border-border divide-y divide-border">
                      {components.map((c) => (
                        <div key={c.id} className="p-5">
                          <div className="flex items-center justify-between gap-4 mb-4">
                            <div>
                              <p className="font-medium text-foreground">{c.name}</p>
                              {c.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                              )}
                            </div>
                            <span
                              className={`inline-flex items-center gap-1.5 text-sm font-medium ${STATUS_COLORS[c.effectiveStatus].text}`}
                            >
                              <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[c.effectiveStatus].dot}`} />
                              {COMPONENT_STATUS_META[c.effectiveStatus].label}
                            </span>
                          </div>
                          <UptimeBar component={c} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {data.components.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Status information is being set up. Check back soon.
                  </p>
                )}
              </div>

            <div
              role="tabpanel"
              id="status-panel-incidents"
              aria-labelledby="status-tab-incidents"
              hidden={tab !== "incidents"}
            >
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <h2 className="text-lg font-bold text-foreground">Incident History</h2>
                  {month && (
                    <div className="flex items-center gap-1.5">
                      <button
                        aria-label="Older month"
                        disabled={monthIdx >= data.months.length - 1}
                        onClick={() => setMonthIdx((i) => i + 1)}
                        className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <select
                        aria-label="Select month"
                        value={month.key}
                        onChange={(e) => {
                          const i = data.months.findIndex((m) => m.key === e.target.value)
                          if (i >= 0) setMonthIdx(i)
                        }}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground"
                      >
                        {data.months.map((m) => (
                          <option key={m.key} value={m.key}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <button
                        aria-label="Newer month"
                        disabled={monthIdx <= 0}
                        onClick={() => setMonthIdx((i) => i - 1)}
                        className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {!month || month.days.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No incidents reported{month ? ` in ${month.label}` : ""}.
                  </p>
                ) : (
                  <div className="space-y-8">
                    {month.days.map((day) => (
                      <div key={day.date}>
                        <h3 className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border">
                          {day.label}
                        </h3>
                        <div className="rounded-xl border border-border bg-background p-5">
                          {day.incidents.map((inc) => (
                            <IncidentCard key={inc.id} incident={inc} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Status legend — always visible regardless of active tab */}
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {(Object.keys(STATUS_COLORS) as ComponentStatus[]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_COLORS[s].bar}`} />
                  {COMPONENT_STATUS_META[s].label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
