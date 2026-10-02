"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, LifeBuoy, MessageCircle, Mail, Plus, Clock } from "lucide-react"

const TOPICS = [
  "Account & Login",
  "Learning & Onboarding",
  "Content & Brand",
  "Challenges",
  "Referrals & Rewards",
  "Payments",
  "Other",
]

interface Ticket {
  id: string
  ticket_number: string
  subject: string
  status: string
  created_at: string
  updated_at: string
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

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

export function SupportClient({
  creatorName,
  supportWhatsApp,
  supportEmail,
  supportHours,
}: {
  creatorName: string
  supportWhatsApp: string
  supportEmail: string
  supportHours: string
}) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ topic: TOPICS[0], subject: "", message: "" })
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    try {
      const res = await fetch("/api/creator/support/tickets")
      const data = await res.json()
      setTickets(data.tickets || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/creator/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ ok: false, text: data.error || "Failed to create ticket." })
        return
      }
      setMessage({ ok: true, text: `Ticket ${data.ticketNumber} created — the Creator Team will respond here.` })
      setForm({ topic: TOPICS[0], subject: "", message: "" })
      setCreating(false)
      load()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const waDigits = supportWhatsApp.replace(/[^\d]/g, "")
  const waText = encodeURIComponent(`Hi, I'm ${creatorName} from the MartPoint Creator Network. I need help with:`)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LifeBuoy className="w-5 h-5" /> Creator Support
          </h2>
          <p className="text-muted-foreground">
            Our Creator Team typically responds during MartPoint support hours{supportHours ? ` — ${supportHours}` : ""}.
            Replies may not be instant, but every ticket is tracked until it&apos;s resolved.
          </p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1" /> New ticket</Button>
        )}
      </div>

      <Card className="border-retail/30 bg-retail/5">
        <CardContent className="pt-4 flex items-start gap-3">
          <Clock className="w-4 h-4 text-retail mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-medium">How to reach us</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              <span className="font-medium text-foreground">Tickets (below)</span> are the official channel —
              tracked, assigned and answered in order.{supportHours ? ` Support hours: ${supportHours}.` : ""}{" "}
              {waDigits && <><span className="font-medium text-foreground">WhatsApp</span> is for quick assistance during those hours. </>}
              {supportEmail && <><span className="font-medium text-foreground">Email</span> is available for formal communication.</>}
            </p>
          </div>
        </CardContent>
      </Card>

      {(waDigits || supportEmail) && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Contact the Creator Team directly</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {waDigits && (
              <a
                href={`https://wa.me/${waDigits}?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp
                <span className="text-[10px] text-muted-foreground font-normal">quick assistance</span>
              </a>
            )}
            {supportEmail && (
              <a
                href={`mailto:${supportEmail}?subject=${encodeURIComponent("Creator Network support")}`}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <Mail className="w-4 h-4 text-retail" /> {supportEmail}
                <span className="text-[10px] text-muted-foreground font-normal">formal</span>
              </a>
            )}
            <p className="w-full text-xs text-muted-foreground">
              For anything you need answered or resolved, open a ticket — it&apos;s the channel we officially track and respond through.
            </p>
          </CardContent>
        </Card>
      )}

      {creating && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">New support ticket</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Topic</label>
                <select className={inputCls} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                  {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Subject</label>
                <input className={inputCls} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required minLength={4} maxLength={200} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">How can we help?</label>
                <textarea className={inputCls} rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required minLength={10} maxLength={5000} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Submit ticket
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">My tickets</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No tickets yet — open one above{waDigits ? " or reach the team on WhatsApp" : ""}.
            </p>
          ) : (
            <ul className="divide-y">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/creator/support/${t.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-muted/50 rounded-md px-2 -mx-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.ticket_number} · {new Date(t.updated_at || t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium shrink-0 ${STATUS_COLORS[t.status] || "bg-gray-100"}`}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {message && <p className={`text-sm ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</p>}
    </div>
  )
}
