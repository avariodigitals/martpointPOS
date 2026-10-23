"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  FileAudio,
  Search,
  Filter,
  Download,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CallRecord {
  id: string
  business_id: string
  conversation_id: string | null
  call_type: "webrtc" | "sip"
  direction: "inbound" | "outbound"
  status: string
  agent_user_id: string | null
  agent_name: string | null
  customer_name: string | null
  customer_phone: string | null
  sip_cost_cents: number | null
  selected_department: string | null
  follow_up_status: "new" | "assigned" | "contacted" | "resolved"
  follow_up_notes: string | null
  follow_up_at: string | null
  started_at: string | null
  answered_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  created_at: string
}

interface Recording {
  id: string
  call_id: string
  recording_url: string
  duration_seconds: number
  file_size_bytes: number | null
  mime_type: string
  created_at: string
}

const CALL_TYPE_LABEL: Record<string, string> = {
  webrtc: "Internet Call",
  sip: "Phone Call",
}

const CALL_TYPE_ICON: Record<string, React.ReactNode> = {
  webrtc: <Phone className="w-3 h-3" />,
  sip: <Phone className="w-3 h-3" />,
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  ended: "bg-gray-100 text-gray-500",
  ringing: "bg-blue-50 text-blue-700",
  missed: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  busy: "bg-red-50 text-red-700",
}

const DIRECTION_LABEL: Record<string, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
}

const DIRECTION_COLOR: Record<string, string> = {
  inbound: "bg-blue-50 text-blue-700",
  outbound: "bg-indigo-50 text-indigo-700",
}

export default function AzeraCallReportsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [callTypeFilter, setCallTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [directionFilter, setDirectionFilter] = useState("all")
  const [search, setSearch] = useState("")

  const loadCalls = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (callTypeFilter !== "all") params.set("call_type", callTypeFilter)
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (directionFilter !== "all") params.set("direction", directionFilter)
      const res = await fetch(`/api/azera/calls?${params.toString()}`)
      const json = await res.json()
      if (json.data) {
        setCalls(json.data)
      }
    } catch (err) {
      console.error("[Azera reports] load calls error", err)
    } finally {
      setLoading(false)
    }
  }, [callTypeFilter, statusFilter, directionFilter])

  const loadRecordings = useCallback(async () => {
    try {
      const res = await fetch("/api/azera/call-recordings")
      const json = await res.json()
      if (json.data) {
        setRecordings(json.data)
      }
    } catch (err) {
      console.error("[Azera reports] load recordings error", err)
    }
  }, [])

  useEffect(() => {
    // These calls synchronize the report with filter changes and external data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCalls()
    loadRecordings()
  }, [loadCalls, loadRecordings])

  const filtered = calls.filter((c) => {
    const matchesSearch =
      !search ||
      c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_phone?.includes(search) ||
      c.agent_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.id.includes(search)
    const matchesType =
      callTypeFilter === "all" || c.call_type === callTypeFilter
    const matchesStatus = statusFilter === "all" || c.status === statusFilter
    const matchesDirection =
      directionFilter === "all" || c.direction === directionFilter
    return matchesSearch && matchesType && matchesStatus && matchesDirection
  })

  const totals = useMemo(() => {
    return {
      total: filtered.length,
      completed: filtered.filter((c) => c.status === "ended").length,
      missed: filtered.filter((c) => c.status === "missed").length,
      failed: filtered.filter((c) => c.status === "failed").length,
      totalDuration: filtered.reduce(
        (s, c) => s + (c.duration_seconds || 0),
        0
      ),
    }
  }, [filtered])

  const formatDuration = (sec: number | null) => {
    if (!sec) return "0:00"
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s < 10 ? "0" : ""}${s}`
  }

  async function updateFollowUp(callId: string, followUpStatus: CallRecord["follow_up_status"]) {
    const res = await fetch(`/api/azera/calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ follow_up_status: followUpStatus }),
    })
    if (res.ok) setCalls((current) => current.map((call) => call.id === callId ? { ...call, follow_up_status: followUpStatus } : call))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileAudio className="w-5 h-5 text-retail" />
            Azera Call Reports
          </h2>
          <p className="text-muted-foreground">
            Call history, recordings, and analytics for your support team.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadCalls}>
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Total Calls</p>
            <p className="text-2xl font-bold">{totals.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-green-600">{totals.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Missed</p>
            <p className="text-2xl font-bold text-amber-600">{totals.missed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-red-600">{totals.failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Total Duration</p>
            <p className="text-2xl font-bold">{formatDuration(totals.totalDuration)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <select
                value={callTypeFilter}
                onChange={(e) => setCallTypeFilter(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="webrtc">Internet Call</option>
                <option value="sip">Phone Call</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
                <option value="ringing">Ringing</option>
                <option value="missed">Missed</option>
                <option value="failed">Failed</option>
                <option value="busy">Busy</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Direction</label>
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Customer, agent, ID…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => {}} variant="outline">
                <Filter className="w-4 h-4 mr-1" /> Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Call History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Phone className="w-10 h-10 opacity-20 mx-auto mb-3" />
              <p className="text-sm">No calls match the filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Direction</th>
                    <th className="px-4 py-2 text-left">Customer</th>
                    <th className="px-4 py-2 text-left">Agent</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Duration</th>
                    <th className="px-4 py-2 text-left">Cost</th>
                    <th className="px-4 py-2 text-left">Follow-up</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                        {c.id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          {CALL_TYPE_ICON[c.call_type]}
                          <span className="text-xs font-medium">
                            {CALL_TYPE_LABEL[c.call_type]}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] tracking-wider px-1.5 py-0.5 rounded font-medium ${DIRECTION_COLOR[c.direction] || "bg-gray-100"}`}>
                          {DIRECTION_LABEL[c.direction]}
                        </span>
                      </td>
                      <td className="px-4 py-2 max-w-xs truncate">
                        {c.customer_name || c.customer_phone || "Unknown"}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {c.agent_name || "Unassigned"}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLOR[c.status] || "bg-gray-100"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs font-mono">
                        {formatDuration(c.duration_seconds)}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {c.sip_cost_cents !== null
                          ? `₦${(c.sip_cost_cents / 100).toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={c.follow_up_status || "new"}
                          onChange={(e) => void updateFollowUp(c.id, e.target.value as CallRecord["follow_up_status"])}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                        >
                          <option value="new">New</option>
                          <option value="assigned">Assigned</option>
                          <option value="contacted">Contacted</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {}}
                          className="p-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recordings */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileAudio className="w-4 h-4" />
            Call Recordings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recordings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No call recordings yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recordings.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileAudio className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        Recording {r.id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.mime_type} • {formatDuration(r.duration_seconds)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={r.recording_url}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-retail hover:underline"
                    >
                      Play
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {}}
                      className="px-2 py-1"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
