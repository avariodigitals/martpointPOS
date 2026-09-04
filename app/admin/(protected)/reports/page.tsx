"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Download, Landmark, Users, Handshake, Ticket, Shield } from "lucide-react"
import {
  commercialReport,
  customersReport,
  partnersReport,
  supportReport,
  operationsReport,
  type ReportPeriod,
  type CommercialReport,
  type CustomerReport,
  type PartnerReport,
  type SupportReport,
  type OperationsReport,
} from "@/lib/reports"

type ReportTab = "commercial" | "customers" | "partners" | "support" | "operations"

type ReportData =
  | CommercialReport
  | CustomerReport
  | PartnerReport
  | SupportReport
  | OperationsReport

const TABS: { key: ReportTab; label: string; icon: React.ElementType }[] = [
  { key: "commercial", label: "Commercial", icon: Landmark },
  { key: "customers", label: "Customers", icon: Users },
  { key: "partners", label: "Partners", icon: Handshake },
  { key: "support", label: "Support", icon: Ticket },
  { key: "operations", label: "Operations", icon: Shield },
]

const PERIODS: ReportPeriod[] = ["today", "7d", "30d", "this_month", "quarter", "year"]

function formatMoney(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`
  if (n === 0) return "₦0"
  return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function formatNumber(n: number) {
  return n.toLocaleString()
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground tracking-wider">{title}</p>
        <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}

function csvEscape(v: unknown) {
  const s = String(v ?? "")
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, "\"\"")}"`
  return s
}

function line(cells: unknown[]) {
  return cells.map(csvEscape).join(",")
}

function commercialCsv(d: CommercialReport) {
  const lines = [
    line(["Metric", "Value"]),
    line(["Revenue collected", d.revenue_collected]),
    line(["Outstanding invoices", d.outstanding_invoices]),
    line(["Outstanding balance", d.outstanding_balance]),
    line(["Overdue invoices", d.overdue_invoices]),
    line(["Overdue balance", d.overdue_balance]),
    line(["Renewals due", d.renewals_due]),
    line(["Commission liability", d.commission_liability]),
    line(["Commission paid", d.commission_paid]),
    "",
    line(["Product/Plan", "Type", "Count", "Revenue"]),
    ...d.revenue_by_product_plan.map((r) =>
      line([r.name, r.item_type, r.count, r.revenue])
    ),
  ]
  return lines.join("\n")
}

function customersCsv(d: CustomerReport) {
  const lines = [
    line(["Metric", "Value"]),
    line(["Active businesses", d.active_businesses]),
    line(["New businesses", d.new_businesses]),
    line(["Onboarding", d.onboarding]),
    line(["At-risk", d.at_risk]),
    line(["Churned", d.churned]),
    line(["Renewals", d.renewals]),
    "",
    line(["Health", "Count"]),
    ...d.health_distribution.map((r) => line([r.health, r.count])),
  ]
  return lines.join("\n")
}

function partnersCsv(d: PartnerReport) {
  const lines = [
    line(["Metric", "Value"]),
    line(["Applications", d.applications]),
    line(["Active partners", d.active_partners]),
    line(["Partner leads", d.partner_leads]),
    line(["Won opportunities", d.won_opportunities]),
    line(["Partner-sourced businesses", d.partner_sourced_businesses]),
    line(["Attributed revenue", d.attributed_revenue]),
    line(["Commission earned", d.commission_earned]),
    line(["Commission paid", d.commission_paid]),
  ]
  return lines.join("\n")
}

function supportCsv(d: SupportReport) {
  const lines = [
    line(["Metric", "Value"]),
    line(["Tickets opened", d.tickets_opened]),
    line(["Tickets resolved", d.tickets_resolved]),
    line(["Open backlog", d.open_backlog]),
    line(["SLA breaches", d.sla_breaches]),
    line(["Escalations", d.escalations]),
    "",
    line(["Category", "Count"]),
    ...d.category_distribution.map((r) => line([r.category, r.count])),
    "",
    line(["Priority", "Count"]),
    ...d.priority_distribution.map((r) => line([r.priority, r.count])),
  ]
  return lines.join("\n")
}

function operationsCsv(d: OperationsReport) {
  const lines = [
    line(["Metric", "Value"]),
    line(["Pending deployments", d.pending_deployments]),
    line(["Onboarding awaiting review", d.onboarding_awaiting_review]),
    line(["Compliance outstanding", d.compliance_outstanding]),
    line(["Open incidents", d.open_incidents]),
    line(["Critical incidents", d.critical_incidents]),
  ]
  return lines.join("\n")
}

function buildCsv(tab: ReportTab, d: ReportData | undefined) {
  if (!d) return ""
  switch (tab) {
    case "commercial":
      return commercialCsv(d as CommercialReport)
    case "customers":
      return customersCsv(d as CustomerReport)
    case "partners":
      return partnersCsv(d as PartnerReport)
    case "support":
      return supportCsv(d as SupportReport)
    case "operations":
      return operationsCsv(d as OperationsReport)
  }
}

