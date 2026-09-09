"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Plus,
  Send,
  X,
  Funnel,
  Users,
  TrendingUp,
  AlertCircle,
  Shield,
  Search,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  MapPin,
  Calendar,
} from "lucide-react"
import { LocationFields } from "@/components/location-fields"
import { allIndustries } from "@/lib/industries"

const INDUSTRY_OPTIONS = [...allIndustries.map((i) => i.name), "Other"]
const BUSINESS_TYPE_OPTIONS = ["Retail", "Supermarket", "Pharmacy", "Restaurant", "Beauty/Salon", "Services", "Other"]
const PRODUCT_OPTIONS = ["MartPoint Retail", "MartPoint ERP", "Not Sure — Need Guidance"]

type LeadStatus =
  | "REGISTERED" | "UNDER_REVIEW" | "QUALIFIED" | "DEMO" | "PROPOSAL"
  | "NEGOTIATION" | "WON" | "LOST" | "EXPIRED"

interface Lead {
  id: string
  businessName: string
  contactName: string
  email: string | null
  phone: string | null
  country: string
  state: string
  city: string
  industry: string
  businessType: string
  interestedProduct: string
  estimatedBranches: number | null
  estimatedUsers: number | null
  estimatedDealValue: number | null
  notes: string | null
  partnerId: string | null
  partnerName: string | null
  partnerCode: string | null
  status: LeadStatus
  protectionStatus: "PENDING" | "PROTECTED" | "REJECTED" | "EXPIRED"
  protectionExpiresAt: string | null
  invitedAt: string | null
  createdAt: string
}

interface PartnerOption {
  id: string
  business_name: string
  partner_id: string
}

const PIPELINE_STAGES: LeadStatus[] = [
  "REGISTERED", "UNDER_REVIEW", "QUALIFIED", "DEMO", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "EXPIRED",
]

const STAGE_LABELS: Record<LeadStatus, string> = {
  REGISTERED: "Registered",
  UNDER_REVIEW: "Under Review",
  QUALIFIED: "Qualified",
  DEMO: "Demo",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
  EXPIRED: "Expired",
}

const STAGE_COLORS: Record<LeadStatus, string> = {
  REGISTERED: "bg-info",
  UNDER_REVIEW: "bg-warning",
  QUALIFIED: "bg-retail",
  DEMO: "bg-indigo-500",
  PROPOSAL: "bg-proposal",
  NEGOTIATION: "bg-violet-500",
  WON: "bg-success",
  LOST: "bg-destructive",
  EXPIRED: "bg-muted-foreground",
}

const STAGE_BG: Record<LeadStatus, string> = {
  REGISTERED: "bg-sky-50 border-sky-200",
  UNDER_REVIEW: "bg-amber-50 border-amber-200",
  QUALIFIED: "bg-blue-50 border-blue-200",
  DEMO: "bg-indigo-50 border-indigo-200",
  PROPOSAL: "bg-violet-50 border-violet-200",
  NEGOTIATION: "bg-purple-50 border-purple-200",
  WON: "bg-emerald-50 border-emerald-200",
  LOST: "bg-red-50 border-red-200",
  EXPIRED: "bg-gray-50 border-gray-200",
}

const PROTECTION_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PROTECTED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-600",
}

type KanbanStage = "SUBMITTED" | "UNDER_REVIEW" | "QUALIFIED" | "IN_DISCUSSION" | "WON" | "LOST"

const KANBAN_STAGES: KanbanStage[] = ["SUBMITTED", "UNDER_REVIEW", "QUALIFIED", "IN_DISCUSSION", "WON", "LOST"]

const KANBAN_LABELS: Record<KanbanStage, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  QUALIFIED: "Qualified",
  IN_DISCUSSION: "In Discussion",
  WON: "Won",
  LOST: "Lost",
}

