export const revalidate = 60

import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { StatusSubscribeForm } from "@/components/status/subscribe-form"
import { getStatusPageData, COMPONENT_STATUS_META, INCIDENT_STATUS_LABELS } from "@/lib/status-page"
import type { ComponentStatus, IncidentStatus, PublicComponent, StatusIncident } from "@/lib/status-page"
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wrench,
  Activity,
} from "lucide-react"

export const metadata: Metadata = {
  title: "System Status — MartPoint by Avario Digitals",
  description:
    "Real-time status and uptime history for MartPoint services — POS, payments, APIs, sync, and dashboards. Subscribe for incident and maintenance updates.",
  alternates: { canonical: "/status" },
  openGraph: {
    title: "MartPoint System Status",
    description: "Live operational status, uptime history, and incident reports for MartPoint services.",
    url: "https://martpoint.com.ng/status",
  },
}

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

function OverallBanner({ overall }: { overall: string }) {
  const config: Record<string, { label: string; classes: string; icon: React.ElementType }> = {
    operational: {
      label: "All Systems Operational",
      classes: "bg-green-600 text-white",
      icon: CheckCircle2,
    },
    degraded: {
      label: "Degraded Performance",
      classes: "bg-amber-400 text-amber-950",
      icon: AlertTriangle,
    },
    partial: {
      label: "Partial System Outage",
      classes: "bg-orange-500 text-white",
      icon: AlertTriangle,
    },
    major: {
      label: "Major System Outage",
      classes: "bg-red-600 text-white",
      icon: AlertOctagon,
    },
    maintenance: {
      label: "Scheduled Maintenance In Progress",
      classes: "bg-blue-600 text-white",
      icon: Wrench,
    },
  }
  const c = config[overall] || config.operational
  const Icon = c.icon
  return (
    <div className={`rounded-xl px-6 py-5 flex items-center justify-center gap-3 ${c.classes}`}>
      <Icon className="w-6 h-6" />
      <h2 className="text-xl md:text-2xl font-bold">{c.label}</h2>
    </div>
  )
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

export default async function StatusPage() {
  const data = await getStatusPageData()

  const groups = new Map<string, PublicComponent[]>()
  for (const c of data.components.filter((c) => c.showcase)) {
    const key = c.groupName || ""
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }

  return (
    <>
      <Header />
      <main>
        {/* Hero + overall banner */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-14 md:py-20">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                  System Status
                </span>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                  MartPoint Status
                </h1>
                <p className="mt-4 text-muted-foreground">
                  Live availability for every MartPoint service.{" "}
                  <span className="inline-flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" /> Refreshed continuously.
                  </span>
                </p>
              </div>

              <OverallBanner overall={data.overall} />

              <div className="mt-6 rounded-xl border border-border bg-muted/40 p-5">
                <p className="text-sm font-medium mb-3">
                  Get email notifications whenever we create, update, or resolve an incident.
                </p>
                <StatusSubscribeForm />
              </div>
            </div>
          </div>
        </section>

        {/* Components + uptime */}
        <section className="w-full bg-background">
          <div className="container-martpoint py-12 md:py-16">
            <div className="max-w-3xl mx-auto">
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

              {/* Legend */}
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
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

        {/* Active incidents */}
        {data.activeIncidents.length > 0 && (
          <section className="w-full bg-background border-t border-border">
            <div className="container-martpoint py-10">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-lg font-bold text-foreground mb-4">Active Incidents</h2>
                <div className="rounded-xl border border-border p-5">
                  {data.activeIncidents.map((inc) => (
                    <IncidentCard key={inc.id} incident={inc} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Scheduled maintenance */}
        {data.maintenance.length > 0 && (
          <section className="w-full bg-background border-t border-border">
            <div className="container-martpoint py-10">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-lg font-bold text-foreground mb-4">Scheduled Maintenance</h2>
                <div className="rounded-xl border border-border p-5">
                  {data.maintenance.map((inc) => (
                    <IncidentCard key={inc.id} incident={inc} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Past incidents */}
        <section className="w-full bg-muted/40 border-t border-border">
          <div className="container-martpoint py-12 md:py-16">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-lg font-bold text-foreground mb-6">Past Incidents</h2>
              <div className="space-y-8">
                {data.history.map((day) => (
                  <div key={day.date}>
                    <h3 className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border">
                      {day.label}
                    </h3>
                    {day.incidents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No incidents reported.</p>
                    ) : (
                      <div className="rounded-xl border border-border bg-background p-5">
                        {day.incidents.map((inc) => (
                          <IncidentCard key={inc.id} incident={inc} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