function downloadCsv(tab: ReportTab, d: ReportData | undefined, period: ReportPeriod) {
  if (!d) return
  const csv = buildCsv(tab, d)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${tab}-report-${period}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("commercial")
  const [period, setPeriod] = useState<ReportPeriod>("30d")
  const [data, setData] = useState<Partial<Record<ReportTab, ReportData>>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      let result: ReportData | null = null
      try {
        switch (activeTab) {
          case "commercial":
            result = await commercialReport(period)
            break
          case "customers":
            result = await customersReport(period)
            break
          case "partners":
            result = await partnersReport(period)
            break
          case "support":
            result = await supportReport(period)
            break
          case "operations":
            result = await operationsReport(period)
            break
        }
      } catch (err) {
        console.error("Failed to load report:", err)
      }

      if (!cancelled && result) {
        setData((prev) => ({ ...prev, [activeTab]: result }))
      }
      if (!cancelled) setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [activeTab, period])

  const currentData = data[activeTab]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
          <p className="text-muted-foreground">Cross-module operational reporting centre.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {p === "today"
                  ? "Today"
                  : p === "7d"
                    ? "Last 7 days"
                    : p === "30d"
                      ? "Last 30 days"
                      : p === "this_month"
                        ? "This month"
                        : p === "quarter"
                          ? "This quarter"
                          : "This year"}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(activeTab, currentData, period)}
            disabled={!currentData || loading}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = tab.key === activeTab
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-retail text-retail"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading && !currentData ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : currentData ? (
        <div className="space-y-6">
          {activeTab === "commercial" && (
            <CommercialContent data={currentData as CommercialReport} />
          )}
          {activeTab === "customers" && (
            <CustomersContent data={currentData as CustomerReport} />
          )}
          {activeTab === "partners" && (
            <PartnersContent data={currentData as PartnerReport} />
          )}
          {activeTab === "support" && (
            <SupportContent data={currentData as SupportReport} />
          )}
          {activeTab === "operations" && (
            <OperationsContent data={currentData as OperationsReport} />
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">Failed to load report data.</p>
      )}
    </div>
  )
}

function CommercialContent({ data }: { data: CommercialReport }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Revenue collected" value={formatMoney(data.revenue_collected)} />
        <MetricCard title="Outstanding invoices" value={formatNumber(data.outstanding_invoices)} />
        <MetricCard title="Overdue invoices" value={formatNumber(data.overdue_invoices)} />
        <MetricCard title="Renewals due" value={formatNumber(data.renewals_due)} />
        <MetricCard title="Commission liability" value={formatMoney(data.commission_liability)} />
        <MetricCard title="Commission paid" value={formatMoney(data.commission_paid)} />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Revenue by product / plan</CardTitle>
        </CardHeader>
        <CardContent>
          {data.revenue_by_product_plan.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revenue data for this period.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Item</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-right">Count</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revenue_by_product_plan.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2">{row.name}</td>
                      <td className="px-4 py-2">{row.item_type}</td>
                      <td className="px-4 py-2 text-right">{formatNumber(row.count)}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(row.revenue)}</td>
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

function CustomersContent({ data }: { data: CustomerReport }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Active businesses" value={formatNumber(data.active_businesses)} />
        <MetricCard title="New businesses" value={formatNumber(data.new_businesses)} />
        <MetricCard title="Onboarding" value={formatNumber(data.onboarding)} />
        <MetricCard title="At-risk" value={formatNumber(data.at_risk)} />
        <MetricCard title="Churned" value={formatNumber(data.churned)} />
        <MetricCard title="Renewals" value={formatNumber(data.renewals)} />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Health distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {data.health_distribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">No health data.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Health</th>
                    <th className="px-4 py-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.health_distribution.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2">{row.health}</td>
                      <td className="px-4 py-2 text-right">{formatNumber(row.count)}</td>
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

function PartnersContent({ data }: { data: PartnerReport }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Applications" value={formatNumber(data.applications)} />
        <MetricCard title="Active partners" value={formatNumber(data.active_partners)} />
        <MetricCard title="Partner leads" value={formatNumber(data.partner_leads)} />
        <MetricCard title="Won opportunities" value={formatNumber(data.won_opportunities)} />
        <MetricCard title="Partner-sourced businesses" value={formatNumber(data.partner_sourced_businesses)} />
        <MetricCard title="Attributed revenue" value={formatMoney(data.attributed_revenue)} />
        <MetricCard title="Commission earned" value={formatMoney(data.commission_earned)} />
        <MetricCard title="Commission paid" value={formatMoney(data.commission_paid)} />
      </div>
    </div>
  )
}

function SupportContent({ data }: { data: SupportReport }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Tickets opened" value={formatNumber(data.tickets_opened)} />
        <MetricCard title="Tickets resolved" value={formatNumber(data.tickets_resolved)} />
        <MetricCard title="Open backlog" value={formatNumber(data.open_backlog)} />
        <MetricCard title="SLA breaches" value={formatNumber(data.sla_breaches)} />
        <MetricCard title="Escalations" value={formatNumber(data.escalations)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Category distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {data.category_distribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data for this period.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.category_distribution.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-2">{row.category}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(row.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Priority distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {data.priority_distribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data for this period.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left">Priority</th>
                      <th className="px-4 py-2 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.priority_distribution.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-2">{row.priority}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(row.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function OperationsContent({ data }: { data: OperationsReport }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Pending deployments" value={formatNumber(data.pending_deployments)} />
        <MetricCard title="Onboarding awaiting review" value={formatNumber(data.onboarding_awaiting_review)} />
        <MetricCard title="Compliance outstanding" value={formatNumber(data.compliance_outstanding)} />
        <MetricCard title="Open incidents" value={formatNumber(data.open_incidents)} />
        <MetricCard title="Critical incidents" value={formatNumber(data.critical_incidents)} />
      </div>
    </div>
  )
}
