"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Send } from "lucide-react"

interface Ticket {
  id: string
  ticket_number: string
  subject: string
  status: string
  created_at: string
}

interface Message {
  id: string
  author_type: string
  message: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700",
  WAITING_CUSTOMER: "bg-amber-50 text-amber-700",
  ESCALATED: "bg-red-50 text-red-700",
  RESOLVED: "bg-green-50 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-500",
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

export function TicketThread({ ticket, messages }: { ticket: Ticket; messages: Message[] }) {
  const router = useRouter()
  const [reply, setReply] = useState("")
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState("")
  const closed = ticket.status === "CLOSED" || ticket.status === "CANCELLED"

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!reply.trim() || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/creator/support/tickets/${ticket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to send reply.")
        return
      }
      setReply("")
      router.refresh()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/creator/support" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Help &amp; Support
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{ticket.subject}</h2>
            <p className="text-sm text-muted-foreground">{ticket.ticket_number} · opened {fmt(ticket.created_at)}</p>
          </div>
          <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded font-medium ${STATUS_COLORS[ticket.status] || "bg-gray-100"}`}>
            {ticket.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Conversation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
          {messages.map((m) => {
            const mine = m.author_type === "CREATOR"
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${mine ? "bg-retail/10 border border-retail/20" : "bg-muted border"}`}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    {mine ? "You" : "MartPoint Creator Team"} · {fmt(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap">{m.message}</p>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {closed ? (
        <p className="text-sm text-muted-foreground">This ticket is closed. Open a new ticket if you need more help.</p>
      ) : (
        <form onSubmit={send} className="space-y-3">
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder="Write a reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" size="sm" disabled={busy || !reply.trim()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />} Send reply
          </Button>
        </form>
      )}
    </div>
  )
}
