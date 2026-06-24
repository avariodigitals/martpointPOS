"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, MousePointerClick, Trash2, RefreshCw, TrendingUp, FileText, Calendar } from "lucide-react"

interface ClickData {
  total: number
  today: number
  topButtons: Array<{ text: string; href: string; count: number }>
  topPages: Array<{ path: string; count: number }>
  dailyCounts: Array<[string, number]>
  recent: Array<{
    id: string
    text: string
    href: string
    pagePath: string
    timestamp: string
    userAgent: string
    ip: string
  }>
}

export default function AdminTrackerPage() {
  const [data, setData] = useState<ClickData | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  const fetchData = () => {
    setLoading(true)
    fetch("/api/admin/clicks", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (json) setData(json) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch("/api/admin/clicks", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (json) setData(json) })
      .finally(() => setLoading(false))
  }, [])

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear all click tracking data? This cannot be undone.")) return
    setClearing(true)
    try {
      await fetch("/api/admin/clicks", { method: "DELETE" })
      setData(null)
      fetchData()
    } catch {
      // ignore
    } finally {
      setClearing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const stats = data || { total: 0, today: 0, topButtons: [], topPages: [], dailyCounts: [], recent: [] }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MousePointerClick className="w-5 h-5" />
            Button & Link Tracker
          </h2>
          <p className="text-muted-foreground">Track every button and link click on your site in real time.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} disabled={clearing} className="text-red-600 border-red-200 hover:bg-red-50">
            <Trash2 className="w-4 h-4 mr-1" />
            {clearing ? "Clearing..." : "Clear All"}
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Clicks</p>
                <p className="text-3xl font-bold">{stats.total.toLocaleString()}</p>
              </div>
              <MousePointerClick className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-3xl font-bold">{stats.today.toLocaleString()}</p>
              </div>
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Top Button</p>
                <p className="text-lg font-bold truncate max-w-[160px]">
                  {stats.topButtons[0]?.text || "—"}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Top Page</p>
                <p className="text-lg font-bold truncate max-w-[160px]">
                  {stats.topPages[0]?.path || "—"}
                </p>
              </div>
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Buttons */}
        <Card>
          <CardHeader>
            <CardTitle>Top Clicked Buttons & Links</CardTitle>
            <CardDescription>Most clicked elements across your site.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topButtons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clicks recorded yet. Data appears automatically as visitors click buttons and links.</p>
            ) : (
              <div className="space-y-3">
                {stats.topButtons.map((btn, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{btn.text}</p>
                      <p className="text-xs text-muted-foreground truncate">{btn.href || "—"}</p>
                    </div>
                    <span className="text-sm font-bold bg-retail text-white px-2.5 py-1 rounded-full shrink-0">
                      {btn.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Pages */}
        <Card>
          <CardHeader>
            <CardTitle>Top Pages</CardTitle>
            <CardDescription>Pages with the most click activity.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {stats.topPages.map((page, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">{page.path}</span>
                    <span className="text-sm font-bold bg-retail text-white px-2.5 py-1 rounded-full">
                      {page.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Clicks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Clicks</CardTitle>
          <CardDescription>Last 50 button and link interactions.</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clicks recorded yet. Browse the site and click buttons to see data appear here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Time</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Button / Link</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Page</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((click) => (
                    <tr key={click.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">
                        {new Date(click.timestamp).toLocaleTimeString("en-NG", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-2 px-3 font-medium max-w-[200px] truncate">{click.text}</td>
                      <td className="py-2 px-3 text-muted-foreground max-w-[120px] truncate">{click.pagePath}</td>
                      <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate">{click.href || "—"}</td>
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
