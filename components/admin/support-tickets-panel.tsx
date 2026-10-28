"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { LifeBuoy, Loader2, Plus, ArrowUpRight } from "lucide-react"
import { ticketStatusLabel, supportCategoryLabel } from "@/lib/utils"
import type { RequesterType } from "@/lib/support-requester"

export function SupportTicketsPanel({ type, id }: { type: RequesterType; id: string }) {
  const [tickets, setTickets] = useState<
    {
      id: string
      ticket_number: string
      subject: string
      status: string
      category: string
      updated_at: string
    }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/admin/support/tickets?requesterType=${type}&requesterId=${id}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) throw new Error(data.error || "Could not load tickets")
        setTickets(data.data || [])
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [type, id])
  const query = `requesterType=${type}&requesterId=${id}`
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <LifeBuoy className="h-4 w-4" />
          Support tickets{!loading && ` (${tickets.length})`}
        </h3>
        <Link
          href={`/admin/support?${query}&new=1`}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
        >
          <Plus className="h-3 w-3" />
          Create ticket
        </Link>
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !tickets.length ? (
        <p className="text-sm text-muted-foreground">No support tickets linked to this profile.</p>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/admin/support/${ticket.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {ticket.ticket_number} · {ticket.subject}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {supportCategoryLabel(ticket.category)} · Updated{" "}
                  {new Date(ticket.updated_at).toLocaleString()}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                {ticket.status === "RESOLVED" ? "Awaiting confirmation" : ticketStatusLabel(ticket.status)}
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
