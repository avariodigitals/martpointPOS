"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { LifeBuoy, Plus, RefreshCw, Search } from "lucide-react"
import SupportTicketDetail, {
  type Ticket,
  type TicketThread,
  type TicketDraft,
  type Sender,
  type SupportAssignees
} from "./support-ticket-detail"
import SupportTicketDirectory from "./support-ticket-directory"
import { SupportWorkspaceCache } from "@/lib/support-workspace-cache"
import { ticketStatusLabel } from "@/lib/utils"

const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"

async function read<T>(path: string): Promise<T> {
  const response = await fetch(`/api/admin/support/${path}`, { cache: "no-store" })
  const result = await response.json()
  if (!response.ok || !result.success) throw new Error(result.error || "Could not load support workspace")
  return result.data
}

export default function SupportWorkspace() {
  const params = useSearchParams()
  const ticketId = params.get("ticket") || params.get("id") || ""
  const directory = params.get("view") === "list" || params.get("new") === "1"
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [sender, setSender] = useState<Sender | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [drafts] = useState(() => new Map<string, TicketDraft>())
  const [cache] = useState(
    () =>
      new SupportWorkspaceCache<TicketThread>(async (id) => {
        const thread = await read<TicketThread>(`workspace?id=${encodeURIComponent(id)}`)
        if (thread.ticket.id !== id) throw new Error("The returned ticket does not match the selected ticket")
        return thread
      })
  )
  const fetchThread = useCallback((id: string, force = false) => cache.get(id, force), [cache])
  const [assigneesCache] = useState(
    () =>
      new SupportWorkspaceCache<SupportAssignees>((id) =>
        read(`assignees${id ? `?partnerId=${encodeURIComponent(id)}` : ""}`)
      )
  )
  const fetchAssignees = useCallback((id: string) => assigneesCache.get(id), [assigneesCache])
  const updateTicket = useCallback((ticket: Ticket) => {
    setTickets((current) =>
      current.some((item) => item.id === ticket.id)
        ? current.map((item) => (item.id === ticket.id ? ticket : item))
        : [ticket, ...current]
    )
  }, [])
  const refreshList = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setTickets(await read<Ticket[]>("tickets"))
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load tickets")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void refreshList()
      void read<Sender>("sender")
        .then((data) => {
          if (!controller.signal.aborted) setSender(data)
        })
        .catch((error) => {
          if (!controller.signal.aborted) setError(error.message)
        })
    }, 0)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [refreshList])

  const visible = useMemo(
    () =>
      tickets.filter((ticket) => {
        if (status && ticket.status !== status) return false
        if (params.get("category") && ticket.category !== params.get("category")) return false
        if (
          params.get("requesterId") &&
          (ticket.requester_profile.id !== params.get("requesterId") ||
            ticket.requester_profile.type !== params.get("requesterType"))
        )
          return false
        return `${ticket.ticket_number} ${ticket.subject} ${ticket.requester_name || ""} ${ticket.requester_profile.name} ${ticket.requester_email || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      }),
    [tickets, status, search, params]
  )

  useEffect(() => {
    if (params.get("id") && !params.get("ticket")) {
      const query = new URLSearchParams(params.toString())
      query.set("ticket", params.get("id")!)
      query.delete("id")
      window.history.replaceState(null, "", `/admin/support?${query}`)
      return
    }
    if (directory || ticketId || !visible.length) return
    const query = new URLSearchParams(params.toString())
    query.delete("id")
    query.set("ticket", visible[0].id)
    window.history.replaceState(null, "", `/admin/support?${query}`)
  }, [directory, ticketId, visible, params])

  useEffect(() => {
    if (directory) return
    // Warm only a small set, without a burst of requests for the entire inbox.
    const timer = window.setTimeout(() => {
      void (async () => {
        for (const ticket of visible.filter((item) => item.id !== ticketId).slice(0, 3)) {
          if (cancelled) return
          await fetchThread(ticket.id).catch(() => undefined)
        }
      })()
    }, 200)
    let cancelled = false
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [directory, visible, ticketId, fetchThread])

  function select(id: string) {
    if (busy || id === ticketId) return
    const query = new URLSearchParams(params.toString())
    query.delete("id")
    query.set("ticket", id)
    window.history.pushState(null, "", `/admin/support?${query}`)
  }

  if (directory) return <SupportTicketDirectory />

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <LifeBuoy className="h-5 w-5 text-blue-600" />
            Support desk
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One inbox for every requester. Select a ticket to work on it.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/support?view=list" className={buttonClass}>
            Table view
          </Link>
          <Link
            href={`/admin/support?${new URLSearchParams({ new: "1", ...(params.get("requesterId") ? { requesterId: params.get("requesterId")!, requesterType: params.get("requesterType") || "" } : {}) })}`}
            className={buttonClass}
          >
            <Plus className="h-4 w-4" />
            New ticket
          </Link>
        </div>
      </header>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside aria-label="Support ticket inbox" className="space-y-3 lg:sticky lg:top-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Tickets <span className="text-muted-foreground">({visible.length})</span>
            </h2>
            <button
              aria-label="Refresh ticket list"
              disabled={loading}
              onClick={() => void refreshList()}
              className="rounded p-1 hover:bg-muted"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <label className="relative block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Search support tickets"
              placeholder="Search tickets or people"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Filter by stage
            <select
              aria-label="Filter tickets by stage"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`${inputClass} mt-1`}
            >
              <option value="">All stages</option>
              {[
                "NEW",
                "ASSIGNED",
                "IN_PROGRESS",
                "WAITING_CUSTOMER",
                "WAITING_PARTNER",
                "ESCALATED",
                "RESOLVED",
                "CLOSED",
                "CANCELLED"
              ].map((value) => (
                <option key={value} value={value}>
                  {value === "RESOLVED" ? "Awaiting confirmation" : ticketStatusLabel(value)}
                </option>
              ))}
            </select>
          </label>
          {busy && (
            <p className="text-xs text-muted-foreground">Finishing the current update before switching…</p>
          )}
          <nav
            aria-label="Select support ticket"
            className="flex max-h-72 gap-2 overflow-auto pb-1 lg:max-h-[calc(100vh-260px)] lg:flex-col"
          >
            {visible.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                aria-current={ticket.id === ticketId ? "page" : undefined}
                disabled={busy}
                onMouseEnter={() => void fetchThread(ticket.id).catch(() => undefined)}
                onFocus={() => void fetchThread(ticket.id).catch(() => undefined)}
                onClick={() => select(ticket.id)}
                className={`min-w-[200px] rounded-xl border p-3 text-left transition-colors lg:min-w-0 ${ticket.id === ticketId ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-200" : "border-border bg-card hover:border-blue-300 hover:bg-muted/50"} disabled:opacity-60`}
              >
                <span className="text-[10px] text-muted-foreground">{ticket.ticket_number}</span>
                <span className="mt-1 block line-clamp-2 text-sm font-medium">{ticket.subject}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {ticket.requester_name || ticket.requester_profile.name}
                </span>
                <span className="mt-2 block text-xs font-medium text-blue-700">
                  {ticket.status === "RESOLVED"
                    ? "Awaiting customer confirmation"
                    : ticketStatusLabel(ticket.status)}
                </span>
              </button>
            ))}
            {!visible.length && (
              <p className="p-3 text-sm text-muted-foreground">
                {loading ? "Loading tickets…" : "No tickets match these filters."}
              </p>
            )}
          </nav>
        </aside>
        <section aria-label="Selected ticket workspace" className="min-w-0">
          {ticketId ? (
            <SupportTicketDetail
              key={ticketId}
              ticketId={ticketId}
              initial={cache.peek(ticketId)}
              sender={sender}
              fetchThread={fetchThread}
              fetchAssignees={fetchAssignees}
              onUpdated={updateTicket}
              onBusyChange={setBusy}
              drafts={drafts}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
              {loading
                ? "Opening your support inbox…"
                : "Select a ticket, or create a new one to get started."}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
