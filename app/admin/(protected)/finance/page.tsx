"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Landmark,
  TrendingUp,
  TrendingDown,
  Users,
  Flame,
  Wallet,
  PiggyBank,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import Link from "next/link"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface FinanceSummary {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  grossMargin: number
  mrr: number
  arr: number
  burnRate: number
  runwayMonths: number
  customerCount: number
  revenuePerCustomer: number
  cac: number
  ltv: number
  ltvCacRatio: number
  expenseByCategory: Record<string, number>
  revenueByCategory: Record<string, number>
  monthlyTrend: Array<{ month: string; revenue: number; expenses: number; profit: number }>
}

const COLORS = ["#0057FF", "#00C853", "#FF9800", "#E91E63", "#9C27B0", "#00BCD4", "#FF5722", "#607D8B"]

function formatNgn(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  positive,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  trend?: string
  positive?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            {trend && (
              <div className={`flex items-center gap-1 text-xs font-medium ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                {positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {trend}
              </div>
            )}
          </div>
          <div className="p-2.5 rounded-lg bg-muted">
            <Icon className="w-5 h-5 text-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function FinanceDashboardPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/finance?action=summary")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSummary(data.summary)
      })
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [])

  const expensePieData = useMemo(() => {
    if (!summary) return []
    return Object.entries(summary.expenseByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [summary])

  const revenuePieData = useMemo(() => {
    if (!summary) return []
    return Object.entries(summary.revenueByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [summary])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="w-5 h-5" />
            Finance & Investor Dashboard
          </h2>
          <p className="text-muted-foreground">Track revenue, expenses, and investor KPIs.</p>
        </div>
        <p className="text-muted-foreground">Failed to load financial data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="w-5 h-5" />
            Finance & Investor Dashboard
          </h2>
          <p className="text-muted-foreground">Track revenue, expenses, and investor KPIs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/finance/transactions">Manage Transactions</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/finance/reports">View Reports</Link>
          </Button>
        </div>
      </div>

      {/* Investor KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Investor Metrics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="MRR" value={formatNgn(summary.mrr)} sub="Monthly Recurring Revenue" icon={TrendingUp} trend="+0% vs last month" positive />
          <KpiCard title="ARR" value={formatNgn(summary.arr)} sub="Annual Recurring Revenue" icon={Target} />
          <KpiCard title="Customers" value={String(summary.customerCount)} sub="Converted leads" icon={Users} />
          <KpiCard title="Revenue/Customer" value={formatNgn(summary.revenuePerCustomer)} sub="ARPU (Annual)" icon={Wallet} />
          <KpiCard title="CAC" value={formatNgn(summary.cac)} sub="Customer Acquisition Cost" icon={TrendingDown} />
          <KpiCard title="LTV" value={formatNgn(summary.ltv)} sub="Lifetime Value" icon={PiggyBank} />
          <KpiCard title="LTV:CAC Ratio" value={summary.ltvCacRatio.toFixed(1) + "x"} sub={summary.ltvCacRatio >= 3 ? "Healthy" : summary.ltvCacRatio >= 1 ? "Acceptable" : "Needs Work"} icon={TrendingUp} positive={summary.ltvCacRatio >= 3} />
          <KpiCard title="Gross Margin" value={summary.grossMargin.toFixed(1) + "%"} sub="Net profit / Revenue" icon={Flame} positive={summary.grossMargin > 0} />
        </div>
      </div>

      {/* Financial Overview */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financial Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Revenue" value={formatNgn(summary.totalRevenue)} icon={TrendingUp} positive />
          <KpiCard title="Total Expenses" value={formatNgn(summary.totalExpenses)} icon={TrendingDown} />
          <KpiCard title="Net Profit" value={formatNgn(summary.netProfit)} icon={Wallet} positive={summary.netProfit > 0} />
          <KpiCard title="Burn Rate" value={formatNgn(summary.burnRate) + "/mo"} sub={`Runway: ${summary.runwayMonths >= 999 ? "∞" : summary.runwayMonths.toFixed(1) + " months"}`} icon={Flame} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expense Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue vs Expenses Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0057FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0057FF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF5722" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF5722" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatNgn(v)} />
                  <Tooltip formatter={(v: number) => formatNgn(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="#0057FF" fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                  <Area type="monotone" dataKey="expenses" stroke="#FF5722" fillOpacity={1} fill="url(#colorExp)" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Profit Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Profit Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatNgn(v)} />
                  <Tooltip formatter={(v: number) => formatNgn(v)} />
                  <Bar dataKey="profit" fill="#00C853" radius={[4, 4, 0, 0]} name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {expensePieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatNgn(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {expensePieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-medium">{formatNgn(entry.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenuePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {revenuePieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatNgn(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {revenuePieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-medium">{formatNgn(entry.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
