"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Mail, ChevronLeft, ChevronRight } from "lucide-react"

interface EmailLog {
  id: string
  from: string
  to: string
  subject: string
  status: "pending" | "sent" | "failed"
  provider: string
  provider_response: string | null
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  sent_at: string | null
}

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toFilter, setToFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const limit = 25

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", String(limit))
    if (toFilter) params.set("to", toFilter)
    if (statusFilter) params.set("status", statusFilter)

    fetch(`/api/admin/email-logs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) {
          setLogs(data.logs || [])
          setCount(data.count || 0)
        } else {
          setLogs([])
          setCount(0)
        }
      })
      .catch((e) => {
        if (cancelled) return
        console.error(e)
        setLogs([])
        setCount(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [page, toFilter, statusFilter])

  const totalPages = Math.ceil(count / limit)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Email Logs</h2>
        <p className="text-muted-foreground">Trace every outbound email and delivery failure.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Filter by recipient email"
              value={toFilter}
              onChange={(e) => { setToFilter(e.target.value); setPage(1) }}
              className="w-full sm:w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="w-full sm:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No email logs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="text-left px-4 py-2 font-medium">To</th>
                    <th className="text-left px-4 py-2 font-medium">From</th>
                    <th className="text-left px-4 py-2 font-medium">Subject</th>
                    <th className="text-left px-4 py-2 font-medium">Sent</th>
                    <th className="text-left px-4 py-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.status === "sent"
                            ? "bg-green-50 text-green-700"
                            : log.status === "failed"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">{log.to}</td>
                      <td className="px-4 py-2">{log.from}</td>
                      <td className="px-4 py-2 max-w-xs truncate" title={log.subject}>{log.subject}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2 max-w-xs truncate text-red-600" title={log.error_message || ""}>{log.error_message || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {count} total · Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
