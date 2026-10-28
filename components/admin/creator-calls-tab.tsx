"use client"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Phone, RefreshCw, Loader2, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { enumLabel } from "@/lib/utils"

type Summary = { id: string; summary: string; outcome: string; author_name: string; created_at: string }
type Call = {
  id: string
  created_at: string
  answered_at: string | null
  status: string
  direction: string
  duration_seconds: number | null
  agent_name: string | null
  customer_phone: string | null
  sip_call_sid: string | null
  follow_up_notes: string | null
  follow_up_status: string | null
  follow_up_at: string | null
  final_outcome: string | null
  creator_call_summaries: Summary[]
  azera_call_events: { id: string; event_type: string; actor_type: string; created_at: string }[]
}
const fmt = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short"
  })
const outcomes = ["discussed", "follow_up_required", "no_answer", "not_interested", "other"]

export function CreatorCallsTab({ id, application = false }: { id: string; application?: boolean }) {
  const [calls, setCalls] = useState<Call[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [canWrite, setCanWrite] = useState(false),
    [saving, setSaving] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { summary: string; outcome: string }>>({})
  const base = `/api/admin/creators/${application ? "applications" : "creators"}/${id}/calls`
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(`${base}?page=${page}`, { cache: "no-store", signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Could not load calls")
        if (signal?.aborted) return
        setCalls(data.calls || [])
        setTotal(data.total)
        setHasMore(data.hasMore)
        setCanWrite(data.canSummarize)
      } catch (error) {
        if (!signal?.aborted) setError(error instanceof Error ? error.message : "Could not load calls")
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [base, page]
  )
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => void load(controller.signal), 0)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [load])
  async function save(callId: string) {
    setSaving(callId)
    setError("")
    try {
      const response = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, ...drafts[callId] })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not save summary")
      setCalls((current) =>
        current.map((call) =>
          call.id === callId
            ? { ...call, creator_call_summaries: [data.summary, ...call.creator_call_summaries] }
            : call
        )
      )
      setDrafts((current) => ({ ...current, [callId]: { summary: "", outcome: "discussed" } }))
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save summary")
    } finally {
      setSaving(null)
    }
  }
  return (
    <section className="space-y-4" aria-label="Creator call audit">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Phone className="h-4 w-4" />
            Calls <span className="text-muted-foreground">({total})</span>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Newest first · Nigeria time · Linked creator/application calls only. Summaries are staff-authored,
            timestamped audit entries.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh calls
        </Button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading calls…
        </p>
      ) : !error && !calls.length ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No calls linked to this creator yet. Use “Call creator” above; calls dialled manually are not
          assigned by phone-number guesswork.
        </div>
      ) : (
        !loading &&
        calls.map((call) => {
          const draft = drafts[call.id] || { summary: "", outcome: "discussed" }
          return (
            <article key={call.id} className="space-y-4 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {fmt(call.created_at)} <span className="text-xs text-muted-foreground">WAT</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {enumLabel(call.direction)} · {call.customer_phone || "No number"} · Agent:{" "}
                    {call.agent_name || "Not assigned"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${call.status === "active" ? "bg-green-50 text-green-700" : call.status === "failed" || call.status === "missed" ? "bg-red-50 text-red-700" : "bg-muted"}`}
                >
                  {enumLabel(call.status)}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Talk duration</dt>
                  <dd className="mt-1">
                    {call.answered_at && call.duration_seconds != null
                      ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                      : call.answered_at
                        ? "Not finalized"
                        : "Not answered"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Final outcome</dt>
                  <dd className="mt-1">
                    {call.final_outcome ? enumLabel(call.final_outcome) : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Follow-up</dt>
                  <dd className="mt-1">
                    {call.follow_up_status ? enumLabel(call.follow_up_status) : "None"}
                    {call.follow_up_at ? ` · ${fmt(call.follow_up_at)}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Call reference</dt>
                  <dd className="mt-1 break-all font-mono">{call.id}</dd>
                </div>
              </dl>
              {call.follow_up_notes && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Existing follow-up notes</p>
                  <p className="whitespace-pre-wrap">{call.follow_up_notes}</p>
                </div>
              )}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Call summaries</h4>
                {!call.creator_call_summaries.length && (
                  <p className="text-xs text-muted-foreground">
                    No summary recorded. An ended call alone does not confirm a successful conversation.
                  </p>
                )}
                {[...call.creator_call_summaries]
                  .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
                  .map((note) => (
                    <div key={note.id} className="rounded-lg border p-3">
                      <p className="whitespace-pre-wrap text-sm">{note.summary}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {enumLabel(note.outcome)} · {note.author_name} · {fmt(note.created_at)} WAT
                      </p>
                    </div>
                  ))}
              </div>
              <details className="group rounded-lg border p-3">
                <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <ChevronRight className="h-3 w-3 group-open:rotate-90" />
                  Call event log ({call.azera_call_events.length})
                </summary>
                <ol className="mt-3 space-y-2 text-xs">
                  {[...call.azera_call_events]
                    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
                    .map((event) => (
                      <li key={event.id}>
                        {enumLabel(event.event_type)} · {enumLabel(event.actor_type)} ·{" "}
                        {fmt(event.created_at)} WAT
                      </li>
                    ))}
                </ol>
                <Link
                  href={`/admin/azera/reports?call=${encodeURIComponent(call.id)}`}
                  className="mt-3 inline-block text-xs text-retail underline"
                >
                  Open full call report
                </Link>
              </details>
              {canWrite && (
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm font-medium">Add an audited summary</summary>
                  <div className="mt-3 space-y-3">
                    <label className="block text-xs">
                      Outcome
                      <select
                        value={draft.outcome}
                        onChange={(e) =>
                          setDrafts((current) => ({
                            ...current,
                            [call.id]: { ...draft, outcome: e.target.value }
                          }))
                        }
                        className="mt-1 w-full rounded border bg-background p-2 text-sm"
                      >
                        {outcomes.map((outcome) => (
                          <option key={outcome} value={outcome}>
                            {enumLabel(outcome)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs">
                      Summary
                      <textarea
                        value={draft.summary}
                        maxLength={5000}
                        onChange={(e) =>
                          setDrafts((current) => ({
                            ...current,
                            [call.id]: { ...draft, summary: e.target.value }
                          }))
                        }
                        rows={3}
                        className="mt-1 w-full rounded border bg-background p-2 text-sm"
                        placeholder="What was discussed, agreed next steps and any follow-up required."
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Saved entries cannot be overwritten here. Add a new entry to correct or extend a
                      summary.
                    </p>
                    <Button
                      size="sm"
                      disabled={!!saving || draft.summary.trim().length < 5}
                      onClick={() => void save(call.id)}
                    >
                      {saving === call.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save
                      summary
                    </Button>
                  </div>
                </details>
              )}
            </article>
          )
        })
      )}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            disabled={loading || page === 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} · {total} calls
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || !hasMore}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  )
}
