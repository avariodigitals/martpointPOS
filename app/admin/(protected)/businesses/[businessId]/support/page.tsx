"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Headset, ArrowLeft } from "lucide-react"

interface SupportTicket {
  id: string
  ticket_number: string
  subject: string
  status: string
  priority: string
  category: string
  created_at: string
  resolved_at: string | null
  sla_state: string | null
}

const CLOSED_STATUSES = new Set(["RESOLVED", "CLOSED", "CANCELLED"])

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  NORMAL: "bg-blue-100 text-blue-700",
  LOW: "bg-gray-100 text-gray-700",
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  WAITING_CUSTOMER: "bg-violet-100 text-violet-700",
  WAITING_PARTNER: "bg-pink-100 text-pink-700",
  ESCALATED: "bg-red-100 text-red-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-gray-100 text-gray-700",
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

export default function BusinessSupportPage() {
  const { businessId } = useParams() as { businessId: string }
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [businessName, setBusinessName] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!businessId) return
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/support/tickets?businessId=${businessId}`)
        const data = await res.json()
        if (data.success && data.data) {
          const list = (data.data as SupportTicket[]).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          setTickets(list)
          if (list[0] && (list[0] as unknown as { business?: { business_name: string } }).business?.business_name) {
            setBusinessName((list[0] as unknown as { business: { business_name: string } }).business.business_name)
          }
        } else {
          setMessage(data.error || "Failed to load tickets")
        }
      } catch {
        setMessage("Failed to load tickets")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [businessId])

  const openTickets = tickets.filter((t) => !CLOSED_STATUSES.has(t.status))
  const resolvedTickets = tickets.filter((t) => CLOSED_STATUSES.has(t.status)).slice(0, 10)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/businesses/${businessId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Business
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <Headset className="w-5 h-5" />
          {businessName || "Support"} · Support
        </h2>
      </div>

      {message && <p className="text-sm text-red-500">{message}</p>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Open Tickets ({openTickets.length})</CardTitle></CardHeader>
        <CardContent>
          {openTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No open tickets.</p>
          ) : (
            <div className="space-y-2">
              {openTickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/support/${t.id}`}
                  className="block p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{t.ticket_number}</p>
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                      </div>
                      <p className="text-sm mt-0.5">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">{t.category} · Opened {fmtDate(t.created_at)}</p>
                    </div>
                    {t.sla_state && (
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${
                        t.sla_state === "BREACHED" ? "bg-red-100 text-red-700" : t.sla_state === "DUE_SOON" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                      }`}>
                        {t.sla_state}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recently Resolved</CardTitle></CardHeader>
        <CardContent>
          {resolvedTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No resolved tickets yet.</p>
          ) : (
            <div className="space-y-2">
              {resolvedTickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/support/${t.id}`}
                  className="block p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{t.ticket_number}</p>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                  </div>
                  <p className="text-sm mt-0.5">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">Resolved {fmtDate(t.resolved_at || t.created_at)}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
