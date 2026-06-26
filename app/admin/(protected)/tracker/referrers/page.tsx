"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Globe, TrendingUp, MousePointerClick } from "lucide-react"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface TrafficData {
  totalClicks: number
  sources: Array<{ name: string; count: number }>
  dailyTrend: Array<Record<string, number | string>>
  topPages: Array<{ path: string; count: number }>
  period: string
}

const COLORS = ["#0057FF", "#00C853", "#FF9800", "#E91E63", "#9C27B0", "#00BCD4", "#FF5722", "#607D8B", "#8BC34A", "#3F51B5"]

export default function TrafficReferrersPage() {
  const [data, setData] = useState<TrafficData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("30d")

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/traffic?period=${period}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled && json) setData(json) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [period])

  const pieData = useMemo(() => data?.sources || [], [data])
  const dailyKeys = useMemo(() => {
    if (!data?.dailyTrend?.length) return []
    return Object.keys(data.dailyTrend[0]).filter((k) => k !== "day")
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Traffic Sources
        </h2>
        <p className="text-muted-foreground">Failed to load traffic data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Traffic Sources
          </h2>
          <p className="text-muted-foreground">See where your visitors come from — WhatsApp, Facebook, Instagram, Snapchat, and more.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/tracker">Click Tracker</Link>
          </Button>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {[
          { key: "7d", label: "Last 7 Days" },
          { key: "30d", label: "Last 30 Days" },
          { key: "90d", label: "Last 90 Days" },
          { key: "all", label: "All Time" },
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => { setPeriod(p.key); setLoading(true) }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              period === p.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <MousePointerClick className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Clicks</p>
              <p className="text-2xl font-bold">{data.totalClicks.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Top Source</p>
              <p className="text-2xl font-bold">{data.sources[0]?.name || "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sources</p>
              <p className="text-2xl font-bold">{data.sources.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source breakdown pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Traffic Source Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="name"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [`${v} clicks`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {pieData.map((entry, index) => {
                const pct = data.totalClicks > 0 ? ((entry.count / data.totalClicks) * 100).toFixed(1) : "0"
                return (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{entry.count}</span>
                      <span className="text-muted-foreground w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Daily trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Daily Trend by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {dailyKeys.map((key, idx) => (
                    <Bar key={key} dataKey={key} stackId="a" fill={COLORS[idx % COLORS.length]} radius={idx === dailyKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top landing pages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Top Landing Pages</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Page</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Clicks</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.topPages.map((p) => (
                <tr key={p.path} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.path}</td>
                  <td className="px-4 py-3 text-right">{p.count}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {data.totalClicks > 0 ? ((p.count / data.totalClicks) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
              {data.topPages.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">No data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
