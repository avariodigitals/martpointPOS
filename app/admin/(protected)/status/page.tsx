"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Plus,
  Trash2,
  ExternalLink,
  Activity,
  AlertTriangle,
  Wrench,
  Mail,
  CheckCircle2,
} from "lucide-react"
import type {
  StatusComponent,
  StatusIncident,
  IncidentStatus,
} from "@/lib/status-shared"
import { INCIDENT_STATUS_LABELS } from "@/lib/status-shared"

const COMPONENT_STATUSES = [
  "operational",
  "degraded_performance",
  "partial_outage",
  "major_outage",
  "under_maintenance",
] as const

const COMPONENT_STATUS_LABELS: Record<string, string> = {
  operational: "Operational",
  degraded_performance: "Degraded Performance",
  partial_outage: "Partial Outage",
  major_outage: "Major Outage",
  under_maintenance: "Maintenance",
}

const IMPACTS = ["none", "minor", "major", "critical", "maintenance"] as const

const INCIDENT_FLOW: IncidentStatus[] = ["investigating", "identified", "monitoring", "resolved"]
const MAINTENANCE_FLOW: IncidentStatus[] = ["scheduled", "in_progress", "verifying", "completed"]

const OPEN_INCIDENT_STATUSES = ["investigating", "identified", "monitoring", "verifying"]
const OPEN_MAINTENANCE_STATUSES = ["scheduled", "in_progress", "verifying"]

function fmt(iso: string | null | undefined) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function toIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

