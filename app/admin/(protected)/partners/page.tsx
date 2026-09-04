"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Handshake, FileText, Clock, AlertCircle, CheckCircle2, UserCheck, PauseCircle } from "lucide-react"

interface Stats {
  applications: number
  awaitingReview: number
  informationRequired: number
  approved: number
  activePartners: number
  suspendedPartners: number
}

interface AppRow {
  id: string
  reference_number: string
  requested_partner_type: string
  full_name: string
  business_name: string
  email: string
  country: string
  state: string
  city: string
  status: string
  submitted_at: string
}

interface PartnerRow {
  id: string
  partner_id: string
  business_name: string
  display_name: string
  partner_type: string
  status: string
  country: string
  state: string
  city: string
  partner_since: string | null
  public_profile_enabled: boolean
}

const STATUS_FILTERS = ["", "SUBMITTED", "UNDER_REVIEW", "MORE_INFORMATION_REQUIRED", "DISCOVERY_CALL", "APPROVED_CONDITIONAL", "APPROVED", "ACTIVE", "SUSPENDED", "REJECTED"]
const TYPE_FILTERS = ["", "REFERRAL", "CHANNEL", "IMPLEMENTATION", "CHANNEL_IMPLEMENTATION", "TECHNOLOGY", "PAYMENT"]

const TYPE_LABELS: Record<string, string> = {
  REFERRAL: "Referral", CHANNEL: "Channel", IMPLEMENTATION: "Implementation",
  CHANNEL_IMPLEMENTATION: "Channel + Impl", TECHNOLOGY: "Technology", PAYMENT: "Payment",
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-50 text-blue-700",
  UNDER_REVIEW: "bg-indigo-50 text-indigo-700",
  MORE_INFORMATION_REQUIRED: "bg-amber-50 text-amber-700",
  DISCOVERY_CALL: "bg-purple-50 text-purple-700",
  APPROVED_CONDITIONAL: "bg-teal-50 text-teal-700",
  APPROVED: "bg-green-50 text-green-700",
  ACTIVE: "bg-green-100 text-green-800",
  SUSPENDED: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-50 text-red-700",
}

export default function AdminPartnersPage() {
  const [tab, setTab] = useState<"applications" | "partners">("applications")
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [applications, setApplications] = useState<AppRow[]>([])
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [countryFilter, setCountryFilter] = useState("")

  useEffect(() => {
    fetchData()
  }, [statusFilter, typeFilter, countryFilter])

  async function fetchData() {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set("status", statusFilter)
    if (typeFilter) params.set("partnerType", typeFilter)
    if (countryFilter) params.set("country", countryFilter)
    try {
      const res = await fetch(`/api/admin/partners?${params.toString()}`)
      const data = await res.json()
      if (data.stats) setStats(data.stats)
      if (data.applications) setApplications(data.applications)
      if (data.partners) setPartners(data.partners)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Handshake className="w-5 h-5" /> Partners
        </h2>
        <p className="text-muted-foreground">Review partner applications and manage active partners.</p>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={FileText} label="Applications" value={stats?.applications ?? 0} />
        <StatCard icon={Clock} label="Awaiting Review" value={stats?.awaitingReview ?? 0} color="text-blue-600" />
        <StatCard icon={AlertCircle} label="Info Required" value={stats?.informationRequired ?? 0} color="text-amber-600" />
        <StatCard icon={CheckCircle2} label="Approved" value={stats?.approved ?? 0} color="text-green-600" />
        <StatCard icon={UserCheck} label="Active Partners" value={stats?.activePartners ?? 0} color="text-green-600" />
        <StatCard icon={PauseCircle} label="Suspended" value={stats?.suspendedPartners ?? 0} color="text-amber-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        <button onClick={() => setTab("applications")} className={`px-3 py-1.5 text-sm font-medium rounded-md ${tab === "applications" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Applications</button>
        <button onClick={() => setTab("partners")} className={`px-3 py-1.5 text-sm font-medium rounded-md ${tab === "partners" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Partners</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : tab === "applications" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Applications</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All statuses"}</option>)}
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                {TYPE_FILTERS.map((t) => <option key={t} value={t}>{t ? TYPE_LABELS[t] : "All types"}</option>)}
              </select>
              <input placeholder="Country" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm w-32" />
            </div>

            {applications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No applications found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3">Reference</th>
                      <th className="py-2 pr-3">Applicant</th>
                      <th className="py-2 pr-3">Business</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Location</th>
                      <th className="py-2 pr-3">Submitted</th>
                      <th className="py-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((a) => (
                      <tr key={a.id} className="border-b border-border hover:bg-muted/30">
                        <td className="py-2 pr-3"><Link href={`/admin/partners/applications/${a.id}`} className="font-medium text-retail hover:underline">{a.reference_number}</Link></td>
                        <td className="py-2 pr-3">{a.full_name}</td>
                        <td className="py-2 pr-3">{a.business_name || "—"}</td>
                        <td className="py-2 pr-3">{TYPE_LABELS[a.requested_partner_type] || a.requested_partner_type}</td>
                        <td className="py-2 pr-3">{[a.city, a.state, a.country].filter(Boolean).join(", ") || "—"}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : "—"}</td>
                        <td className="py-2 pr-3"><span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[a.status] || "bg-gray-100 text-gray-700"}`}>{a.status.replace(/_/g, " ")}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Partners</CardTitle></CardHeader>
          <CardContent>
            {partners.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No partners yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3">Partner ID</th>
                      <th className="py-2 pr-3">Business</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Location</th>
                      <th className="py-2 pr-3">Since</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Public</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((p) => (
                      <tr key={p.id} className="border-b border-border hover:bg-muted/30">
                        <td className="py-2 pr-3 font-mono text-xs"><Link href={`/admin/partners/${p.id}`} className="text-retail hover:underline">{p.partner_id}</Link></td>
                        <td className="py-2 pr-3"><Link href={`/admin/partners/${p.id}`} className="hover:underline">{p.display_name || p.business_name}</Link></td>
                        <td className="py-2 pr-3">{TYPE_LABELS[p.partner_type] || p.partner_type}</td>
                        <td className="py-2 pr-3">{[p.city, p.state, p.country].filter(Boolean).join(", ") || "—"}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{p.partner_since ? new Date(p.partner_since).toLocaleDateString() : "—"}</td>
                        <td className="py-2 pr-3"><span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-700"}`}>{p.status}</span></td>
                        <td className="py-2 pr-3">{p.public_profile_enabled ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 mb-1"><Icon className="w-4 h-4 text-muted-foreground" /><p className="text-xs uppercase text-muted-foreground">{label}</p></div>
      <p className={`text-2xl font-bold ${color || ""}`}>{value}</p>
    </CardContent></Card>
  )
}
