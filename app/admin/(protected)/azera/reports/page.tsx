"use client"
import { Suspense, useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Download, Loader2, Phone, RefreshCw, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { csvCell } from "@/lib/azera-reporting"

type Call = {
  id: string
  business_id: string
  call_type: string
  direction: string
  status: string
  customer_name: string | null
  customer_phone: string | null
  agent_name: string | null
  duration_seconds: number | null
  answered_at: string | null
  created_at: string
  follow_up_status: string
  follow_up_notes: string | null
  follow_up_at: string | null
  provider_cost_amount: number | null
  provider_cost_currency: string | null
}
type Summary = {
  total: number
  answered: number
  missed: number
  failed: number
  busy: number
  talkSeconds: number
  averageAnswerSeconds: number | null
  inboundFinished: number
  answeredWithin30Seconds: number
  followUpsDue: number
}
type Report = {
  calls: Call[]
  count: number
  page: number
  pageSize: number
  summary: Summary
}
type Recording = {
  id: string
  recording_url: string | null
  expired?: boolean
  created_at: string
}
const duration = (seconds: number | null) =>
  `${Math.floor((seconds || 0) / 60)}:${String((seconds || 0) % 60).padStart(2, "0")}`
const dateInput = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "Africa/Lagos",
  })
const inputClass =
  "mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
function download(name: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type })),
    link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
