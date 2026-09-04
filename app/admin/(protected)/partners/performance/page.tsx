"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowLeft, BarChart3 } from "lucide-react"

interface PerfRow {
  partnerId: string
  partnerCode: string
  businessName: string
  partnerType: string
  status: string
  location: string
  country: string
  state: string
  hasLeadCapability: boolean
  hasCustomerCapability: boolean
  hasImplementationCapability: boolean
  hasSupportCapability: boolean
  hasCommercialCapability: boolean
  leadsRegistered: number
  protectedLeads: number
  wonBusinesses: number
  assignedCustomers: number
  attributedRevenue: number
  currency: string
  commissionEarned: number
  commissionPaid: number
  complianceStatus: string
  onboardingCompleted: number
  onboardingTotal: number
  supportTicketsHandled: number
  escalations: number
}

const TYPE_FILTERS = ["", "REFERRAL", "CHANNEL", "IMPLEMENTATION", "CHANNEL_IMPLEMENTATION", "TECHNOLOGY", "PAYMENT"]
const STATUS_FILTERS = ["", "PENDING_ACTIVATION", "ACTIVE", "SUSPENDED", "INACTIVE", "TERMINATED"]
const PERIOD_FILTERS = ["ALL", "30D", "90D", "12M"]

const TYPE_LABELS: Record<string, string> = {
  REFERRAL: "Referral",
  CHANNEL: "Channel",
  IMPLEMENTATION: "Implementation",
  CHANNEL_IMPLEMENTATION: "Channel + Impl",
  TECHNOLOGY: "Technology",
  PAYMENT: "Payment",
}

