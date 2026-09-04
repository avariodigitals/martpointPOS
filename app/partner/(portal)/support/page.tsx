"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, LifeBuoy, ArrowRight } from "lucide-react"

interface BusinessInfo {
  business_name?: string | null
}

interface Ticket {
  id: string
  ticket_number: string
  business_id: string
  subject: string
  category: string
  priority: string
  status: string
  business?: BusinessInfo
  created_at: string
}

type Bucket = "OPEN" | "IN_PROGRESS" | "WAITING" | "ESCALATED" | "RESOLVED"

const BUCKETS: { key: Bucket; label: string; statuses: string[] }[] = [
  { key: "OPEN", label: "Open", statuses: ["NEW", "ASSIGNED"] },
  { key: "IN_PROGRESS", label: "In Progress", statuses: ["IN_PROGRESS"] },
  { key: "WAITING", label: "Waiting", statuses: ["WAITING_CUSTOMER", "WAITING_PARTNER"] },
  { key: "ESCALATED", label: "Escalated", statuses: ["ESCALATED"] },
  { key: "RESOLVED", label: "Resolved", statuses: ["RESOLVED", "CLOSED"] },
]

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

export default function PartnerSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [active, setActive] = useState<Bucket>("OPEN")

  useEffect(() => {
    loadTickets()
  }, [])

  async function loadTickets() {
    setLoading(true)
    try {
      const res = await fetch("/api/partner/support")
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setTickets(json.data)
      } else {
        setMessage(json.error || "Failed to load tickets")
        setTickets([])
      }
    } catch {
      setMessage("Failed to load tickets")
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  const counts = useMemo(() => {
    return BUCKETS.reduce((acc, b) => {
      acc[b.key] = tickets.filter((t) => b.statuses.includes(t.status)).length
      return acc
    }, {} as Record<Bucket, number>)
  }, [tickets])

  const visible = useMemo(() => {
    const bucket = BUCKETS.find((b) => b.key === active)!
    return tickets.filter((t) => bucket.statuses.includes(t.status))
  }, [tickets, active])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <LifeBuoy className="w-5 h-5" />
          My Support Tickets
        </h2>
        <p className="text-muted-foreground">Tickets assigned to your organisation.</p>
      </div>

      {message && <p className="text-sm text-red-500">{message}</p>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            onClick={() => setActive(b.key)}
            className={`text-left p-4 rounded-xl border transition-colors ${
              active === b.key ? "bg-muted border-border" : "bg-card border-border hover:bg-muted/50"
            }`}
          >
            <p className="text-xs uppercase text-muted-foreground">{b.label}</p>
            <p className="text-2xl font-bold">{counts[b.key]}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{BUCKETS.find((b) => b.key === active)?.label} Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <LifeBuoy className="w-10 h-10 mx-auto mb-3" />
              <p className="text-sm">No tickets in this bucket.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Ticket</th>
                    <th className="px-4 py-2 text-left">Business</th>
                    <th className="px-4 py-2 text-left">Subject</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-left">Priority</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{t.ticket_number}</td>
                      <td className="px-4 py-2">{t.business?.business_name || "—"}</td>
                      <td className="px-4 py-2 max-w-xs truncate">{t.subject}</td>
                      <td className="px-4 py-2">
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-muted">
                          {t.category}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[t.priority] || "bg-gray-100"}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[t.status] || "bg-gray-100"}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/partner/support/${t.id}`} className="inline-flex items-center text-muted-foreground hover:text-foreground">
                          View <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
