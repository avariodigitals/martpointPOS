"use client"

import { useEffect, useState, ChangeEvent } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Command, Loader2 } from "lucide-react"

type AuditEvent = {
  id: string
  actor_type: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    actorType: "",
    action: "",
    entityType: "",
    entityId: "",
    from: "",
    to: "",
  })

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
    const res = await fetch(`/api/admin/audit?${params.toString()}`)
    const data = await res.json()
    if (data.success) setEvents(data.events || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const update = (field: keyof typeof filters) => (e: ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [field]: e.target.value })
  }

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
        <p className="text-muted-foreground">Cross-module audit event viewer.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Command className="w-4 h-4 text-muted-foreground" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input className={inputCls} placeholder="Actor type" value={filters.actorType} onChange={update("actorType")} />
            <input className={inputCls} placeholder="Action" value={filters.action} onChange={update("action")} />
            <input className={inputCls} placeholder="Entity type" value={filters.entityType} onChange={update("entityType")} />
            <input className={inputCls} placeholder="Entity ID" value={filters.entityId} onChange={update("entityId")} />
            <input className={inputCls} type="date" value={filters.from} onChange={update("from")} />
            <input className={inputCls} type="date" value={filters.to} onChange={update("to")} />
          </div>
          <Button size="sm" onClick={load} className="mt-3" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Search
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-muted-foreground">
                <th className="p-3 font-medium">Time</th>
                <th className="p-3 font-medium">Actor</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Entity</th>
                <th className="p-3 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No audit events found.</td></tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-3 whitespace-nowrap text-xs">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="p-3">{e.actor_type} <span className="text-muted-foreground text-xs">{e.actor_id?.slice(0, 8)}</span></td>
                    <td className="p-3 font-medium">{e.action}</td>
                    <td className="p-3">{e.entity_type} <span className="text-muted-foreground text-xs">{e.entity_id.slice(0, 8)}</span></td>
                    <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
                      {e.metadata ? JSON.stringify(e.metadata) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
