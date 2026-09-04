"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Building2, Plus, ArrowRight, X } from "lucide-react"

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const counts = {
    total: businesses.length,
    active: businesses.filter((b) => b.status === "ACTIVE").length,
    onboarding: businesses.filter((b) => b.status === "ONBOARDING").length,
    suspended: businesses.filter((b) => b.status === "SUSPENDED").length,
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
        <Button onClick={openConvert}>
          <Plus className="w-4 h-4 mr-1" /> Create Business from Lead
        </Button>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("created") ? "text-green-600" : "text-red-500"}`}>{message}</p>
      )}

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
            <p className="text-xs text-muted-foreground mt-3">
              Historical backfill: run <code className="bg-muted px-1 rounded">npx tsx scripts/backfill-businesses.ts</code> (preview) or with <code className="bg-muted px-1 rounded">--apply</code>.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Building2 className="w-4 h-4" /> Business List</CardTitle>
        </CardHeader>
        <CardContent>
          {businesses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3" />
              <p className="text-sm">No businesses yet. Convert a Won lead to create one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {businesses.map((b) => (
                <Link
                  key={b.id}
                  href={`/admin/businesses/${b.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{b.businessName}</p>
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[b.status] || "bg-gray-100 text-gray-700"}`}>{b.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{b.primaryContactName} · {b.primaryEmail} · {b.primaryPhone}</p>
                    <p className="text-xs text-muted-foreground">{[b.city, b.state, b.country].filter(Boolean).join(", ") || "No location"} · {b.businessType || "No type"} · Source: {b.source}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
