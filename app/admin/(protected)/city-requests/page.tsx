"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Loader2, MapPin, X } from "lucide-react"

type CityRequest = {
  id: string
  country: string
  state: string
  city: string
  status: "pending" | "approved" | "rejected"
  created_at: string
}

export default function CityRequestsPage() {
  const [requests, setRequests] = useState<CityRequest[]>([])
  const [filter, setFilter] = useState<string>("pending")
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/city-requests${filter !== "all" ? `?status=${filter}` : ""}`)
    const data = await res.json()
    if (data.success) {
      setRequests(data.requests || [])
      setError("")
    } else {
      setError(data.error || "Failed to load")
    }
    setLoading(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => load(), 0)
    return () => clearTimeout(timer)
  }, [filter])

  const act = async (id: string, action: "approve" | "reject") => {
    setWorking(id)
    const correctedCity = drafts[id]?.trim() || undefined
    const res = await fetch("/api/admin/city-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id, correctedCity }),
    })
    const data = await res.json()
    if (!data.success) setError(data.error || "Action failed")
    setWorking(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">City Requests</h2>
          <p className="text-muted-foreground">Authorise custom cities submitted via “Other”. Approve to adopt them into the list, or correct the spelling first.</p>
        </div>
        <div className="flex gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "retail" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Cities needing authorisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No city requests.</p>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-md border border-border"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-medium">
                      {r.city}
                      <span className="text-muted-foreground"> · {r.state}, {r.country}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {r.status} · {new Date(r.created_at).toLocaleString()}
                    </p>
                    {r.status === "pending" && (
                      <input
                        className="mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        placeholder="Correct spelling (optional)"
                        value={drafts[r.id] ?? r.city}
                        onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                      />
                    )}
                  </div>
                  {r.status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" onClick={() => act(r.id, "approve")} disabled={working === r.id}>
                        {working === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act(r.id, "reject")} disabled={working === r.id}>
                        <X className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
