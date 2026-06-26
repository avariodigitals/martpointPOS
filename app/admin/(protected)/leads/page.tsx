"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Trash2,
  Funnel,
  Users,
  Phone,
  Mail,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
} from "lucide-react"

interface Lead {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  businessType: string
  productInterest: string
  branches: string
  staffSize: string
  challenge?: string
  message?: string
  source: string
  status: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost"
  assignedTo?: string
  notes?: string
  submittedAt: string
  updatedAt: string
}

const PIPELINE_STAGES: Lead["status"][] = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]

const STAGE_COLORS: Record<string, string> = {
  New: "bg-info",
  Contacted: "bg-warning",
  Qualified: "bg-retail",
  Proposal: "bg-proposal",
  Won: "bg-success",
  Lost: "bg-destructive",
}

const STAGE_BG: Record<string, string> = {
  New: "bg-sky-50 border-sky-200",
  Contacted: "bg-amber-50 border-amber-200",
  Qualified: "bg-blue-50 border-blue-200",
  Proposal: "bg-violet-50 border-violet-200",
  Won: "bg-emerald-50 border-emerald-200",
  Lost: "bg-red-50 border-red-200",
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "list" | "pipeline">("table")

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [productFilter, setProductFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)

  // Expanded lead
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState("")

  // Add Lead modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    fullName: "",
    businessName: "",
    email: "",
    phone: "",
    businessType: "",
    productInterest: "retail",
    branches: "1",
    staffSize: "1-5",
    challenge: "",
    message: "",
    source: "manual",
    status: "New" as Lead["status"],
    notes: "",
  })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/leads")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.leads) setLeads(data.leads)
      })
      .catch(() => {
        if (!cancelled) setMessage("Failed to load leads")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const filteredLeads = useMemo(() => {
    let result = [...leads]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (l) =>
          l.fullName.toLowerCase().includes(q) ||
          l.businessName.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.phone.includes(q)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter)
    }
    if (sourceFilter !== "all") {
      result = result.filter((l) => l.source === sourceFilter)
    }
    if (productFilter !== "all") {
      result = result.filter((l) => l.productInterest === productFilter)
    }
    if (dateFilter !== "all") {
      const now = new Date()
      result = result.filter((l) => {
        const d = new Date(l.submittedAt)
        if (dateFilter === "today") {
          return d.toDateString() === now.toDateString()
        }
        if (dateFilter === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          return d >= weekAgo
        }
        if (dateFilter === "month") {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          return d >= monthAgo
        }
        return true
      })
    }

    return result
  }, [leads, searchQuery, statusFilter, sourceFilter, productFilter, dateFilter])

  const stats = useMemo(() => {
    const total = filteredLeads.length
    const newLeads = filteredLeads.filter((l) => l.status === "New").length
    const contacted = filteredLeads.filter((l) => l.status === "Contacted").length
    const won = filteredLeads.filter((l) => l.status === "Won").length
    const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0
    return { total, newLeads, contacted, won, conversionRate }
  }, [filteredLeads])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    PIPELINE_STAGES.forEach((s) => (counts[s] = 0))
    filteredLeads.forEach((l) => {
      counts[l.status] = (counts[l.status] || 0) + 1
    })
    return counts
  }, [filteredLeads])

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredLeads.forEach((l) => {
      counts[l.source] = (counts[l.source] || 0) + 1
    })
    return counts
  }, [filteredLeads])

  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredLeads.forEach((l) => {
      const label = l.productInterest === "retail" ? "Retail" : l.productInterest === "erp" ? "ERP" : "Not Sure"
      counts[label] = (counts[label] || 0) + 1
    })
    return counts
  }, [filteredLeads])

  const updateStatus = async (id: string, status: Lead["status"]) => {
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      const data = await res.json()
      if (data.success) {
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))
      }
    } catch {
      setMessage("Failed to update status")
    }
  }

  const saveNotes = async (id: string) => {
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notes: noteDraft }),
      })
      const data = await res.json()
      if (data.success) {
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, notes: noteDraft } : l)))
        setMessage("Notes saved.")
        setTimeout(() => setMessage(""), 2000)
      }
    } catch {
      setMessage("Failed to save notes")
    }
  }

  const deleteLead = async (id: string) => {
    if (!confirm("Delete this lead permanently?")) return
    try {
      const res = await fetch(`/api/admin/leads?id=${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setLeads((prev) => prev.filter((l) => l.id !== id))
      }
    } catch {
      setMessage("Failed to delete lead")
    }
  }

  const uniqueSources = useMemo(() => [...new Set(leads.map((l) => l.source))], [leads])
  const uniqueProducts = useMemo(() => [...new Set(leads.map((l) => l.productInterest))], [leads])

  const addLead = async () => {
    setAdding(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (data.success && data.lead) {
        setLeads((prev) => [data.lead, ...prev])
        setShowAddModal(false)
        setAddForm({
          fullName: "",
          businessName: "",
          email: "",
          phone: "",
          businessType: "",
          productInterest: "retail",
          branches: "1",
          staffSize: "1-5",
          challenge: "",
          message: "",
          source: "manual",
          status: "New",
          notes: "",
        })
        setMessage("Lead added successfully.")
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(data.error || "Failed to add lead")
      }
    } catch {
      setMessage("Failed to add lead")
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Funnel className="w-5 h-5" />
            Leads
          </h2>
          <p className="text-muted-foreground">Capture, track, and convert form submissions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Lead
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            Table
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            List
          </Button>
          <Button
            variant={viewMode === "pipeline" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("pipeline")}
          >
            Pipeline
          </Button>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("saved") || message.includes("success") ? "text-green-600" : "text-red-500"}`}>
          {message}
        </p>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Leads</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">New</p>
                <p className="text-2xl font-bold text-blue-600">{stats.newLeads}</p>
              </div>
              <AlertCircle className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Contacted</p>
                <p className="text-2xl font-bold text-amber-600">{stats.contacted}</p>
              </div>
              <Phone className="w-5 h-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Won Rate</p>
                <p className="text-2xl font-bold text-green-600">{stats.conversionRate}%</p>
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {PIPELINE_STAGES.map((stage) => {
              const count = stageCounts[stage] || 0
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
              return (
                <div key={stage} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{stage}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${STAGE_COLORS[stage]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(sourceCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              Object.entries(sourceCounts).map(([source, count]) => {
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                return (
                  <div key={source} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium capitalize">{source}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-retail" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By Product Interest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(productCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              Object.entries(productCounts).map(([product, count]) => {
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                return (
                  <div key={product} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{product}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, business, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
            <Funnel className="mr-2 h-4 w-4" />
            Filters
            {showFilters ? <ChevronUp className="ml-2 h-3 w-3" /> : <ChevronDown className="ml-2 h-3 w-3" />}
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg border border-border bg-muted/30">
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Statuses</option>
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Source</label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Sources</option>
                {uniqueSources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Product</label>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Products</option>
                {uniqueProducts.map((p) => (
                  <option key={p} value={p}>
                    {p === "retail" ? "MartPoint Retail" : p === "erp" ? "MartPoint ERP" : "Not Sure"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Date</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
            <div className="sm:col-span-2 md:col-span-4 flex justify-end">
              <button
                onClick={() => {
                  setStatusFilter("all")
                  setSourceFilter("all")
                  setProductFilter("all")
                  setDateFilter("all")
                  setSearchQuery("")
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline View */}
      {viewMode === "pipeline" && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-[1100px]">
            {PIPELINE_STAGES.map((stage) => {
              const stageLeads = filteredLeads.filter((l) => l.status === stage)
              return (
                <div key={stage} className="flex-1 min-w-[260px]">
                  <div className={`rounded-t-lg px-3 py-2 flex items-center justify-between ${STAGE_BG[stage]}`}>
                    <span className="text-xs font-semibold">{stage}</span>
                    <span className="text-xs font-bold">{stageLeads.length}</span>
                  </div>
                  <div className="rounded-b-lg border border-t-0 border-border bg-muted/20 p-2 space-y-2 min-h-[120px] max-h-[70vh] overflow-y-auto">
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="rounded-md bg-card border border-border p-3 cursor-pointer hover:shadow-sm transition-shadow"
                        onClick={() => {
                          setExpandedId(lead.id)
                          setNoteDraft(lead.notes || "")
                        }}
                      >
                        <p className="text-sm font-semibold truncate" title={lead.fullName}>{lead.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate" title={lead.businessName}>{lead.businessName}</p>
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate" title={lead.email}>{lead.email}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{lead.phone}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted font-medium">
                            {lead.source}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted font-medium">
                            {lead.productInterest === "retail" ? "Retail" : lead.productInterest === "erp" ? "ERP" : "?"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {stageLeads.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No leads</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => {
                      setExpandedId(expandedId === lead.id ? null : lead.id)
                      setNoteDraft(lead.notes || "")
                    }}
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{lead.fullName}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{lead.businessName}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{lead.email}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{lead.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {lead.productInterest === "retail" ? "Retail" : lead.productInterest === "erp" ? "ERP" : "Not Sure"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted font-medium">
                        {lead.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${STAGE_COLORS[lead.status]}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(lead.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteLead(lead.id)
                        }}
                        className="p-1 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete lead"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      No leads match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Expanded detail row below table */}
          {expandedId && (() => {
            const lead = filteredLeads.find((l) => l.id === expandedId)
            if (!lead) return null
            return (
              <div className="border-t border-border px-4 py-4 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{lead.fullName} — Details</p>
                  <select
                    value={lead.status}
                    onChange={(e) => updateStatus(lead.id, e.target.value as Lead["status"])}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Business Type</p><p className="font-medium">{lead.businessType}</p></div>
                  <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Branches</p><p className="font-medium">{lead.branches}</p></div>
                  <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Staff Size</p><p className="font-medium">{lead.staffSize}</p></div>
                  <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Submitted</p><p className="font-medium">{new Date(lead.submittedAt).toLocaleDateString()}</p></div>
                </div>
                {lead.challenge && <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Challenge</p><p className="text-sm">{lead.challenge}</p></div>}
                {lead.message && <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Message</p><p className="text-sm">{lead.message}</p></div>}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                  <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} placeholder="Add internal notes..." className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" onClick={() => saveNotes(lead.id)}>
                      <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Save Notes
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()}
        </Card>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add New Lead</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  value={addForm.fullName}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Business Name *</label>
                <input
                  type="text"
                  value={addForm.businessName}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, businessName: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="ABC Supermarket"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Phone *</label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="+234..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Business Type *</label>
                <select
                  value={addForm.businessType}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, businessType: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="Supermarket">Supermarket</option>
                  <option value="Mini Mart">Mini Mart</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Pharmacy">Pharmacy</option>
                  <option value="Electronics Store">Electronics Store</option>
                  <option value="Fashion Retailer">Fashion Retailer</option>
                  <option value="Distributor">Distributor</option>
                  <option value="Wholesaler">Wholesaler</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Product Interest *</label>
                <select
                  value={addForm.productInterest}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, productInterest: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="retail">MartPoint Retail</option>
                  <option value="erp">MartPoint ERP</option>
                  <option value="not-sure">Not Sure — Need Guidance</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Branches *</label>
                <select
                  value={addForm.branches}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, branches: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="1">1</option>
                  <option value="2-3">2-3</option>
                  <option value="4-6">4-6</option>
                  <option value="7-10">7-10</option>
                  <option value="10+">10+</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Staff Size *</label>
                <select
                  value={addForm.staffSize}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, staffSize: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="1-5">1-5</option>
                  <option value="6-15">6-15</option>
                  <option value="16-30">16-30</option>
                  <option value="31-50">31-50</option>
                  <option value="50+">50+</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Source *</label>
                <select
                  value={addForm.source}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, source: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="manual">Manual Entry</option>
                  <option value="website">Website</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="referral">Referral</option>
                  <option value="social-media">Social Media</option>
                  <option value="cold-call">Cold Call</option>
                  <option value="email">Email</option>
                  <option value="event">Event</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Status</label>
                <select
                  value={addForm.status}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, status: e.target.value as Lead["status"] }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Challenge / Pain Point</label>
              <input
                type="text"
                value={addForm.challenge}
                onChange={(e) => setAddForm((prev) => ({ ...prev, challenge: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="What problem are they trying to solve?"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Message / Notes</label>
              <textarea
                value={addForm.message}
                onChange={(e) => setAddForm((prev) => ({ ...prev, message: e.target.value }))}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                placeholder="Any additional notes or context..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)} disabled={adding}>
                Cancel
              </Button>
              <Button size="sm" onClick={addLead} disabled={adding}>
                {adding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Add Lead
              </Button>
            </div>
          </div>
        </div>
      )}

      {viewMode === "list" && (
        <div className="space-y-3">
          {filteredLeads.map((lead) => (
            <Card key={lead.id} className="overflow-hidden">
              <div
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                onClick={() => {
                  setExpandedId(expandedId === lead.id ? null : lead.id)
                  setNoteDraft(lead.notes || "")
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-12 rounded-full shrink-0 ${STAGE_COLORS[lead.status]}`} />
                  <div>
                    <p className="text-base font-semibold">{lead.fullName}</p>
                    <p className="text-sm text-muted-foreground">{lead.businessName} · {lead.businessType}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {lead.email}</span>
                      <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {lead.phone}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={lead.status}
                    onChange={(e) => {
                      e.stopPropagation()
                      updateStatus(lead.id, e.target.value as Lead["status"])
                    }}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteLead(lead.id)
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete lead"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {expandedId === lead.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {expandedId === lead.id && (
                <div className="border-t border-border px-4 py-4 bg-muted/20 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Product Interest</p>
                      <p className="font-medium">
                        {lead.productInterest === "retail" ? "MartPoint Retail" : lead.productInterest === "erp" ? "MartPoint ERP" : "Not Sure"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Branches</p>
                      <p className="font-medium">{lead.branches}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Staff Size</p>
                      <p className="font-medium">{lead.staffSize}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Source</p>
                      <p className="font-medium capitalize">{lead.source}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Submitted</p>
                      <p className="font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(lead.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white ${STAGE_COLORS[lead.status]}`}>
                        {lead.status}
                      </span>
                    </div>
                  </div>

                  {lead.challenge && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Challenge</p>
                      <p className="text-sm">{lead.challenge}</p>
                    </div>
                  )}
                  {lead.message && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Message</p>
                      <p className="text-sm">{lead.message}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={3}
                      placeholder="Add internal notes about this lead..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                    />
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" onClick={() => saveNotes(lead.id)}>
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                        Save Notes
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
          {filteredLeads.length === 0 && (
            <div className="text-center py-12">
              <Funnel className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No leads match your filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
