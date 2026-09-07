"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Building2, Plus, ArrowRight, X, Search, CheckCircle2, Ban, PauseCircle, Trash2, Save } from "lucide-react"
import { LocationFields } from "@/components/location-fields"

interface Business {
  id: string
  businessName: string
  primaryContactName: string
  primaryEmail: string
  primaryPhone: string
  businessType: string
  industry: string
  country: string
  state: string
  city: string
  status: string
  source: string
  sourceLeadId: string | null
  createdAt: string
}

import type { BusinessStatus, BusinessSource } from "@/lib/businesses"

interface ConvertibleLead {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  businessType: string
  productInterest: string
  source: string
  submittedAt: string
}

const STATUS_COLORS: Record<string, string> = {
  PROSPECT: "bg-gray-100 text-gray-700",
  ONBOARDING: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-50 text-green-700",
  SUSPENDED: "bg-amber-50 text-amber-700",
  INACTIVE: "bg-gray-100 text-gray-500",
  CHURNED: "bg-red-50 text-red-700",
}

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [showConvert, setShowConvert] = useState(false)
  const [leads, setLeads] = useState<ConvertibleLead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Manual create business modal
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    businessName: "",
    legalName: "",
    primaryContactName: "",
    primaryEmail: "",
    primaryPhone: "",
    businessType: "",
    industry: "",
    country: "Nigeria",
    state: "",
    city: "",
    address: "",
    website: "",
    status: "ONBOARDING" as BusinessStatus,
    source: "DIRECT" as BusinessSource,
  })

  useEffect(() => {
    fetchBusinesses()
  }, [])

  async function fetchBusinesses() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/businesses")
      const data = await res.json()
      if (data.businesses) setBusinesses(data.businesses)
    } catch {
      setMessage("Failed to load businesses")
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id)
    setMessage("")
    try {
      const res = await fetch("/api/admin/businesses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      const data = await res.json()
      if (data.success && data.business) {
        setBusinesses((prev) => prev.map((b) => (b.id === id ? { ...b, status: data.business.status } : b)))
        setMessage(`Business ${status.toLowerCase()}.`)
      } else {
        setMessage(data.error || "Failed to update status")
      }
    } catch {
      setMessage("Failed to update status")
    } finally {
      setUpdatingId(null)
    }
  }

  async function createBusinessManually() {
    setCreating(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createForm }),
      })
      const data = await res.json()
      if (data.success && data.business) {
        setBusinesses((prev) => [data.business, ...prev])
        setShowCreate(false)
        setCreateForm({
          businessName: "",
          legalName: "",
          primaryContactName: "",
          primaryEmail: "",
          primaryPhone: "",
          businessType: "",
          industry: "",
          country: "Nigeria",
          state: "",
          city: "",
          address: "",
          website: "",
          status: "ONBOARDING",
          source: "DIRECT",
        })
        setMessage(`Business ${data.business.businessName} created.`)
      } else {
        setMessage(data.error || "Failed to create business")
      }
    } catch {
      setMessage("Failed to create business")
    } finally {
      setCreating(false)
    }
  }

  async function removeBusiness(id: string) {
    if (!confirm("Are you sure you want to delete this business? This cannot be undone.")) return
    setDeletingId(id)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/businesses?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setBusinesses((prev) => prev.filter((b) => b.id !== id))
        setMessage("Business deleted.")
      } else {
        setMessage(data.error || "Failed to delete business")
      }
    } catch {
      setMessage("Failed to delete business")
    } finally {
      setDeletingId(null)
    }
  }

  async function openConvert() {
    setShowConvert(true)
    setLeadsLoading(true)
    try {
      const res = await fetch("/api/admin/businesses/convertible-leads")
      const data = await res.json()
      if (data.leads) setLeads(data.leads)
    } catch {
      setMessage("Failed to load leads")
    } finally {
      setLeadsLoading(false)
    }
  }

  async function convertLead(leadId: string) {
    setConvertingId(leadId)
    setMessage("")
    try {
      const res = await fetch("/api/admin/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage(`Business created for ${data.business.businessName}.`)
        setLeads((prev) => prev.filter((l) => l.id !== leadId))
        fetchBusinesses()
      } else {
        setMessage(data.error || "Failed to convert lead")
      }
    } catch {
      setMessage("Failed to convert lead")
    } finally {
      setConvertingId(null)
    }
  }

  const counts = useMemo(() => {
    return {
      total: businesses.length,
      active: businesses.filter((b) => b.status === "ACTIVE").length,
      onboarding: businesses.filter((b) => b.status === "ONBOARDING").length,
      suspended: businesses.filter((b) => b.status === "SUSPENDED").length,
    }
  }, [businesses])

  const filteredBusinesses = useMemo(() => {
    let list = businesses
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (b) =>
          b.businessName.toLowerCase().includes(q) ||
          b.primaryContactName.toLowerCase().includes(q) ||
          b.primaryEmail.toLowerCase().includes(q) ||
          b.primaryPhone.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== "all") {
      list = list.filter((b) => b.status === statusFilter)
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [businesses, searchQuery, statusFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Businesses
          </h2>
          <p className="text-muted-foreground">
            Canonical customer/tenant records. Convert Won leads into businesses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openConvert}>
            <Plus className="w-4 h-4 mr-1" /> From Lead
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create Business
          </Button>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("created") || message.includes("active") || message.includes("suspend") || message.includes("inactiv") || message.includes("deleted") ? "text-green-600" : "text-red-500"}`}>{message}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search businesses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ONBOARDING">Onboarding</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="INACTIVE">Inactive</option>
          <option value="CHURNED">Churned</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total</p><p className="text-2xl font-bold">{counts.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-600">{counts.active}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Onboarding</p><p className="text-2xl font-bold text-blue-600">{counts.onboarding}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Suspended</p><p className="text-2xl font-bold text-amber-600">{counts.suspended}</p></CardContent></Card>
      </div>

      {showConvert && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Won leads ready to convert</CardTitle>
            <button onClick={() => setShowConvert(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </CardHeader>
          <CardContent>
            {leadsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : leads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No Won leads awaiting conversion. All Won leads already have a business record.</p>
            ) : (
              <div className="space-y-2">
                {leads.map((lead) => (
                  <div key={lead.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-md border border-border bg-muted/10">
                    <div>
                      <p className="text-sm font-semibold">{lead.businessName}</p>
                      <p className="text-xs text-muted-foreground">{lead.fullName} · {lead.email} · {lead.phone}</p>
                      <p className="text-xs text-muted-foreground">{lead.businessType} · {lead.productInterest === "erp" ? "ERP" : "Retail"} · {lead.source}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => convertLead(lead.id)}
                      disabled={convertingId === lead.id}
                    >
                      {convertingId === lead.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Create Business
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Building2 className="w-4 h-4" /> Business List</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredBusinesses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3" />
              <p className="text-sm">No businesses found matching your filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBusinesses.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <Link href={`/admin/businesses/${b.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{b.businessName}</p>
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[b.status] || "bg-gray-100 text-gray-700"}`}>{b.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{b.primaryContactName} · {b.primaryEmail} · {b.primaryPhone}</p>
                    <p className="text-xs text-muted-foreground">{[b.city, b.state, b.country].filter(Boolean).join(", ") || "No location"} · {b.businessType || "No type"} · Source: {b.source}</p>
                  </Link>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/admin/businesses/${b.id}`}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="View"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    {b.status !== "ACTIVE" && (
                      <button
                        onClick={() => updateStatus(b.id, "ACTIVE")}
                        disabled={updatingId === b.id}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors"
                        title="Activate"
                      >
                        {updatingId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    )}
                    {b.status !== "SUSPENDED" && (
                      <button
                        onClick={() => updateStatus(b.id, "SUSPENDED")}
                        disabled={updatingId === b.id}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="Suspend"
                      >
                        {updatingId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" />}
                      </button>
                    )}
                    {b.status !== "INACTIVE" && (
                      <button
                        onClick={() => updateStatus(b.id, "INACTIVE")}
                        disabled={updatingId === b.id}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Deactivate"
                      >
                        {updatingId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={() => removeBusiness(b.id)}
                      disabled={deletingId === b.id}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-700 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      {deletingId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create Business</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Business name *</label>
                <input
                  type="text"
                  value={createForm.businessName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, businessName: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Alpha Retail Ltd"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Legal name</label>
                <input
                  type="text"
                  value={createForm.legalName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, legalName: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Primary contact *</label>
                <input
                  type="text"
                  value={createForm.primaryContactName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, primaryContactName: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={createForm.primaryEmail}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, primaryEmail: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Phone *</label>
                <input
                  type="tel"
                  value={createForm.primaryPhone}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, primaryPhone: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Business type</label>
                <input
                  type="text"
                  value={createForm.businessType}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, businessType: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Retail, ERP"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Industry</label>
                <input
                  type="text"
                  value={createForm.industry}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, industry: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <LocationFields
                country={createForm.country}
                state={createForm.state}
                city={createForm.city}
                onChange={(vals) => setCreateForm((prev) => ({ ...prev, ...vals }))}
                inputClassName="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div>
                <label className="block text-xs font-medium mb-1">Address</label>
                <input
                  type="text"
                  value={createForm.address}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Website</label>
                <input
                  type="url"
                  value={createForm.website}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, website: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Status</label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value as BusinessStatus }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {["PROSPECT", "ONBOARDING", "ACTIVE", "SUSPENDED", "INACTIVE", "CHURNED"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Source</label>
                <select
                  value={createForm.source}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, source: e.target.value as BusinessSource }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {["DIRECT", "PARTNER", "REFERRAL", "WEBSITE", "SOCIAL", "CAMPAIGN", "OTHER"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
                Cancel
              </Button>
              <Button
                onClick={createBusinessManually}
                disabled={
                  creating ||
                  !createForm.businessName ||
                  !createForm.primaryContactName ||
                  !createForm.primaryEmail ||
                  !createForm.primaryPhone ||
                  !createForm.country ||
                  !createForm.state ||
                  !createForm.city
                }
              >
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Create Business
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