function CallReports() {
  const requestedCall = useSearchParams().get("call")
  const detailRequest = useRef(0)
  const [draft, setDraft] = useState({
    from: dateInput(-30),
    to: dateInput(0),
    type: "all",
    direction: "all",
    status: "all",
    search: "",
  })
  const [filters, setFilters] = useState(draft),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0)
  const [report, setReport] = useState<Report | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("")
  const [selected, setSelected] = useState<Call | null>(null),
    [recordings, setRecordings] = useState<Recording[]>([]),
    [recordingsLoading, setRecordingsLoading] = useState(false)
  const [notes, setNotes] = useState(""),
    [followUp, setFollowUp] = useState("new"),
    [due, setDue] = useState(""),
    [saving, setSaving] = useState(false),
    [consent, setConsent] = useState(false),
    [detailError, setDetailError] = useState("")
  useEffect(() => {
    if (!selected) return
    const dialog = document.querySelector<HTMLElement>(
      '[aria-labelledby="call-follow-up-title"]'
    )
    if (!dialog) return
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialog.querySelector<HTMLElement>("button")?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setSelected(null)
      if (event.key !== "Tab") return
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href]"
        )
      ).filter(
        (item) => !item.matches(":disabled") && item.getClientRects().length > 0
      )
      const first = items[0],
        last = items[items.length - 1]
      if (!first) {
        event.preventDefault()
        return
      }
      if (
        !dialog.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault()
        ;(event.shiftKey ? last : first)?.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener("keydown", onKey)
      previous?.focus()
    }
  }, [selected, saving])
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(
          `/api/azera/reports?${new URLSearchParams({ ...filters, page: String(page) })}`,
          { cache: "no-store", signal: controller.signal }
        )
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error || "Could not load call report")
        setReport(data)
      } catch (error) {
        if (!controller.signal.aborted) {
          setReport(null)
          setError(
            error instanceof Error ? error.message : "Could not load report"
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [filters, page, version])
  async function open(call: Call) {
    const requestId = ++detailRequest.current
    setSelected(call)
    setNotes(call.follow_up_notes || "")
    setFollowUp(call.follow_up_status || "new")
    setDue(
      call.follow_up_at
        ? new Date(
            new Date(call.follow_up_at).getTime() -
              new Date().getTimezoneOffset() * 60000
          )
            .toISOString()
            .slice(0, 16)
        : ""
    )
    setConsent(false)
    setDetailError("")
    setRecordings([])
    setRecordingsLoading(true)
    try {
      const response = await fetch(
          `/api/azera/call-recordings?call_id=${call.id}`,
          { cache: "no-store" }
        ),
        data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Could not load recordings")
      if (requestId === detailRequest.current) setRecordings(data.data || [])
    } catch (error) {
      if (requestId === detailRequest.current)
        setDetailError(
          error instanceof Error ? error.message : "Could not load recordings"
        )
    } finally {
      if (requestId === detailRequest.current) setRecordingsLoading(false)
    }
  }
  useEffect(() => {
    if (!requestedCall || !/^[a-f0-9-]{36}$/i.test(requestedCall)) return
    let current = true
    void (async () => {
      try {
        const response = await fetch(`/api/azera/calls/${requestedCall}`, {
            cache: "no-store",
          }),
          data = await response.json()
        if (!response.ok)
          throw new Error(data.error || "Could not open this call")
        if (current) await open(data.data)
      } catch (error) {
        if (current)
          setError(
            error instanceof Error ? error.message : "Could not open this call"
          )
      }
    })()
    return () => {
      current = false
    }
    // open is an event handler; only a changed deep-link should reopen a panel.
  }, [requestedCall])
  async function save() {
    if (!selected) return
    setSaving(true)
    setDetailError("")
    try {
      const response = await fetch(`/api/azera/calls/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            follow_up_status: followUp,
            follow_up_notes: notes,
            follow_up_at: due ? new Date(due).toISOString() : null,
          }),
        }),
        data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Could not save follow-up")
      setSelected(null)
      setVersion((value) => value + 1)
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Could not save follow-up"
      )
    } finally {
      setSaving(false)
    }
  }
  async function upload(file: File | undefined) {
    if (!selected || !file || !consent) return
    setSaving(true)
    setDetailError("")
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("call_id", selected.id)
      form.set("business_id", selected.business_id)
      form.set("consent_confirmed", "true")
      const response = await fetch("/api/azera/call-recordings/upload", {
          method: "POST",
          body: form,
        }),
        data = await response.json()
      if (!response.ok) throw new Error(data.error || "Upload failed")
      setRecordings((value) => [data.data, ...value])
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setSaving(false)
    }
  }
  function exportPage() {
    if (!report) return
    const keys: (keyof Call)[] = [
      "id",
      "created_at",
      "call_type",
      "direction",
      "customer_name",
      "customer_phone",
      "agent_name",
      "status",
      "duration_seconds",
      "provider_cost_amount",
      "provider_cost_currency",
      "follow_up_status",
      "follow_up_at",
    ]
    download(
      `azera-calls-page-${page}.csv`,
      [
        keys.map(csvCell).join(","),
        ...report.calls.map((call) =>
          keys.map((key) => csvCell(call[key])).join(",")
        ),
      ].join("\r\n")
    )
  }
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Phone className="h-5 w-5 text-blue-600" />
            Contact-centre reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Calls, response times, private recordings and follow-up. Dates use
            West Africa Time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/azera">Open inbox</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVersion((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw
              className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            Refresh
          </Button>
        </div>
      </header>
      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setPage(1)
              setFilters({ ...draft })
            }}
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <label className="text-sm font-medium">
              From
              <input
                type="date"
                value={draft.from}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                className={inputClass}
                required
              />
            </label>
            <label className="text-sm font-medium">
              To
              <input
                type="date"
                min={draft.from}
                value={draft.to}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                className={inputClass}
                required
              />
            </label>
            {(
              [
                [
                  "type",
                  "Call type",
                  [
                    ["all", "All types"],
                    ["webrtc", "Website audio"],
                    ["sip", "Telephone"],
                  ],
                ],
                [
                  "direction",
                  "Direction",
                  [
                    ["all", "All directions"],
                    ["inbound", "Inbound"],
                    ["outbound", "Outbound"],
                  ],
                ],
                [
                  "status",
                  "Status",
                  [
                    ["all", "All statuses"],
                    ["ringing", "Ringing"],
                    ["active", "Active"],
                    ["ended", "Ended"],
                    ["missed", "Missed"],
                    ["busy", "Busy"],
                    ["failed", "Failed"],
                  ],
                ],
              ] as const
            ).map(([key, label, options]) => (
              <label key={key} className="text-sm font-medium">
                {label}
                <select
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                  className={inputClass}
                >
                  {options.map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="text-sm font-medium sm:col-span-2">
              Search
              <input
                value={draft.search}
                onChange={(e) => setDraft({ ...draft, search: e.target.value })}
                placeholder="Customer, phone or agent name"
                className={inputClass}
              />
            </label>
            <Button
              type="submit"
              className="self-end"
              size="sm"
              disabled={loading}
            >
              Apply filters
            </Button>
          </form>
        </CardContent>
      </Card>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Total calls", report.summary.total],
              ["Answered", report.summary.answered],
              [
                "Missed / failed / busy",
                `${report.summary.missed} / ${report.summary.failed} / ${report.summary.busy}`,
              ],
              ["Follow-ups due", report.summary.followUpsDue],
              ["Talk time", duration(report.summary.talkSeconds)],
              [
                "Average inbound answer time",
                report.summary.averageAnswerSeconds === null
                  ? "Not yet measured"
                  : `${report.summary.averageAnswerSeconds}s`,
              ],
              [
                "Inbound answered within 30s",
                report.summary.inboundFinished
                  ? `${Math.round((report.summary.answeredWithin30Seconds / report.summary.inboundFinished) * 100)}%`
                  : "Not yet measured",
              ],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-xl font-semibold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Totals cover all matching records, not just this page. “Answered”
            requires an answer timestamp; an ended attempt is not automatically
            an answered call. The 30-second metric excludes still-ringing calls.
          </p>
        </>
      )}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Call history</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={exportPage}
              disabled={!report?.calls.length || loading}
            >
              <Download className="h-4 w-4" />
              Export this page
            </Button>
          </div>
          {loading ? (
            <div role="status" className="flex justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !report?.calls.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {error
                ? "Report unavailable. Please retry."
                : "No calls match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {[
                      "Customer",
                      "Agent",
                      "Call",
                      "Status",
                      "Talk time",
                      "Provider charge",
                      "Date",
                      "Actions",
                    ].map((label) => (
                      <th
                        key={label}
                        className="whitespace-nowrap px-3 py-3 font-medium"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.calls.map((call) => (
                    <tr key={call.id} className="border-t border-slate-100">
                      <td className="px-3 py-3">
                        <p className="font-medium">
                          {call.customer_name || "Unknown contact"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {call.customer_phone || "Website visitor"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {call.agent_name || "Unassigned"}
                      </td>
                      <td className="px-3 py-3">
                        {call.call_type === "sip"
                          ? "Telephone"
                          : "Website audio"}
                        <p className="text-xs text-slate-500">
                          {call.direction === "inbound"
                            ? "Inbound"
                            : "Outbound"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                          {call.status.charAt(0).toUpperCase() +
                            call.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {call.answered_at
                          ? duration(call.duration_seconds)
                          : "Not connected"}
                      </td>
                      <td className="px-3 py-3">
                        {call.provider_cost_amount === null
                          ? "Not reported"
                          : `${call.provider_cost_currency || "Currency not reported"} ${call.provider_cost_amount}`}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {new Date(call.created_at).toLocaleString("en-NG", {
                          timeZone: "Africa/Lagos",
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void open(call)}
                        >
                          Follow-up & recordings
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {report && (
            <nav
              aria-label="Call report pages"
              className="flex flex-wrap items-center justify-between gap-3 text-sm"
            >
              <p>
                {report.count} matching calls · Page {page} of{" "}
                {Math.max(1, Math.ceil(report.count / report.pageSize))}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading || page * report.pageSize >= report.count}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </nav>
          )}
        </CardContent>
      </Card>
      {selected && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="call-follow-up-title"
            className="max-h-[90dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex justify-between gap-3">
              <div>
                <h2 id="call-follow-up-title" className="font-semibold">
                  {selected.customer_name ||
                    selected.customer_phone ||
                    "Call follow-up"}
                </h2>
                <p className="text-xs text-muted-foreground">{selected.id}</p>
              </div>
              <button
                aria-label="Close call details"
                disabled={saving}
                onClick={() => setSelected(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {detailError && (
              <p role="alert" className="text-sm text-red-700">
                {detailError}
              </p>
            )}
            <label className="block text-sm">
              Follow-up status
              <select
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className={inputClass}
              >
                {["new", "assigned", "contacted", "resolved"].map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Follow-up due (your local time)
              <input
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              Notes
              <textarea
                rows={3}
                maxLength={5000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
              />
            </label>
            <Button size="sm" disabled={saving} onClick={() => void save()}>
              Save follow-up
            </Button>
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium">Private recordings</h3>
              <p className="text-xs text-muted-foreground">
                Playback links expire after five minutes. Reopen this panel to
                refresh them. Expired-retention recordings are not available.
              </p>
              {recordingsLoading ? (
                <p>Loading recordings…</p>
              ) : recordings.length ? (
                recordings.map((recording) => (
                  <div
                    key={recording.id}
                    className="rounded-lg border p-3 text-sm"
                  >
                    {recording.recording_url ? (
                      <a
                        href={recording.recording_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-600 underline"
                      >
                        Play / download recording
                      </a>
                    ) : (
                      <span>
                        {recording.expired
                          ? "Retention period ended"
                          : "Recording unavailable"}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No recording stored for this call.
                </p>
              )}
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I confirm that both participants consented to this recording.
              </label>
              <label className="block text-sm">
                Attach an existing recording
                <input
                  type="file"
                  accept="audio/*"
                  disabled={!consent || saving}
                  onChange={(e) => {
                    void upload(e.target.files?.[0])
                    e.target.value = ""
                  }}
                  className="mt-2 block max-w-full text-sm"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Manual upload does not turn on automatic telephone recording.
                Provider recording requires its own supported setup and consent.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
export default function AzeraCallReportsPage() {
  return (
    <Suspense fallback={<p>Loading call reports…</p>}>
      <CallReports />
    </Suspense>
  )
}