const KANBAN_STATUS_MAP: Record<KanbanStage, LeadStatus[]> = {
  SUBMITTED: ["REGISTERED"],
  UNDER_REVIEW: ["UNDER_REVIEW"],
  QUALIFIED: ["QUALIFIED"],
  IN_DISCUSSION: ["DEMO", "PROPOSAL", "NEGOTIATION"],
  WON: ["WON"],
  LOST: ["LOST", "EXPIRED"],
}

const KANBAN_BG: Record<KanbanStage, string> = {
  SUBMITTED: "bg-sky-50 border-sky-200",
  UNDER_REVIEW: "bg-amber-50 border-amber-200",
  QUALIFIED: "bg-blue-50 border-blue-200",
  IN_DISCUSSION: "bg-violet-50 border-violet-200",
  WON: "bg-emerald-50 border-emerald-200",
  LOST: "bg-red-50 border-red-200",
}

const KANBAN_REPRESENTATIVE_STATUS: Record<KanbanStage, LeadStatus> = {
  SUBMITTED: "REGISTERED",
  UNDER_REVIEW: "UNDER_REVIEW",
  QUALIFIED: "QUALIFIED",
  IN_DISCUSSION: "DEMO",
  WON: "WON",
  LOST: "LOST",
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1"

const emptyForm = {
  partnerId: "",
  businessName: "",
  contactName: "",
  phone: "",
  email: "",
  country: "",
  state: "",
  city: "",
  industry: "",
  businessType: "",
  interestedProduct: "",
  estimatedBranches: "",
  estimatedUsers: "",
  estimatedDealValue: "",
  notes: "",
}

export default function AdminPartnerLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "list" | "pipeline" | "kanban">("table")

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [protectionFilter, setProtectionFilter] = useState<string>("all")
  const [partnerFilter, setPartnerFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)

  // Expanded lead
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Add Lead modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ ...emptyForm })
  const [adding, setAdding] = useState(false)
  const [partners, setPartners] = useState<PartnerOption[]>([])

  function loadLeads() {
    return fetch("/api/admin/partner-leads")
      .then((r) => r.json())
      .then((data) => setLeads(data.leads || []))
  }

  useEffect(() => {
    loadLeads().finally(() => setLoading(false))
    fetch("/api/admin/partners")
      .then((r) => r.json())
      .then((data) => setPartners((data.partners || []).filter((p: PartnerOption & { status?: string }) => !p.status || p.status === "ACTIVE")))
      .catch(() => {})
  }, [])

  const filteredLeads = useMemo(() => {
    let result = [...leads]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (l) =>
          l.businessName.toLowerCase().includes(q) ||
          l.contactName.toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q) ||
          (l.phone || "").includes(q) ||
          (l.partnerName || "").toLowerCase().includes(q)
      )
    }
    if (statusFilter !== "all") result = result.filter((l) => l.status === statusFilter)
    if (protectionFilter !== "all") result = result.filter((l) => l.protectionStatus === protectionFilter)
    if (partnerFilter === "none") result = result.filter((l) => !l.partnerId)
    else if (partnerFilter !== "all") result = result.filter((l) => l.partnerId === partnerFilter)
    if (dateFilter !== "all") {
      const now = new Date()
      result = result.filter((l) => {
        const d = new Date(l.createdAt)
        if (dateFilter === "today") return d.toDateString() === now.toDateString()
        if (dateFilter === "week") return d >= new Date(now.getTime() - 7 * 864e5)
        if (dateFilter === "month") return d >= new Date(now.getTime() - 30 * 864e5)
        return true
      })
    }
    return result
  }, [leads, searchQuery, statusFilter, protectionFilter, partnerFilter, dateFilter])

  const stats = useMemo(() => {
    const total = filteredLeads.length
    const registered = filteredLeads.filter((l) => l.status === "REGISTERED").length
    const protectedCount = filteredLeads.filter((l) => l.protectionStatus === "PROTECTED").length
    const won = filteredLeads.filter((l) => l.status === "WON").length
    const wonRate = total > 0 ? Math.round((won / total) * 100) : 0
    return { total, registered, protectedCount, wonRate }
  }, [filteredLeads])

  // Funnel stages are the progressive pipeline steps (LOST/EXPIRED are outcomes, not stages).
  const FUNNEL_STAGES = useMemo(
    () => PIPELINE_STAGES.filter((s) => s !== "LOST" && s !== "EXPIRED"),
    []
  )

  const funnel = useMemo(() => {
    // Cumulative: a lead at stage N has passed through every earlier stage.
    const rows = FUNNEL_STAGES.map((stage, i) => {
      const count = filteredLeads.filter((l) => {
        const idx = PIPELINE_STAGES.indexOf(l.status)
        return idx >= i && l.status !== "LOST" && l.status !== "EXPIRED"
      }).length
      return { stage, count }
    })
    const conversions = rows.map((r, i) =>
      i === 0 ? null : rows[i - 1].count > 0 ? Math.round((r.count / rows[i - 1].count) * 100) : 0
    )
    const won = filteredLeads.filter((l) => l.status === "WON").length
    const lost = filteredLeads.filter((l) => l.status === "LOST").length
    const expired = filteredLeads.filter((l) => l.status === "EXPIRED").length
    const closed = won + lost
    const winRate = closed > 0 ? Math.round((won / closed) * 100) : 0
    return { rows, conversions, won, lost, expired, closed, winRate }
  }, [filteredLeads, FUNNEL_STAGES])

  const partnerCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredLeads.forEach((l) => {
      const label = l.partnerName || l.partnerCode || "Unattributed"
      counts[label] = (counts[label] || 0) + 1
    })
    return counts
  }, [filteredLeads])

  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredLeads.forEach((l) => {
      const label = l.interestedProduct || "Unspecified"
      counts[label] = (counts[label] || 0) + 1
    })
    return counts
  }, [filteredLeads])

  async function act(lead: Lead, action: string, opts?: { status?: string; protectionStatus?: string }) {
    setMessage("")
    const body: Record<string, unknown> = { id: lead.id, action }
    if (opts?.status) body.status = opts.status
    if (opts?.protectionStatus) {
      body.protectionStatus = opts.protectionStatus
      if (opts.protectionStatus === "PROTECTED") body.protectionDays = 30
    }

    const res = await fetch("/api/admin/partner-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok) {
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...data.lead } : l)))
      } else {
        await loadLeads()
      }
      if (action === "invite") setMessage(`Invitation sent to ${lead.email}. Link: ${data.inviteLink || ""}`)
    } else {
      setMessage(data.error || "Action failed")
    }
  }

  async function addLead() {
    setAdding(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/partner-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          ...addForm,
          partnerId: addForm.partnerId || null,
          estimatedBranches: addForm.estimatedBranches || null,
          estimatedUsers: addForm.estimatedUsers || null,
          estimatedDealValue: addForm.estimatedDealValue || null,
          notes: addForm.notes || null,
        }),
      })
      const data = await res.json()
      if (res.ok && data.lead) {
        await loadLeads()
        setShowAddModal(false)
        setAddForm({ ...emptyForm })
        setMessage(data.warning || "Lead added successfully.")
        setTimeout(() => setMessage(""), 4000)
      } else {
        setMessage(data.error || "Failed to add lead")
      }
    } catch {
      setMessage("Failed to add lead")
    } finally {
      setAdding(false)
    }
  }

  const setField = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setAddForm((f) => ({ ...f, [key]: e.target.value }))

  function LeadActions({ lead }: { lead: Lead }) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {lead.protectionStatus === "PENDING" && (
          <>
            <button onClick={() => act(lead, "decide", { protectionStatus: "PROTECTED" })} className="text-xs bg-green-100 text-green-800 rounded px-2 py-1">Protect</button>
            <button onClick={() => act(lead, "decide", { protectionStatus: "REJECTED" })} className="text-xs bg-red-100 text-red-800 rounded px-2 py-1">Reject</button>
          </>
        )}
        <select
          value={lead.status}
          onChange={(e) => act(lead, "decide", { status: e.target.value })}
          className="text-xs rounded border border-input bg-background px-1.5 py-1"
        >
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
        </select>
        <button
          onClick={() => act(lead, "invite")}
          disabled={!lead.email || !!lead.invitedAt}
          title={lead.email ? "Email the lead a link to complete the partner application form" : "Lead has no email address"}
          className="text-xs bg-retail/10 text-retail rounded px-2 py-1 disabled:opacity-50 inline-flex items-center gap-1"
        >
          <Send className="w-3 h-3" />
          {lead.invitedAt ? "Invited" : "Invite to Apply"}
        </button>
      </div>
    )
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
            Partner Leads
          </h2>
          <p className="text-muted-foreground">Track partner-registered leads, deal protection, and application invites.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Lead
          </Button>
          <Button variant={viewMode === "table" ? "default" : "outline"} size="sm" onClick={() => setViewMode("table")}>Table</Button>
          <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>List</Button>
          <Button variant={viewMode === "pipeline" ? "default" : "outline"} size="sm" onClick={() => setViewMode("pipeline")}>Pipeline</Button>
          <Button variant={viewMode === "kanban" ? "default" : "outline"} size="sm" onClick={() => setViewMode("kanban")}>Kanban</Button>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("fail") || message.includes("Invalid") || message.includes("error") ? "text-red-500" : "text-green-600"}`}>
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
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Registered</p>
                <p className="text-2xl font-bold text-blue-600">{stats.registered}</p>
              </div>
              <AlertCircle className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Protected</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.protectedCount}</p>
              </div>
              <Shield className="w-5 h-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Won Rate</p>
                <p className="text-2xl font-bold text-green-600">{stats.wonRate}%</p>
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
            <CardTitle className="text-sm font-medium">Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {funnel.rows.map((row, i) => {
              const top = funnel.rows[0]?.count || 0
              const widthPct = top > 0 ? Math.max((row.count / top) * 100, 4) : 4
              const conv = funnel.conversions[i]
              return (
                <div key={row.stage}>
                  {conv !== null && (
                    <div className="flex items-center justify-center gap-1 py-0.5">
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{conv}% advance</span>
                    </div>
                  )}
                  <div
                    className={`mx-auto flex h-8 min-w-[120px] items-center justify-between rounded-md px-3 text-white transition-all ${STAGE_COLORS[row.stage]}`}
                    style={{ width: `${Math.max(widthPct, 24)}%` }}
                  >
                    <span className="truncate text-[11px] font-medium flex-1 pr-2">{STAGE_LABELS[row.stage]}</span>
                    <span className="text-xs font-bold shrink-0">{row.count}</span>
                  </div>
                </div>
              )
            })}

            {/* Outcomes */}
            <div className="mt-3 border-t border-border pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Closed deals</span>
                <span className="font-semibold">{funnel.closed}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <span className="flex-1 rounded-md bg-emerald-50 px-2 py-1.5 text-center text-[11px] font-medium text-emerald-700">
                  Won · {funnel.won}
                </span>
                <span className="flex-1 rounded-md bg-red-50 px-2 py-1.5 text-center text-[11px] font-medium text-red-700">
                  Lost · {funnel.lost}
                </span>
                <span className="flex-1 rounded-md bg-gray-100 px-2 py-1.5 text-center text-[11px] font-medium text-gray-600">
                  Expired · {funnel.expired}
                </span>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Win rate on closed deals: <span className="font-semibold text-foreground">{funnel.winRate}%</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By Partner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(partnerCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              Object.entries(partnerCounts).map(([partner, count]) => {
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                return (
                  <div key={partner} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{partner}</span>
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
              placeholder="Search by business, contact, email, phone, partner..."
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
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
                <option value="all">All Statuses</option>
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Protection</label>
              <select value={protectionFilter} onChange={(e) => setProtectionFilter(e.target.value)} className={inputCls}>
                <option value="all">All</option>
                <option value="PENDING">Pending</option>
                <option value="PROTECTED">Protected</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Partner</label>
              <select value={partnerFilter} onChange={(e) => setPartnerFilter(e.target.value)} className={inputCls}>
                <option value="all">All Partners</option>
                <option value="none">Unattributed</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.business_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Date</label>
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={inputCls}>
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table view */}
      {viewMode === "table" && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left">Business</th>
                  <th className="px-4 py-2 text-left">Contact</th>
                  <th className="px-4 py-2 text-left">Partner</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Protection</th>
                  <th className="px-4 py-2 text-left">Created</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No partner leads match your filters.</td></tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{lead.businessName}</td>
                      <td className="px-4 py-2">{lead.contactName}</td>
                      <td className="px-4 py-2">{lead.partnerName || lead.partnerCode || "—"}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium border ${STAGE_BG[lead.status] || "bg-gray-50 border-gray-200"}`}>
                          {STAGE_LABELS[lead.status] || lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${PROTECTION_COLORS[lead.protectionStatus] || ""}`}>
                          {lead.protectionStatus}
                        </span>
                        {lead.invitedAt && (
                          <span className="ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700">Invited</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2"><LeadActions lead={lead} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div className="space-y-3">
          {filteredLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No partner leads match your filters.</p>
          ) : (
            filteredLeads.map((lead) => (
              <Card key={lead.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <button className="text-left flex-1" onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{lead.businessName}</p>
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium border ${STAGE_BG[lead.status]}`}>{STAGE_LABELS[lead.status]}</span>
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${PROTECTION_COLORS[lead.protectionStatus]}`}>{lead.protectionStatus}</span>
                        {lead.invitedAt && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700">Invited</span>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {lead.contactName} · {lead.partnerName || lead.partnerCode || "Unattributed"}
                      </p>
                    </button>
                    <LeadActions lead={lead} />
                  </div>

                  {expandedId === lead.id && (
                    <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{lead.email || "—"}</div>
                      <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{lead.phone || "—"}</div>
                      <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" />{[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "—"}</div>
                      <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" />Created {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}</div>
                      <div><span className="text-muted-foreground">Industry:</span> {lead.industry || "—"} · <span className="text-muted-foreground">Type:</span> {lead.businessType || "—"}</div>
                      <div><span className="text-muted-foreground">Product:</span> {lead.interestedProduct || "—"}</div>
                      <div><span className="text-muted-foreground">Est. branches:</span> {lead.estimatedBranches ?? "—"} · <span className="text-muted-foreground">Users:</span> {lead.estimatedUsers ?? "—"}</div>
                      <div><span className="text-muted-foreground">Deal value:</span> {lead.estimatedDealValue ?? "—"}</div>
                      <div><span className="text-muted-foreground">Protection expires:</span> {lead.protectionExpiresAt ? new Date(lead.protectionExpiresAt).toLocaleDateString() : "—"}</div>
                      {lead.notes && <div className="sm:col-span-2 lg:col-span-3"><span className="text-muted-foreground">Notes:</span> {lead.notes}</div>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Pipeline view */}
      {viewMode === "pipeline" && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {PIPELINE_STAGES.map((stage) => {
              const stageLeads = filteredLeads.filter((l) => l.status === stage)
              return (
                <div key={stage} className={`w-64 shrink-0 rounded-lg border p-3 ${STAGE_BG[stage]}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase">{STAGE_LABELS[stage]}</p>
                    <span className="text-xs text-muted-foreground">{stageLeads.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stageLeads.map((lead) => (
                      <div key={lead.id} className="rounded-md bg-background border border-border p-3 space-y-2">
                        <p className="text-sm font-medium">{lead.businessName}</p>
                        <p className="text-xs text-muted-foreground">{lead.contactName} · {lead.partnerName || "Unattributed"}</p>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${PROTECTION_COLORS[lead.protectionStatus]}`}>{lead.protectionStatus}</span>
                          <select
                            value={lead.status}
                            onChange={(e) => act(lead, "decide", { status: e.target.value })}
                            className="text-[10px] rounded border border-input bg-background px-1 py-0.5"
                          >
                            {PIPELINE_STAGES.map((s) => (
                              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                    {stageLeads.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No leads</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Kanban view */}
      {viewMode === "kanban" && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {KANBAN_STAGES.map((stage) => {
              const stageLeads = filteredLeads.filter((l) => KANBAN_STATUS_MAP[stage].includes(l.status))
              return (
                <div key={stage} className={`w-72 shrink-0 rounded-lg border p-3 ${KANBAN_BG[stage]}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase">{KANBAN_LABELS[stage]}</p>
                    <span className="text-xs text-muted-foreground">{stageLeads.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[80px]">
                    {stageLeads.map((lead) => (
                      <div key={lead.id} className="rounded-md bg-background border border-border p-3 space-y-2 shadow-sm">
                        <div>
                          <p className="text-sm font-medium">{lead.businessName}</p>
                          <p className="text-xs text-muted-foreground">{lead.contactName} · {lead.partnerName || "Unattributed"}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className={`uppercase px-1.5 py-0.5 rounded font-medium ${PROTECTION_COLORS[lead.protectionStatus]}`}>{lead.protectionStatus}</span>
                          <span className={`uppercase px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground`}>{STAGE_LABELS[lead.status]}</span>
                        </div>
                        {lead.notes && <p className="text-[10px] text-muted-foreground line-clamp-2">{lead.notes}</p>}
                        <select
                          value={lead.status}
                          onChange={(e) => act(lead, "decide", { status: e.target.value })}
                          className="w-full text-[10px] rounded border border-input bg-background px-1.5 py-1"
                        >
                          {KANBAN_STAGES.map((ks) => (
                            <optgroup key={ks} label={KANBAN_LABELS[ks]}>
                              {KANBAN_STATUS_MAP[ks].map((s) => (
                                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    ))}
                    {stageLeads.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No leads</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add Lead modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-background p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add Partner Lead</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className={labelCls}>Attributing partner (optional)</label>
              <select className={inputCls} value={addForm.partnerId} onChange={setField("partnerId")}>
                <option value="">None — prospective partner</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.business_name} ({p.partner_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Business name *</label>
                <input required className={inputCls} value={addForm.businessName} onChange={setField("businessName")} />
              </div>
              <div>
                <label className={labelCls}>Contact name *</label>
                <input required className={inputCls} value={addForm.contactName} onChange={setField("contactName")} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Phone *</label>
                <input required className={inputCls} value={addForm.phone} onChange={setField("phone")} />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input required type="email" className={inputCls} value={addForm.email} onChange={setField("email")} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <LocationFields
                country={addForm.country}
                state={addForm.state}
                city={addForm.city}
                onChange={(vals) => setAddForm((f) => ({ ...f, ...vals }))}
                inputClassName={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Industry *</label>
                <select required className={inputCls} value={addForm.industry} onChange={setField("industry")}>
                  <option value="" disabled>Select industry</option>
                  {INDUSTRY_OPTIONS.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Business type *</label>
                <select required className={inputCls} value={addForm.businessType} onChange={setField("businessType")}>
                  <option value="" disabled>Select business type</option>
                  {BUSINESS_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Interested product *</label>
              <select required className={inputCls} value={addForm.interestedProduct} onChange={setField("interestedProduct")}>
                <option value="" disabled>Select product</option>
                {PRODUCT_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Estimated branches</label>
                <input type="number" min={1} className={inputCls} value={addForm.estimatedBranches} onChange={setField("estimatedBranches")} />
              </div>
              <div>
                <label className={labelCls}>Estimated users</label>
                <input type="number" min={1} className={inputCls} value={addForm.estimatedUsers} onChange={setField("estimatedUsers")} />
              </div>
              <div>
                <label className={labelCls}>Estimated deal value</label>
                <input type="number" min={0} step="0.01" className={inputCls} value={addForm.estimatedDealValue} onChange={setField("estimatedDealValue")} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea rows={3} className={inputCls} value={addForm.notes} onChange={setField("notes")} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button size="sm" onClick={addLead} disabled={adding}>
                {adding ? "Adding..." : "Add Lead"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