const COMPLIANCE_COLORS: Record<string, string> = {
  COMPLIANT: "bg-green-100 text-green-800",
  PENDING: "bg-amber-50 text-amber-700",
  ATTENTION: "bg-red-50 text-red-700",
  NOT_REQUIRED: "bg-gray-50 text-gray-500",
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

function NA({ show, children }: { show: boolean; children: React.ReactNode }) {
  return <td className="px-3 py-2 text-right">{show ? children : <span className="text-muted-foreground">—</span>}</td>
}

export default function PartnerPerformancePage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<PerfRow[]>([])
  const [partnerType, setPartnerType] = useState("")
  const [status, setStatus] = useState("")
  const [country, setCountry] = useState("")
  const [state, setState] = useState("")
  const [period, setPeriod] = useState("ALL")
  const [countryOptions, setCountryOptions] = useState<string[]>([])
  const [stateOptions, setStateOptions] = useState<string[]>([])

  async function fetchRows(withFilters: boolean) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (withFilters) {
        if (partnerType) params.set("partnerType", partnerType)
        if (status) params.set("status", status)
        if (country) params.set("country", country)
        if (state) params.set("state", state)
        params.set("period", period)
      }
      const res = await fetch(`/api/admin/partners/performance?${params.toString()}`)
      const data = await res.json()
      const r: PerfRow[] = data.rows || []
      setRows(r)
      // Accumulate filter options so they don't disappear while filtering
      setCountryOptions((prev) => Array.from(new Set([...prev, ...r.map((x) => x.country).filter(Boolean)])).sort())
      setStateOptions((prev) => Array.from(new Set([...prev, ...r.map((x) => x.state).filter(Boolean)])).sort())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRows(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerType, status, country, state, period])

  // Column groups only render when at least one visible partner has the relevant capability
  const showLeadCols = rows.some((r) => r.hasLeadCapability)
  const showCustomerCol = rows.some((r) => r.hasCustomerCapability)
  const showCommercialCols = rows.some((r) => r.hasCommercialCapability)
  const showOnboardingCol = rows.some((r) => r.hasImplementationCapability)
  const showSupportCols = rows.some((r) => r.hasSupportCapability)

  const selectCls = "rounded-md border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/partners" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Partners
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <BarChart3 className="w-6 h-6" /> Partner Performance
        </h2>
        <p className="text-muted-foreground text-sm">
          Per-dimension performance metrics. Columns are only shown where relevant to a partner&apos;s type and capabilities.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <select value={partnerType} onChange={(e) => setPartnerType(e.target.value)} className={selectCls}>
              {TYPE_FILTERS.map((t) => <option key={t} value={t}>{t ? (TYPE_LABELS[t] || t) : "All types"}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
              {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All statuses"}</option>)}
            </select>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={selectCls}>
              <option value="">All countries</option>
              {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={state} onChange={(e) => setState(e.target.value)} className={selectCls}>
              <option value="">All states</option>
              {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className={selectCls}>
              {PERIOD_FILTERS.map((p) => (
                <option key={p} value={p}>
                  {p === "ALL" ? "All time" : p === "30D" ? "Last 30 days" : p === "90D" ? "Last 90 days" : "Last 12 months"}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No partners match the selected filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Partner</th>
                    <th className="px-3 py-2 font-medium">Partner ID</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Location</th>
                    {showLeadCols && (
                      <>
                        <th className="px-3 py-2 font-medium text-right">Leads</th>
                        <th className="px-3 py-2 font-medium text-right">Protected</th>
                        <th className="px-3 py-2 font-medium text-right">Won</th>
                      </>
                    )}
                    {showCustomerCol && <th className="px-3 py-2 font-medium text-right">Customers</th>}
                    {showCommercialCols && (
                      <>
                        <th className="px-3 py-2 font-medium text-right">Attr. Revenue</th>
                        <th className="px-3 py-2 font-medium text-right">Comm. Earned</th>
                        <th className="px-3 py-2 font-medium text-right">Comm. Paid</th>
                      </>
                    )}
                    <th className="px-3 py-2 font-medium">Compliance</th>
                    {showOnboardingCol && <th className="px-3 py-2 font-medium text-right">Onboarding</th>}
                    {showSupportCols && (
                      <>
                        <th className="px-3 py-2 font-medium text-right">Tickets</th>
                        <th className="px-3 py-2 font-medium text-right">Escalations</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.partnerId} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <Link href={`/admin/partners/${r.partnerId}`} className="font-medium text-retail hover:underline">
                          {r.businessName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.partnerCode}</td>
                      <td className="px-3 py-2">{TYPE_LABELS[r.partnerType] || r.partnerType}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full ${r.status === "ACTIVE" ? "bg-green-100 text-green-800" : r.status === "SUSPENDED" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.location || "—"}</td>
                      {showLeadCols && (
                        <>
                          <NA show={r.hasLeadCapability}>{r.leadsRegistered}</NA>
                          <NA show={r.hasLeadCapability}>{r.protectedLeads}</NA>
                          <NA show={r.hasLeadCapability}>{r.wonBusinesses}</NA>
                        </>
                      )}
                      {showCustomerCol && <NA show={r.hasCustomerCapability}>{r.assignedCustomers}</NA>}
                      {showCommercialCols && (
                        <>
                          <NA show={r.hasCommercialCapability}>{formatMoney(r.attributedRevenue, r.currency)}</NA>
                          <NA show={r.hasCommercialCapability}>{formatMoney(r.commissionEarned, r.currency)}</NA>
                          <NA show={r.hasCommercialCapability}>{formatMoney(r.commissionPaid, r.currency)}</NA>
                        </>
                      )}
                      <td className="px-3 py-2">
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full ${COMPLIANCE_COLORS[r.complianceStatus] || "bg-gray-50 text-gray-500"}`}>
                          {r.complianceStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                      {showOnboardingCol && (
                        <NA show={r.hasImplementationCapability}>
                          {r.onboardingCompleted}/{r.onboardingTotal}
                        </NA>
                      )}
                      {showSupportCols && (
                        <>
                          <NA show={r.hasSupportCapability}>{r.supportTicketsHandled}</NA>
                          <NA show={r.hasSupportCapability}>
                            {r.escalations > 0 ? <span className="text-red-600 font-medium">{r.escalations}</span> : 0}
                          </NA>
                        </>
                      )}
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