export default function AdminStatusPage() {
  const [components, setComponents] = useState<StatusComponent[]>([])
  const [incidents, setIncidents] = useState<StatusIncident[]>([])
  const [subscriberCount, setSubscriberCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  // New component form
  const [newComp, setNewComp] = useState({ name: "", groupName: "", description: "" })

  // New incident form
  const [form, setForm] = useState({
    kind: "incident" as "incident" | "maintenance",
    title: "",
    impact: "minor",
    status: "investigating" as IncidentStatus,
    componentIds: [] as string[],
    scheduledFor: "",
    scheduledUntil: "",
    message: "",
    notify: true,
  })

  // Per-incident update composer state
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, { status: IncidentStatus; body: string; notify: boolean }>>({})

  const load = useCallback(async () => {
    try {
      const [cRes, iRes] = await Promise.all([
        fetch("/api/admin/status/components"),
        fetch("/api/admin/status/incidents"),
      ])
      const cData = await cRes.json()
      const iData = await iRes.json()
      if (cData.components) setComponents(cData.components)
      if (iData.incidents) setIncidents(iData.incidents)
      setSubscriberCount(iData.subscriberCount || 0)
    } catch {
      setMessage("Failed to load status page data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch("/api/admin/status/components"),
      fetch("/api/admin/status/incidents"),
    ])
      .then(async ([cRes, iRes]) => {
        const cData = await cRes.json()
        const iData = await iRes.json()
        if (cancelled) return
        if (cData.components) setComponents(cData.components)
        if (iData.incidents) setIncidents(iData.incidents)
        setSubscriberCount(iData.subscriberCount || 0)
      })
      .catch(() => {
        if (!cancelled) setMessage("Failed to load status page data")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  function flash(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(""), 5000)
  }

  async function api(path: string, method: string, body?: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        flash(data.error || "Request failed")
        return false
      }
      return true
    } catch {
      flash("Network error")
      return false
    } finally {
      setSaving(false)
    }
  }

  /* ─── Components ─── */

  async function addComponent() {
    if (!newComp.name.trim()) return
    const ok = await api("/api/admin/status/components", "POST", {
      ...newComp,
      sortOrder: components.length,
    })
    if (ok) {
      setNewComp({ name: "", groupName: "", description: "" })
      flash("Component added")
      load()
    }
  }

  async function updateComponent(id: string, patch: Record<string, unknown>) {
    const ok = await api("/api/admin/status/components", "PUT", { id, ...patch })
    if (ok) {
      setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } as StatusComponent : c)))
      flash("Component updated")
    }
  }

  async function deleteComponent(id: string) {
    if (!confirm("Delete this component?")) return
    const ok = await api(`/api/admin/status/components?id=${id}`, "DELETE")
    if (ok) {
      setComponents((prev) => prev.filter((c) => c.id !== id))
      flash("Component deleted")
    }
  }

  /* ─── Incidents ─── */

  async function createIncident() {
    if (!form.title.trim()) return
    const ok = await api("/api/admin/status/incidents", "POST", {
      title: form.title,
      kind: form.kind,
      impact: form.kind === "maintenance" ? "maintenance" : form.impact,
      status: form.status,
      componentIds: form.componentIds,
      scheduledFor: toIso(form.scheduledFor),
      scheduledUntil: toIso(form.scheduledUntil),
      message: form.message,
      notify: form.notify,
    })
    if (ok) {
      setForm({
        kind: "incident",
        title: "",
        impact: "minor",
        status: "investigating",
        componentIds: [],
        scheduledFor: "",
        scheduledUntil: "",
        message: "",
        notify: true,
      })
      flash("Published to status page")
      load()
    }
  }

  async function postUpdate(incident: StatusIncident) {
    const draft = updateDrafts[incident.id]
    if (!draft || !draft.body.trim()) return
    const ok = await api("/api/admin/status/incidents", "PUT", {
      id: incident.id,
      status: draft.status,
      message: draft.body,
      notify: draft.notify,
    })
    if (ok) {
      setUpdateDrafts((prev) => {
        const next = { ...prev }
        delete next[incident.id]
        return next
      })
      flash("Update posted")
      load()
    }
  }

  async function quickStatus(incident: StatusIncident, status: IncidentStatus) {
    const ok = await api("/api/admin/status/incidents", "PUT", { id: incident.id, status })
    if (ok) {
      flash(`Marked as ${INCIDENT_STATUS_LABELS[status]}`)
      load()
    }
  }

  async function deleteIncident(id: string) {
    if (!confirm("Delete this incident? This cannot be undone.")) return
    const ok = await api(`/api/admin/status/incidents?id=${id}`, "DELETE")
    if (ok) {
      flash("Incident deleted")
      load()
    }
  }

  const openIncidents = incidents.filter(
    (i) =>
      (i.kind === "incident" && OPEN_INCIDENT_STATUSES.includes(i.status)) ||
      (i.kind === "maintenance" && OPEN_MAINTENANCE_STATUSES.includes(i.status))
  )
  const pastIncidents = incidents.filter((i) => !openIncidents.includes(i))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-retail" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Status Page
          </h2>
          <p className="text-muted-foreground">
            Control the public status page — components, incidents, and scheduled maintenance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" /> {subscriberCount} subscriber{subscriberCount === 1 ? "" : "s"}
          </span>
          <Link href="/status" target="_blank">
            <Button size="sm" variant="outline">
              View public page <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.toLowerCase().includes("fail") || message.toLowerCase().includes("error")
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : "bg-success/10 text-success border border-success/20"
          }`}
        >
          {message}
        </div>
      )}

      {/* ─── Report incident / schedule maintenance ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Publish an Update
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={form.kind === "incident" ? "default" : "outline"}
              onClick={() => setForm({ ...form, kind: "incident", status: "investigating" })}
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Incident
            </Button>
            <Button
              size="sm"
              variant={form.kind === "maintenance" ? "default" : "outline"}
              onClick={() => setForm({ ...form, kind: "maintenance", status: "scheduled", impact: "maintenance" })}
            >
              <Wrench className="w-3.5 h-3.5 mr-1" /> Scheduled Maintenance
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Title</label>
              <input
                className={inputCls}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={
                  form.kind === "maintenance"
                    ? "Scheduled system maintenance"
                    : "Elevated payment failure rates"
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                className={inputCls}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as IncidentStatus })}
              >
                {(form.kind === "maintenance" ? MAINTENANCE_FLOW : INCIDENT_FLOW).map((s) => (
                  <option key={s} value={s}>{INCIDENT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            {form.kind === "incident" ? (
              <div>
                <label className="block text-xs font-medium mb-1">Impact</label>
                <select
                  className={inputCls}
                  value={form.impact}
                  onChange={(e) => setForm({ ...form, impact: e.target.value })}
                >
                  {IMPACTS.filter((i) => i !== "maintenance").map((i) => (
                    <option key={i} value={i}>{i[0].toUpperCase() + i.slice(1)}</option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1">Starts</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={form.scheduledFor}
                    onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Ends</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={form.scheduledUntil}
                    onChange={(e) => setForm({ ...form, scheduledUntil: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">Affected components</label>
            <div className="flex flex-wrap gap-2">
              {components.map((c) => {
                const checked = form.componentIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        componentIds: checked
                          ? form.componentIds.filter((id) => id !== c.id)
                          : [...form.componentIds, c.id],
                      })
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      checked
                        ? "bg-retail text-white border-retail"
                        : "border-border text-muted-foreground hover:border-retail/40"
                    }`}
                  >
                    {c.name}
                  </button>
                )
              })}
              {components.length === 0 && (
                <p className="text-xs text-muted-foreground">Add components below first.</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Message</label>
            <textarea
              rows={3}
              className={`${inputCls} resize-y`}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Describe what's happening and what customers should expect..."
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.notify}
                onChange={(e) => setForm({ ...form, notify: e.target.checked })}
                className="rounded border-input"
              />
              Email subscribers about this
            </label>
            <Button onClick={createIncident} disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Publish
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Open items ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Open Items ({openIncidents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openIncidents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No open incidents or scheduled maintenance.
            </p>
          ) : (
            <div className="space-y-6">
              {openIncidents.map((inc) => {
                const draft = updateDrafts[inc.id] || {
                  status: inc.status,
                  body: "",
                  notify: true,
                }
                const flow = inc.kind === "maintenance" ? MAINTENANCE_FLOW : INCIDENT_FLOW
                return (
                  <div key={inc.id} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{inc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {inc.kind === "maintenance" ? "Maintenance" : `Impact: ${inc.impact}`}
                          {" · "}Status: {INCIDENT_STATUS_LABELS[inc.status]}
                          {inc.scheduledFor && ` · ${fmt(inc.scheduledFor)} → ${fmt(inc.scheduledUntil)}`}
                          {" · "}Created {fmt(inc.createdAt)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          quickStatus(inc, inc.kind === "maintenance" ? "completed" : "resolved")
                        }
                        disabled={saving}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        {inc.kind === "maintenance" ? "Mark completed" : "Resolve"}
                      </Button>
                    </div>

                    {inc.updates.length > 0 && (
                      <div className="border-l-2 border-border pl-3 space-y-2">
                        {inc.updates.map((u) => (
                          <div key={u.id} className="text-xs">
                            <span className="font-semibold">
                              {INCIDENT_STATUS_LABELS[u.status as IncidentStatus] || u.status}
                            </span>
                            <span className="text-muted-foreground"> — {u.body}</span>
                            <span className="block text-muted-foreground/70">{fmt(u.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
                      <select
                        className={inputCls}
                        value={draft.status}
                        onChange={(e) =>
                          setUpdateDrafts({
                            ...updateDrafts,
                            [inc.id]: { ...draft, status: e.target.value as IncidentStatus },
                          })
                        }
                      >
                        {flow.map((s) => (
                          <option key={s} value={s}>{INCIDENT_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                      <input
                        className={inputCls}
                        placeholder="Post an update..."
                        value={draft.body}
                        onChange={(e) =>
                          setUpdateDrafts({
                            ...updateDrafts,
                            [inc.id]: { ...draft, body: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={draft.notify}
                          onChange={(e) =>
                            setUpdateDrafts({
                              ...updateDrafts,
                              [inc.id]: { ...draft, notify: e.target.checked },
                            })
                          }
                          className="rounded border-input"
                        />
                        Notify subscribers
                      </label>
                      <Button
                        size="sm"
                        onClick={() => postUpdate(inc)}
                        disabled={saving || !draft.body.trim()}
                      >
                        Post Update
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Components ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Components</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left">Component</th>
                  <th className="px-4 py-2 text-left">Group</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {components.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <input
                        className="w-full bg-transparent font-medium focus:outline-none focus:ring-1 focus:ring-retail/40 rounded px-1 -mx-1"
                        value={c.name}
                        onChange={(e) =>
                          setComponents((prev) =>
                            prev.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x))
                          )
                        }
                        onBlur={(e) => updateComponent(c.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="w-full bg-transparent text-muted-foreground focus:outline-none focus:ring-1 focus:ring-retail/40 rounded px-1 -mx-1"
                        value={c.groupName}
                        placeholder="—"
                        onChange={(e) =>
                          setComponents((prev) =>
                            prev.map((x) => (x.id === c.id ? { ...x, groupName: e.target.value } : x))
                          )
                        }
                        onBlur={(e) => updateComponent(c.id, { groupName: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                        value={c.status}
                        onChange={(e) => updateComponent(c.id, { status: e.target.value })}
                      >
                        {COMPONENT_STATUSES.map((s) => (
                          <option key={s} value={s}>{COMPONENT_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteComponent(c.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {components.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No components yet. Add your first below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-2 items-end">
            <div>
              <label className="block text-xs font-medium mb-1">Name</label>
              <input
                className={inputCls}
                value={newComp.name}
                onChange={(e) => setNewComp({ ...newComp, name: e.target.value })}
                placeholder="e.g. Payments & Checkout"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Group (optional)</label>
              <input
                className={inputCls}
                value={newComp.groupName}
                onChange={(e) => setNewComp({ ...newComp, groupName: e.target.value })}
                placeholder="e.g. Payments"
              />
            </div>
            <Button onClick={addComponent} disabled={saving || !newComp.name.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── History ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">History ({pastIncidents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pastIncidents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No past incidents.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Title</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Resolved</th>
                    <th className="px-4 py-2 text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {pastIncidents.map((inc) => (
                    <tr key={inc.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{inc.title}</td>
                      <td className="px-4 py-2 capitalize">{inc.kind}</td>
                      <td className="px-4 py-2">
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-green-50 text-green-700">
                          {INCIDENT_STATUS_LABELS[inc.status] || inc.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{fmt(inc.resolvedAt)}</td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteIncident(inc.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
