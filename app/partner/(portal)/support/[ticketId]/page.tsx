"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, LifeBuoy, ArrowLeft, Send } from "lucide-react"

interface BusinessInfo {
  business_name?: string | null
  primary_contact_name?: string | null
  primary_email?: string | null
  primary_phone?: string | null
}

interface Ticket {
  id: string
  ticket_number: string
  business_id: string
  subject: string
  description?: string | null
  category: string
  priority: string
  status: string
  business?: BusinessInfo
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  ticket_id: string
  author_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM"
  message: string
  visibility: "PUBLIC" | "INTERNAL"
  attachment_path?: string | null
  created_at: string
}

interface Event {
  id: string
  ticket_id: string
  event_type: string
  actor_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM"
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
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function PartnerSupportDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>
}) {
  const { ticketId } = use(params)

  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [reply, setReply] = useState("")
  const [escalateReason, setEscalateReason] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTicket()
  }, [ticketId])

  async function loadTicket() {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch(`/api/partner/support?id=${ticketId}`)
      const json = await res.json()
      if (json.success) {
        setDetail(json.data as DetailData)
      } else {
        setDetail(null)
        setMessage(json.error || "Failed to load ticket")
      }
    } catch {
      setDetail(null)
      setMessage("Failed to load ticket")
    } finally {
      setLoading(false)
    }
  }

  async function postAction(action: string, data: Record<string, unknown>) {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/partner/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: { ticketId, ...data } }),
      })
      const json = await res.json()
      if (json.success) {
        await loadTicket()
      } else {
        setMessage(json.error || "Action failed")
      }
    } catch {
      setMessage("Action failed")
    } finally {
      setSaving(false)
    }
  }

  async function postReply() {
    if (!reply.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/partner/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          data: { ticketId, message: reply, visibility: "PUBLIC" },
        }),
      })
      const json = await res.json()
      if (json.success) {
        setReply("")
        await loadTicket()
      } else {
        setMessage(json.error || "Failed to reply")
      }
    } catch {
      setMessage("Failed to reply")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link href="/partner/support" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Link>
        <p className="text-muted-foreground">{message || "Ticket not found."}</p>
      </div>
    )
  }

  const { ticket, messages, events } = detail

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/partner/support" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to tickets
          </Link>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 mt-1">
            <LifeBuoy className="w-5 h-5" />
            {ticket.ticket_number}
          </h2>
          <p className="text-muted-foreground">{ticket.subject}</p>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("failed") || message.includes("Failed") ? "text-red-500" : "text-green-600"}`}>{message}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <span className={`inline-flex text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[ticket.status]}`}>
                    {ticket.status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">Priority</p>
                  <span className={`inline-flex text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                    {ticket.priority}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <p className="font-medium">{ticket.category}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="font-medium">{formatDate(ticket.updated_at)}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4 whitespace-pre-wrap">{ticket.description || "No description"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Public Conversation</CardTitle>
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
                      {m.attachment_path && <p className="text-xs text-muted-foreground mt-1">Attachment: {m.attachment_path}</p>}
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Write a public reply..."
                />
                <Button size="sm" onClick={postReply} disabled={!reply.trim() || saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span className="ml-1">Reply</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Status History</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {events.map((e) => (
                    <li key={e.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/20">
                      <span className="font-medium">{e.event_type}</span>
                      {e.previous_value !== undefined && e.new_value !== undefined && e.previous_value !== null && e.new_value !== null && (
                        <span className="text-muted-foreground">
                          {e.previous_value} → {e.new_value}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">{formatDate(e.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Business</p>
                <p className="font-medium">{ticket.business?.business_name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Contact</p>
                <p>{ticket.business?.primary_contact_name || "—"}</p>
                <p className="text-muted-foreground">{ticket.business?.primary_email || "—"}</p>
                <p className="text-muted-foreground">{ticket.business?.primary_phone || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => postAction("set_in_progress", {})}
                disabled={saving || ticket.status === "IN_PROGRESS"}
              >
                Set In Progress
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => postAction("set_waiting_customer", {})}
                disabled={saving || ticket.status === "WAITING_CUSTOMER"}
              >
                Set Waiting on Customer
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => postAction("mark_resolved", {})}
                disabled={saving || ["RESOLVED", "CLOSED"].includes(ticket.status)}
              >
                Mark Resolved
              </Button>
              <div className="pt-2 border-t border-border">
                <input
                  type="text"
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder="Reason for escalation"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-2"
                />
                <Button
                  size="sm"
                  variant="retail"
                  className="w-full"
                  onClick={() => postAction("escalate", { reason: escalateReason })}
                  disabled={saving}
                >
                  Escalate to MartPoint
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
