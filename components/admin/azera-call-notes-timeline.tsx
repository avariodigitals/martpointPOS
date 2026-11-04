"use client"
import { useEffect, useState } from "react"
import { Loader2, Phone } from "lucide-react"

type NoteRow = {
  id: string
  azera_call_summaries: {
    id: string; call_id: string; summary: string | null; action_items: string[]; outcome: string; summary_status: string; summary_source: string; author_name: string; created_at: string
    azera_calls: { customer_name: string | null; customer_phone: string | null; agent_name: string | null; direction: string; status: string } | null
  } | null
}
export function AzeraCallNotesTimeline({ entityType, entityId }: { entityType: "lead" | "business" | "creator" | "creator_application" | "team" | "user" | "conversation"; entityId: string }) {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/azera/call-notes?${new URLSearchParams({ entityType, entityId })}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load call notes"); setNotes(data.notes || []) })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load call notes") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [entityId, entityType])
  return <section className="mt-6 space-y-3 border-t pt-4" aria-label="Call notes">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><Phone className="h-4 w-4" />Call notes</h3>
    {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading call notes…</p> : error ? <p role="status" className="text-sm text-amber-800">{error}</p> : !notes.length ? <p className="text-sm text-muted-foreground">No linked call notes yet.</p> : <div className="space-y-3">{notes.map(({ id, azera_call_summaries: note }) => note && <article key={id} className="rounded-lg border p-3"><div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{note.azera_calls?.customer_name || note.azera_calls?.customer_phone || "Call"} · {note.azera_calls?.agent_name || note.author_name}</span><time>{new Date(note.created_at).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</time></div>{note.summary ? <p className="mt-2 whitespace-pre-wrap text-sm">{note.summary}</p> : <p className="mt-2 text-sm text-amber-800">Recording saved; staff review is needed before a summary can be shown.</p>}{note.action_items?.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{note.action_items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>}</article>)}</div>}
  </section>
}
