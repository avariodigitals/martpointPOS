"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Ban, Plus, RotateCcw } from "lucide-react"

interface Suppression {
  email: string
  source: string
  createdAt: string
}

export default function MarketingSuppressionsPage() {
  const [suppressions, setSuppressions] = useState<Suppression[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [adding, setAdding] = useState(false)

  const load = async () => {
    try {
      const res = await fetch("/api/admin/marketing/suppressions")
      const data = await res.json()
      setSuppressions(data.suppressions || [])
    } catch {
      setMessage("Failed to load suppressions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [])

  const add = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    setAdding(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/marketing/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.success) {
        setNewEmail("")
        setMessage(`${email} added to the suppression list.`)
        load()
      } else {
        setMessage(data.error || "Failed to add")
      }
    } catch {
      setMessage("Failed to add")
    } finally {
      setAdding(false)
      setTimeout(() => setMessage(""), 4000)
    }
  }

  const remove = async (email: string) => {
    try {
      await fetch(`/api/admin/marketing/suppressions?email=${encodeURIComponent(email)}`, { method: "DELETE" })
      setSuppressions((prev) => prev.filter((s) => s.email !== email))
      setMessage(`${email} removed — they can receive campaigns again.`)
      setTimeout(() => setMessage(""), 4000)
    } catch {
      setMessage("Failed to remove")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Ban className="w-5 h-5" />
          Suppressions
        </h2>
        <p className="text-muted-foreground">
          Emails that opted out of marketing — automatically skipped on every campaign.
        </p>
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="w-4 h-4 text-muted-foreground" />
            Add Suppression
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="email@example.com"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button size="sm" variant="retail" onClick={add} disabled={adding || !newEmail.trim()}>
              {adding ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Ban className="w-3.5 h-3.5 mr-1" />}
              Suppress
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Use this for manual opt-out requests — e.g. someone asks to be removed by phone or WhatsApp.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Ban className="w-4 h-4 text-muted-foreground" />
            Unsubscribed ({suppressions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {suppressions.length === 0 ? (
            <div className="text-center py-8">
              <Ban className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No suppressed emails yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {suppressions.map((s) => (
                <div key={s.email} className="flex items-center justify-between text-xs rounded bg-muted/20 border border-border px-3 py-2">
                  <span className="truncate">
                    <span className="font-medium">{s.email}</span>
                    <span className="ml-2 text-muted-foreground">
                      {s.source === "unsubscribe_link" ? "unsubscribed via email" : s.source || "manual"} · {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(s.email)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Remove from suppression (resubscribe)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Resubscribe
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
