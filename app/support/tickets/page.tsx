"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, LifeBuoy, Plus, ArrowRight, AlertCircle, Send } from "lucide-react"

interface Ticket {
  id: string
  ticket_number: string
  subject: string
  category: string
  priority: string
  status: string
  sla_state: string | null
  created_at: string
  resolved_at?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700",
  WAITING_CUSTOMER: "bg-amber-50 text-amber-700",
  WAITING_PARTNER: "bg-amber-50 text-amber-700",
  ESCALATED: "bg-red-50 text-red-700",
  RESOLVED: "bg-green-50 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-500",
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700",
  NORMAL: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-700",
  URGENT: "bg-red-50 text-red-700",
}

const CATEGORIES = [
  "SOFTWARE", "LOGIN_ACCOUNT", "POS", "INVENTORY", "PRODUCTS", "REPORTS", "ONLINE_STORE",
  "CONFIGURATION", "TRAINING", "BILLING", "LICENSING", "SECURITY", "PRIVACY_DATA",
  "HARDWARE_GUIDANCE", "FEATURE_REQUEST", "OTHER",
]

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"]

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

export default function CustomerTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const [showForm, setShowForm] = useState(false)
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("OTHER")
  const [priority, setPriority] = useState("NORMAL")
  const [saving, setSaving] = useState(false)

  const router = useRouter()

  useEffect(() => {
    loadTickets()
  }, [])

  async function loadTickets() {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch("/api/support/tickets")
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setTickets(json.data)
      } else {
        setMessage(json.error || "Failed to load tickets")
        if (res.status === 401) router.push("/support")
      }
    } catch {
      setMessage("Failed to load tickets")
    } finally {
      setLoading(false)
    }
  }

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) return
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSubject("")
        setDescription("")
        setCategory("OTHER")
        setPriority("NORMAL")
        setShowForm(false)
        await loadTickets()
      } else {
        setMessage(json.error || "Failed to create ticket")
      }
    } catch {
      setMessage("Failed to create ticket")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <LifeBuoy className="w-5 h-5" />
              My Support Tickets
            </h1>
            <p className="text-muted-foreground">Track and reply to tickets for your business.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => { fetch("/api/support/auth", { method: "DELETE" }).then(() => router.push("/support")) }}>
              Sign out
            </Button>
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-1" /> New ticket
            </Button>
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.includes("Failed") || message.includes("failed") ? "text-red-500" : "text-green-600"}`}>
            {message}
          </p>
        )}

        {showForm && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Create a new ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitTicket} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Priority</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    placeholder="What do you need help with?"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Describe the issue in detail..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" size="sm" disabled={saving || !subject.trim()}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span className="ml-1">Submit ticket</span>
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <LifeBuoy className="w-10 h-10 mx-auto mb-3" />
                <p className="text-sm">No tickets yet. Create your first ticket above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <Link
                    key={t.id}
                    href={`/support/tickets/${t.id}`}
                    className="block p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{t.ticket_number}</p>
                          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[t.status] || "bg-gray-100"}`}>
                            {t.status.replace(/_/g, " ")}
                          </span>
                          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[t.priority] || "bg-gray-100"}`}>
                            {t.priority}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5">{t.subject}</p>
                        <p className="text-xs text-muted-foreground">{t.category.replace(/_/g, " ")} · Opened {formatDate(t.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.sla_state && (
                          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${
                            t.sla_state === "BREACHED" ? "bg-red-100 text-red-700" : t.sla_state === "DUE_SOON" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                          }`}>
                            {t.sla_state.replace(/_/g, " ")}
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
