"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react"

interface Incident {
  id: string
  business_id: string
  support_ticket_id?: string | null
  type: string
  severity: string
  status: string
  summary: string
  owner_admin_user_id?: string | null
  created_at: string
  updated_at: string
  resolved_at?: string | null
  business?: { business_name?: string | null }
  owner?: { name?: string | null }
  ticket?: { ticket_number?: string | null; subject?: string | null }
  events: AuditEvent[]
}

interface AuditEvent {
  id: string
  action: string
  actor_type: string
  actor_id?: string | null
  entity_id: string
  entity_type: string
  metadata?: Record<string, unknown> | null
  created_at: string
}

interface User {
  id: string
  name: string
}

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
const STATUSES = ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"]
const TYPES = ["SERVICE", "SECURITY", "DATA", "BILLING", "PARTNER", "OTHER"]

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-700",
  CRITICAL: "bg-red-50 text-red-700",
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-50 text-red-700",
  INVESTIGATING: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-green-50 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
}

function fmt(iso: string | undefined | null) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ incidentId: string }>
}) {
  const { incidentId } = use(params)
  const router = useRouter()

  const [incident, setIncident] = useState<Incident | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

  const [newSeverity, setNewSeverity] = useState("")
  const [newStatus, setNewStatus] = useState("")
  const [ownerUserId, setOwnerUserId] = useState("")
  const [ticketId, setTicketId] = useState("")

  useEffect(() => {
    loadAll()
  }, [incidentId])

  async function loadAll() {
    setLoading(true)
    setMessage("")
    try {
      const [incRes, usersRes] = await Promise.all([
        fetch(`/api/admin/incidents?id=${incidentId}`),
        fetch("/api/admin/users"),
      ])
      const [incJson, usersJson] = await Promise.all([incRes.json(), usersRes.json()])

      if (incJson.success) {
        setIncident(incJson.data as Incident)
        setNewSeverity((incJson.data as Incident).severity)
        setNewStatus((incJson.data as Incident).status)
        setOwnerUserId((incJson.data as Incident).owner_admin_user_id || "")
        setTicketId((incJson.data as Incident).support_ticket_id || "")
      } else {
        setMessage(incJson.error || "Failed to load incident")
      }

      if (usersJson.users) setUsers(usersJson.users as User[])
    } catch {
      setMessage("Failed to load incident")
    } finally {
      setLoading(false)
    }
  }

  async function postAction(action: string, data: Record<string, unknown>) {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/incidents/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: { id: incidentId, ...data } }),
      })
      const json = await res.json()
      if (json.success) {
        await loadAll()
      } else {
        setMessage(json.error || "Action failed")
      }
    } catch {
      setMessage("Action failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 p-6">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="space-y-4 p-6">
        <Link href="/admin/incidents" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Link>
        <p className="text-muted-foreground">{message || "Incident not found."}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/admin/incidents" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to incidents
          </Link>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 mt-1">
            <AlertTriangle className="w-5 h-5" />
            {incident.business?.business_name || "Incident"}
          </h2>
          <p className="text-muted-foreground">{incident.type} · {fmt(incident.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push(`/admin/businesses/${incident.business_id}`)}>
            Open Business
          </Button>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("failed") || message.includes("Failed") ? "text-red-500" : "text-green-600"}`}>{message}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-muted">
                    {incident.type}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">Severity</p>
                  <span className={`inline-flex text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${SEVERITY_COLORS[incident.severity]}`}>
                    {incident.severity}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <span className={`inline-flex text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[incident.status]}`}>
                    {incident.status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">Owner</p>
                  <p className="font-medium">{incident.owner?.name || "Unassigned"}</p>
                </div>
              </div>

              {incident.ticket ? (
                <div className="mt-4 p-3 rounded-md border border-border bg-muted/20 text-sm">
                  <p className="text-muted-foreground">Linked support ticket</p>
                  <Link href={`/admin/support/${incident.support_ticket_id}`} className="inline-flex items-center font-medium hover:underline">
                    {incident.ticket.ticket_number || incident.support_ticket_id} · {incident.ticket.subject || "—"}
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No support ticket linked.</p>
              )}

              <div className="mt-4">
                <p className="text-muted-foreground text-sm">Summary</p>
                <p className="text-sm whitespace-pre-wrap mt-1">{incident.summary || "No summary"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Incident Events</CardTitle>
            </CardHeader>
            <CardContent>
              {incident.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {incident.events.map((e) => (
                    <li key={e.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/20">
                      <span className="font-medium">{e.action}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{fmt(e.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <label className="block text-xs font-medium">Change severity</label>
                <select value={newSeverity} onChange={(e) => setNewSeverity(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select severity</option>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <Button size="sm" className="w-full" onClick={() => postAction("update", { severity: newSeverity })} disabled={!newSeverity || newSeverity === incident.severity || saving}>
                  Update Severity
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <label className="block text-xs font-medium">Change status</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select status</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <Button size="sm" className="w-full" onClick={() => postAction("update", { status: newStatus })} disabled={!newStatus || newStatus === incident.status || saving}>
                  Update Status
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <label className="block text-xs font-medium">Assign owner</label>
                <select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <Button size="sm" className="w-full" onClick={() => postAction("update", { owner_admin_user_id: ownerUserId || null })} disabled={saving}>
                  Assign Owner
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <label className="block text-xs font-medium">Link support ticket</label>
                <input
                  type="text"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  placeholder="Support ticket ID"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button size="sm" className="w-full" onClick={() => postAction("link_ticket", { support_ticket_id: ticketId })} disabled={!ticketId || saving}>
                  Link Ticket
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <Button size="sm" variant="outline" onClick={() => postAction("resolve", {})} disabled={incident.status === "RESOLVED" || saving}>
                  Resolve
                </Button>
                <Button size="sm" variant="outline" onClick={() => postAction("close", {})} disabled={incident.status === "CLOSED" || saving}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
