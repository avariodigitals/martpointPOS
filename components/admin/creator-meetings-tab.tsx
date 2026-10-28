"use client"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Video, CalendarClock, RefreshCw, ExternalLink } from "lucide-react"
import { enumLabel } from "@/lib/utils"

type Meeting = {
  id: string
  title: string | null
  meetingKind: string
  status: string
  scheduledAt: string | null
  durationMinutes: number
  meetingUrl: string | null
  interviewerName: string | null
  notes: string | null
  result: string | null
  inviteStatus: string
}
const inputClass = "mt-1 w-full rounded-lg border border-input bg-background p-2 text-sm"
const fmt = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short"
  })
export function CreatorMeetingsTab({
  applicationId,
  name,
  allowInterview = false,
  onScheduled
}: {
  applicationId: string
  name: string
  allowInterview?: boolean
  onScheduled?: () => void | Promise<unknown>
}) {
  const [meetingKind, setMeetingKind] = useState<"meeting" | "interview">("meeting")
  const [meetings, setMeetings] = useState<Meeting[]>([]),
    [google, setGoogle] = useState(false),
    [canManage, setCanManage] = useState(false),
    [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("")
  const [title, setTitle] = useState(`MartPoint meeting — ${name}`),
    [when, setWhen] = useState(""),
    [duration, setDuration] = useState(30),
    [agenda, setAgenda] = useState("")
  const base = `/api/admin/creators/applications/${applicationId}/interviews`
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      try {
        const response = await fetch(base, { cache: "no-store", signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Could not load meetings")
        if (!signal?.aborted) {
          setMeetings(data.interviews || [])
          setGoogle(data.googleConnected)
          setCanManage(data.canManage)
        }
      } catch (error) {
        if (!signal?.aborted) setError(error instanceof Error ? error.message : "Could not load meetings")
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [base]
  )
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => void load(controller.signal), 0)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [load])
  async function schedule(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setNotice("")
    try {
      // The label is explicitly Nigeria time, independent of the staff device.
      const scheduledAt = new Date(`${when}:00+01:00`).toISOString()
      const response = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt,
          durationMinutes: duration,
          notes: agenda,
          title,
          meetingKind,
          requireGoogleMeet: true
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not schedule Google Meet")
      setNotice(data.warning || "Google Meet scheduled and invitation accepted by the email provider.")
      setWhen("")
      setAgenda("")
      await load()
      await onScheduled?.()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not schedule meeting")
    } finally {
      setBusy(false)
    }
  }
  return (
    <section
      className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]"
      aria-label="Creator meetings"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <CalendarClock className="h-4 w-4" />
              Meetings & interviews
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Shared history from application through creator activation. Times shown in Nigeria time (WAT).
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => {
              setError("")
              void load()
            }}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Refresh meetings</span>
          </Button>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            {notice}
          </p>
        )}
        {loading ? (
          <p role="status" className="flex gap-2 p-6 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading meetings…
          </p>
        ) : !error && !meetings.length ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No meetings yet. Schedule one here to create its Google Meet link and save it against this
            creator.
          </p>
        ) : (
          meetings.map((meeting) => (
            <article key={meeting.id} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <h4 className="font-medium">
                  {meeting.title ||
                    (meeting.meetingKind === "meeting" ? "Creator meeting" : "Creator interview")}
                </h4>
                <span className="rounded-full bg-muted px-2 py-1 text-xs">{enumLabel(meeting.status)}</span>
              </div>
              <p className="text-sm">
                {meeting.scheduledAt ? `${fmt(meeting.scheduledAt)} WAT` : "Time not set"} ·{" "}
                {meeting.durationMinutes} minutes
              </p>
              <p className="text-xs text-muted-foreground">
                Host: {meeting.interviewerName || "Not recorded"} · Invitation:{" "}
                {meeting.inviteStatus === "accepted"
                  ? "Email accepted"
                  : meeting.inviteStatus === "failed"
                    ? "Email failed"
                    : enumLabel(meeting.inviteStatus || "unknown")}
              </p>
              {meeting.notes && <p className="whitespace-pre-wrap text-sm">{meeting.notes}</p>}
              {meeting.result && <p className="text-sm">Interview result: {enumLabel(meeting.result)}</p>}
              {meeting.meetingUrl && /^https:\/\/meet\.google\.com\//i.test(meeting.meetingUrl) ? (
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-retail px-3 py-2 text-sm font-medium text-white"
                >
                  <Video className="h-4 w-4" />
                  {meeting.status === "CANCELLED" ? "Saved Meet link" : "Join Google Meet"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">No Google Meet link saved for this meeting.</p>
              )}
            </article>
          ))
        )}
      </div>
      <aside className="rounded-xl border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Video className="h-4 w-4" />
          Schedule a Google Meet
        </h3>
        {!loading && !google && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            Google is not connected. Ask an administrator to connect the workspace account in{" "}
            <a href="/admin/settings" className="underline">
              Settings → Google Meet
            </a>
            . No link will be fabricated.
          </div>
        )}
        {canManage ? (
          <form onSubmit={(event) => void schedule(event)} className="mt-4 space-y-3">
            {allowInterview && (
              <fieldset className="flex gap-4 text-xs">
                <legend className="mb-2">Purpose</legend>
                {(["meeting", "interview"] as const).map((kind) => (
                  <label key={kind} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="creator-meeting-purpose"
                      value={kind}
                      checked={meetingKind === kind}
                      onChange={() => setMeetingKind(kind)}
                    />
                    {kind === "meeting" ? "Creator meeting" : "Application interview"}
                  </label>
                ))}
              </fieldset>
            )}
            <label className="block text-xs">
              Meeting title
              <input
                required
                minLength={3}
                maxLength={200}
                className={inputClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="block text-xs">
              Date & time (Nigeria / WAT)
              <input
                type="datetime-local"
                required
                className={inputClass}
                value={when}
                onChange={(event) => setWhen(event.target.value)}
              />
            </label>
            <label className="block text-xs">
              Duration (minutes)
              <input
                type="number"
                min={10}
                max={240}
                required
                className={inputClass}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
            </label>
            <label className="block text-xs">
              Agenda (included in invitation)
              <textarea
                rows={4}
                maxLength={2000}
                className={inputClass}
                value={agenda}
                onChange={(event) => setAgenda(event.target.value)}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Creates a new Meet link, saves the meeting and emails the creator an invitation. Booking a
              meeting does not change application approval. An application interview can update its review
              stage.
            </p>
            <Button type="submit" size="sm" className="w-full" disabled={busy || loading || !google || !when}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
              Schedule & send invitation
            </Button>
          </form>
        ) : !loading ? (
          <p className="mt-3 text-xs text-muted-foreground">
            You can view meetings. Creator interview management permission is required to schedule.
          </p>
        ) : null}
      </aside>
    </section>
  )
}
