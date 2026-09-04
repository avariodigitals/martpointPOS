"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react"

interface Business {
  id: string
  businessName: string
}

interface Incident {
  id: string
  business_id: string
  type: string
  severity: string
  status: string
  summary?: string | null
  created_at: string
  business?: { business_name?: string | null }
  owner?: { name?: string | null }
}

const STATUSES = ["", "OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"]
const TYPES = ["", "SERVICE", "SECURITY", "DATA", "BILLING", "PARTNER", "OTHER"]
const SEVERITIES = ["", "LOW", "MEDIUM", "HIGH", "CRITICAL"]

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

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const [status, setStatus] = useState("")
  const [type, setType] = useState("")
  const [severity, setSeverity] = useState("")
  const [businessId, setBusinessId] = useState("")
  const [params, setParams] = useState<URLSearchParams>(new URLSearchParams())

  useEffect(() => {
    fetchBusinesses()
  }, [])

  useEffect(() => {
    fetchIncidents(params)
  }, [params])

  async function fetchBusinesses() {
    try {
      const res = await fetch("/api/admin/businesses")
      const data = await res.json()
      if (data.businesses) setBusinesses(data.businesses as Business[])
    } catch {
      // no-op
    }
  }

  async function fetchIncidents(query: URLSearchParams) {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/incidents/list?${query.toString()}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setIncidents(json.data as Incident[])
      } else {
        setIncidents([])
        setMessage(json.error || "Failed to load incidents")
      }
    } catch {
      setIncidents([])
      setMessage("Failed to load incidents")
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    const q = new URLSearchParams()
    if (status) q.set("status", status)
    if (type) q.set("type", type)
    if (severity) q.set("severity", severity)
    if (businessId) q.set("businessId", businessId)
    setParams(q)
  }

  const counts = useMemo(() => {
    return {
      total: incidents.length,
      open: incidents.filter((i) => i.status === "OPEN").length,
      investigating: incidents.filter((i) => i.status === "INVESTIGATING").length,
      resolved: incidents.filter((i) => ["RESOLVED", "CLOSED"].includes(i.status)).length,
    }
  }, [incidents])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Customer Incidents
          </h2>
          <p className="text-muted-foreground">Track and manage customer incidents.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/businesses">
            <Button size="sm" variant="outline">By Business</Button>
          </Link>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("load") ? "text-red-500" : "text-green-600"}`}>{message}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total</p><p className="text-2xl font-bold">{counts.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Open</p><p className="text-2xl font-bold text-red-600">{counts.open}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Investigating</p><p className="text-2xl font-bold text-amber-600">{counts.investigating}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Resolved</p><p className="text-2xl font-bold text-green-600">{counts.resolved}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {STATUSES.map((s) => <option key={s || "all"} value={s}>{s || "All"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {TYPES.map((t) => <option key={t || "all"} value={t}>{t || "All"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {SEVERITIES.map((s) => <option key={s || "all"} value={s}>{s || "All"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Business</label>
              <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">All</option>
                {businesses.map((b) => <option key={b.id} value={b.id}>{b.businessName}</option>)}
              </select>
            </div>
            <Button onClick={applyFilters} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3" />
              <p className="text-sm">No incidents match the filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Business</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Severity</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Owner</th>
                    <th className="px-4 py-2 text-left">Created</th>
                    <th className="px-4 py-2 text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{i.business?.business_name || "—"}</td>
                      <td className="px-4 py-2">
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-muted">
                          {i.type}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${SEVERITY_COLORS[i.severity] || "bg-gray-100"}`}>
                          {i.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[i.status] || "bg-gray-100"}`}>
                          {i.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">{i.owner?.name || "Unassigned"}</td>
                      <td className="px-4 py-2">{fmt(i.created_at)}</td>
                      <td className="px-4 py-2">
                        <Link href={`/admin/incidents/${i.id}`} className="inline-flex items-center text-muted-foreground hover:text-foreground">
                          View <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Link>
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
