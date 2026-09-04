"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle, ArrowLeft, ArrowRight, Plus, X } from "lucide-react"

interface Incident {
  id: string
  business_id: string
  type: string
  severity: string
  status: string
  summary?: string | null
  created_at: string
  owner?: { name?: string | null }
}

interface User {
  id: string
  name: string
}

interface Business {
  id: string
  businessName: string
}

const TYPES = ["SERVICE", "SECURITY", "DATA", "BILLING", "PARTNER", "OTHER"]
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

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

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

export default function BusinessIncidentsPage() {
  const { businessId } = useParams() as { businessId: string }
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const [type, setType] = useState("")
  const [severity, setSeverity] = useState("")
  const [summary, setSummary] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [ticketId, setTicketId] = useState("")

  useEffect(() => {
    if (!businessId) return
    loadAll()
  }, [businessId])

  async function loadAll() {
    setLoading(true)
    setMessage("")
    try {
      const [incRes, busRes, usersRes] = await Promise.all([
        fetch(`/api/admin/incidents/list?businessId=${businessId}`),
        fetch(`/api/admin/businesses?id=${businessId}`),
        fetch("/api/admin/users"),
      ])
      const [incJson, busJson, usersJson] = await Promise.all([incRes.json(), busRes.json(), usersRes.json()])

      if (incJson.success) setIncidents(incJson.data as Incident[])
      else setMessage(incJson.error || "Failed to load incidents")

      if (busJson.business) setBusiness(busJson.business as Business)
      if (usersJson.users) setUsers(usersJson.users as User[])
    } catch {
      setMessage("Failed to load incidents")
    } finally {
      setLoading(false)
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!type || !severity || !summary) return
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/incidents/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          data: {
            business_id: businessId,
            support_ticket_id: ticketId || null,
            type,
            severity,
            summary,
            owner_admin_user_id: ownerId || null,
          },
        }),
      })
      const json = await res.json()
      if (json.success) {
        setShowCreate(false)
        setType("")
        setSeverity("")
        setSummary("")
        setOwnerId("")
        setTicketId("")
        await loadAll()
      } else {
        setMessage(json.error || "Failed to create incident")
      }
    } catch {
      setMessage("Failed to create incident")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/businesses/${businessId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Business
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {business?.businessName || "Business"} · Incidents
        </h2>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("Failed") || message.includes("failed") ? "text-red-500" : "text-green-600"}`}>{message}</p>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate((s) => !s)}>
          {showCreate ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showCreate ? "Cancel" : "Create Incident"}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Create Incident</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                    <option value="">Select type</option>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Severity</label>
                  <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                    <option value="">Select severity</option>
                    {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Owner</label>
                  <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Support ticket ID (optional)</label>
                  <input
                    type="text"
                    value={ticketId}
                    onChange={(e) => setTicketId(e.target.value)}
                    placeholder="Ticket ID"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Summary</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
              <Button size="sm" type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Create
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Incidents ({incidents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No incidents for this business yet.</p>
          ) : (
            <div className="space-y-2">
              {incidents.map((i) => (
                <Link
                  key={i.id}
                  href={`/admin/incidents/${i.id}`}
                  className="block p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{i.type}</p>
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${SEVERITY_COLORS[i.severity]}`}>{i.severity}</span>
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[i.status]}`}>{i.status}</span>
                      </div>
                      <p className="text-sm mt-0.5 line-clamp-1">{i.summary || "—"}</p>
                      <p className="text-xs text-muted-foreground">Owner: {i.owner?.name || "Unassigned"} · {fmt(i.created_at)}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
