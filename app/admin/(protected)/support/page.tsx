"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, LifeBuoy, ArrowRight } from "lucide-react"

interface BusinessInfo {
  business_name?: string | null
}

interface AdminInfo {
  name?: string | null
}

interface Ticket {
  id: string
  ticket_number: string
  business_id: string
  subject: string
  category: string
  priority: string
  status: string
  business?: BusinessInfo
  admin?: AdminInfo
  first_response_due_at?: string | null
  resolution_due_at?: string | null
  sla_state: "ON_TRACK" | "DUE_SOON" | "BREACHED" | null
  created_at: string
}

const STATUSES = ["", "NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_PARTNER", "ESCALATED", "RESOLVED", "CLOSED", "CANCELLED"]
const PRIORITIES = ["", "LOW", "NORMAL", "HIGH", "URGENT"]
const CATEGORIES = ["", "SOFTWARE", "LOGIN_ACCOUNT", "POS", "INVENTORY", "PRODUCTS", "REPORTS", "ONLINE_STORE", "CONFIGURATION", "TRAINING", "BILLING", "LICENSING", "SECURITY", "PRIVACY_DATA", "HARDWARE_GUIDANCE", "FEATURE_REQUEST", "PARTNER_COMPLAINT", "OTHER"]

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700",
  WAITING_CUSTOMER: "bg-amber-50 text-amber-700",
  WAITING_PARTNER: "bg-amber-50 text-amber-700",
  ESCALATED: "bg-red-50 text-red-700",
  RESOLVED: "bg-green-50 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-500",
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700",
  NORMAL: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-700",
  URGENT: "bg-red-50 text-red-700",
}

const SLA_COLORS: Record<string, string> = {
  ON_TRACK: "text-green-600",
  DUE_SOON: "text-amber-600",
  BREACHED: "text-red-600",
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const [status, setStatus] = useState("")
  const [priority, setPriority] = useState("")
  const [category, setCategory] = useState("")
  const [search, setSearch] = useState("")

  const [params, setParams] = useState<URLSearchParams>(new URLSearchParams())

  useEffect(() => {
    fetchTickets(params)
  }, [params])

  async function fetchTickets(query: URLSearchParams) {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/support/tickets?${query.toString()}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setTickets(json.data)
      } else {
        setTickets([])
        setMessage(json.error || "Failed to load tickets")
      }
    } catch {
      setTickets([])
      setMessage("Failed to load tickets")
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    const q = new URLSearchParams()
    if (status) q.set("status", status)
    if (priority) q.set("priority", priority)
    if (category) q.set("category", category)
    if (search.trim()) q.set("search", search.trim())
    setParams(q)
  }

  const counts = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter((t) => ["NEW", "ASSIGNED", "IN_PROGRESS"].includes(t.status)).length,
      waiting: tickets.filter((t) => ["WAITING_CUSTOMER", "WAITING_PARTNER"].includes(t.status)).length,
      escalated: tickets.filter((t) => t.status === "ESCALATED").length,
      resolved: tickets.filter((t) => ["RESOLVED", "CLOSED"].includes(t.status)).length,
    }
  }, [tickets])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LifeBuoy className="w-5 h-5" />
            Support Desk
          </h2>
          <p className="text-muted-foreground">Manage support tickets, assignments and SLA.</p>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("load") ? "text-red-500" : "text-green-600"}`}>{message}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total</p><p className="text-2xl font-bold">{counts.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Open</p><p className="text-2xl font-bold text-blue-600">{counts.open}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Waiting</p><p className="text-2xl font-bold text-amber-600">{counts.waiting}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Escalated</p><p className="text-2xl font-bold text-red-600">{counts.escalated}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Resolved</p><p className="text-2xl font-bold text-green-600">{counts.resolved}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><LifeBuoy className="w-4 h-4" /> Filters</CardTitle>
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
              <label className="block text-xs font-medium mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {PRIORITIES.map((p) => <option key={p || "all"} value={p}>{p || "All"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {CATEGORIES.map((c) => <option key={c || "all"} value={c}>{c || "All"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ticket, subject, business..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button onClick={applyFilters} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <LifeBuoy className="w-10 h-10 mx-auto mb-3" />
              <p className="text-sm">No tickets match the filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Ticket</th>
                    <th className="px-4 py-2 text-left">Business</th>
                    <th className="px-4 py-2 text-left">Subject</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-left">Priority</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Assigned</th>
                    <th className="px-4 py-2 text-left">SLA</th>
                    <th className="px-4 py-2 text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{t.ticket_number}</td>
                      <td className="px-4 py-2">{t.business?.business_name || "—"}</td>
                      <td className="px-4 py-2 max-w-xs truncate">{t.subject}</td>
                      <td className="px-4 py-2">
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-muted">
                          {t.category}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[t.priority] || "bg-gray-100"}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[t.status] || "bg-gray-100"}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">{t.admin?.name || "Unassigned"}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase font-medium ${SLA_COLORS[t.sla_state || ""] || "text-muted-foreground"}`}>
                          {t.sla_state || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/admin/support/${t.id}`} className="inline-flex items-center text-muted-foreground hover:text-foreground">
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
