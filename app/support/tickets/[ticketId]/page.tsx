"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, LifeBuoy, ArrowLeft, Send } from "lucide-react"

interface Ticket {
  id: string
  ticket_number: string
  business_id: string
  subject: string
  description?: string | null
  category: string
  priority: string
  status: string
  created_at: string
  updated_at: string
  sla_state: string | null
}

interface Message {
  id: string
  ticket_id: string
  author_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM"
  message: string
  created_at: string
}

interface Event {
  id: string
  event_type: string
  previous_value?: string | null
  new_value?: string | null
  created_at: string
}

interface DetailData {
  ticket: Ticket
  messages: Message[]
  events: Event[]
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

function formatDate(iso: string | undefined | null) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

export default function CustomerTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>
}) {
  const { ticketId } = use(params)
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [reply, setReply] = useState("")
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadTicket()
  }, [ticketId])

  async function loadTicket() {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`)
      const json = await res.json()
      if (json.success) {
        setDetail(json.data as DetailData)
      } else {
        setMessage(json.error || "Failed to load ticket")
        if (res.status === 401) router.push("/support")
      }
    } catch {
      setMessage("Failed to load ticket")
    } finally {
      setLoading(false)
    }
  }

  async function postReply() {
    if (!reply.trim()) return
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        setReply("")
        await loadTicket()
      } else {
        setMessage(json.error || "Failed to send reply")
      }
    } catch {
      setMessage("Failed to send reply")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-muted py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/support/tickets" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to tickets
          </Link>
          <p className="mt-4 text-muted-foreground">{message || "Ticket not found."}</p>
        </div>
      </div>
    )
  }

  const { ticket, messages, events } = detail

  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link href="/support/tickets" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to tickets
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 mt-2">
            <LifeBuoy className="w-5 h-5" />
            {ticket.ticket_number}
          </h1>
          <p className="text-muted-foreground">{ticket.subject}</p>
        </div>

        {message && (
          <p className={`text-sm ${message.includes("Failed") || message.includes("failed") ? "text-red-500" : "text-green-600"}`}>
            {message}
          </p>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <span className={`inline-flex text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[ticket.status] || "bg-gray-100"}`}>
                  {ticket.status.replace(/_/g, " ")}
                </span>
              </div>
              <div>
                <p className="text-muted-foreground">Priority</p>
                <span className={`inline-flex text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[ticket.priority] || "bg-gray-100"}`}>
                  {ticket.priority}
                </span>
              </div>
              <div>
                <p className="text-muted-foreground">Category</p>
                <p className="font-medium">{ticket.category.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Updated</p>
                <p className="font-medium">{formatDate(ticket.updated_at)}</p>
              </div>
            </div>
            {ticket.description && (
              <p className="text-sm text-muted-foreground mt-4 whitespace-pre-wrap border-t border-border pt-4">
                {ticket.description}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-6">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="p-3 rounded-md border border-border bg-muted/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="font-medium text-foreground">{m.author_type}</span>
                      <span>· {formatDate(m.created_at)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                  </div>
                ))
              )}
            </div>

            {!["RESOLVED", "CLOSED", "CANCELLED"].includes(ticket.status) ? (
              <div className="space-y-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Write a reply..."
                />
                <Button size="sm" onClick={postReply} disabled={!reply.trim() || saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span className="ml-1">Reply</span>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">This ticket is closed. Open a new ticket if you need further help.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">History</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/20">
                    <span className="font-medium">{e.event_type.replace(/_/g, " ")}</span>
                    {e.previous_value !== null && e.new_value !== null && e.previous_value !== undefined && e.new_value !== undefined && (
                      <span className="text-muted-foreground">{e.previous_value} → {e.new_value}</span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{formatDate(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
