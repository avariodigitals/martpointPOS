"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Video, CheckCircle2, Unplug, Plus, X, CalendarClock, Bot, Copy, RefreshCw } from "lucide-react"
import {
  DEFAULT_SCHEDULING,
  WEEKDAYS,
  WEEKDAY_LABELS,
  normalizeScheduling,
  type SchedulingSettings,
  type Weekday,
} from "@/lib/scheduling"
import {
  DEFAULT_MEETING_NOTES,
  normalizeMeetingNotes,
  type MeetingNotesProvider,
  type MeetingNotesSettings,
} from "@/lib/meeting-notes"

interface GoogleForm {
  clientId: string
  clientSecret: string
  calendarId: string
}

interface GoogleStatus {
  configured: boolean
  connected: boolean
  email: string | null
  connectedAt: string | null
  redirectUri: string
}

/** Message from the OAuth round-trip (?google=connected|error|not_configured). */
function readOAuthResult(): string {
  if (typeof window === "undefined") return ""
  const params = new URLSearchParams(window.location.search)
  const result = params.get("google")
  if (result === "connected") return "Google account connected successfully."
  if (result === "not_configured") return "Save your Client ID and Client Secret first, then connect."
  if (result === "error") return params.get("message") || "Google connection failed."
  return ""
}

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const smallInput = "rounded-md border border-input bg-background px-2 py-1.5 text-sm"

const PROVIDER_HINTS: Record<MeetingNotesProvider, string> = {
  disabled: "Automated notes are off. You can still add notes manually on each meeting.",
  fireflies:
    "Fireflies needs an API key — their webhook only sends a ping; we fetch the transcript from their API. In Fireflies: Settings → Developer Settings → Webhook URL.",
  fathom:
    "In Fathom: Settings → API Access → Webhooks → add the URL below and enable summary, action items and transcript.",
  generic:
    "Point any tool at the URL below — tl;dv via Zapier/Make, or a custom script. Send meetingLink (the Meet URL) plus summary / actionItems / transcript fields.",
}

function generateSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function GoogleMeetSettingsCard({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(true)
  const [google, setGoogle] = useState<GoogleForm>({ clientId: "", clientSecret: "", calendarId: "primary" })
  const [status, setStatus] = useState<GoogleStatus | null>(null)
  const [scheduling, setScheduling] = useState<SchedulingSettings>(DEFAULT_SCHEDULING)
  const [notes, setNotes] = useState<MeetingNotesSettings>(DEFAULT_MEETING_NOTES)
  const [saving, setSaving] = useState<"google" | "scheduling" | "notes" | "disconnect" | null>(null)
  const [message, setMessage] = useState<{ google?: string; scheduling?: string; notes?: string }>(() => {
    const google = readOAuthResult()
    return google ? { google } : {}
  })

  const refreshStatus = () =>
    fetch("/api/admin/google", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setStatus(d.error ? null : d))
      .catch(() => setStatus(null))

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings", { cache: "no-store" }).then((r) => r.json()),
      refreshStatus(),
    ])
      .then(([data]) => {
        if (data.google) {
          setGoogle({
            clientId: data.google.clientId || "",
            clientSecret: data.google.clientSecret || "",
            calendarId: data.google.calendarId || "primary",
          })
        }
        setScheduling(normalizeScheduling(data.scheduling))
        setNotes(normalizeMeetingNotes(data.meetingNotes))
      })
      .finally(() => setLoading(false))

    // Strip the OAuth result params so a refresh doesn't re-show the message.
    const params = new URLSearchParams(window.location.search)
    if (params.has("google")) {
      params.delete("google")
      params.delete("message")
      const qs = params.toString()
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`)
    }
  }, [])

  const save = async (section: "google" | "scheduling" | "notes", body: Record<string, unknown>) => {
    setSaving(section)
    setMessage((m) => ({ ...m, [section]: "" }))
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setMessage((m) => ({ ...m, [section]: res.ok && data.success ? "Settings saved successfully." : data.error || "Failed to save." }))
      if (section === "google") await refreshStatus()
    } catch {
      setMessage((m) => ({ ...m, [section]: "Network error. Try again." }))
    } finally {
      setSaving(null)
    }
  }

  const disconnect = async () => {
    if (!confirm("Disconnect the Google account? New meetings will not get Meet links until you reconnect.")) return
    setSaving("disconnect")
    try {
      await fetch("/api/admin/google", { method: "DELETE" })
      await refreshStatus()
      setMessage((m) => ({ ...m, google: "Google account disconnected." }))
    } finally {
      setSaving(null)
    }
  }

  const updateWindow = (day: Weekday, idx: number, patch: Partial<{ start: string; end: string }>) =>
    setScheduling((s) => ({
      ...s,
      weekly: { ...s.weekly, [day]: s.weekly[day].map((w, i) => (i === idx ? { ...w, ...patch } : w)) },
    }))

  const addWindow = (day: Weekday) =>
    setScheduling((s) => ({ ...s, weekly: { ...s.weekly, [day]: [...s.weekly[day], { start: "09:00", end: "17:00" }] } }))

  const removeWindow = (day: Weekday, idx: number) =>
    setScheduling((s) => ({ ...s, weekly: { ...s.weekly, [day]: s.weekly[day].filter((_, i) => i !== idx) } }))

  const msgClass = (text?: string) =>
    `text-sm px-2 py-1 rounded ${text?.includes("success") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`

  return (
    <>
      <Card id="google-meet" className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-retail" />
            Google Meet
          </CardTitle>
          <CardDescription>
            Connect the Google account whose calendar should host lead demos. Meet links are generated automatically when a lead books.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  {status?.connected ? (
                    <span className="inline-flex items-center gap-1.5 text-green-700 font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Connected as {status.email || "Google account"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not connected</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {status?.connected && (
                    <Button type="button" size="sm" variant="outline" onClick={disconnect} disabled={saving === "disconnect"}>
                      {saving === "disconnect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4 mr-1" />}
                      Disconnect
                    </Button>
                  )}
                  <Button asChild size="sm" variant={status?.connected ? "outline" : "default"}>
                    <a href="/api/admin/google/connect">{status?.connected ? "Reconnect" : "Connect Google"}</a>
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">OAuth Client ID</label>
                <input
                  type="text"
                  value={google.clientId}
                  onChange={(e) => setGoogle({ ...google, clientId: e.target.value })}
                  className={inputClass}
                  placeholder="xxxx.apps.googleusercontent.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">OAuth Client Secret</label>
                <input
                  type="password"
                  value={google.clientSecret}
                  onChange={(e) => setGoogle({ ...google, clientSecret: e.target.value })}
                  className={inputClass}
                  placeholder="GOCSPX-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Calendar ID</label>
                <input
                  type="text"
                  value={google.calendarId}
                  onChange={(e) => setGoogle({ ...google, calendarId: e.target.value })}
                  className={inputClass}
                  placeholder="primary"
                />
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Create an OAuth client (type: Web application) in the{" "}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-retail underline">
                    Google Cloud Console
                  </a>
                  , enable the <strong>Google Calendar API</strong>, and add this redirect URI:
                </p>
                {status?.redirectUri && <code className="block rounded bg-muted px-2 py-1 break-all">{status.redirectUri}</code>}
                <p>Env fallback: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.</p>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="border-t pt-4 flex items-center justify-end gap-3 flex-wrap">
          {message.google && <span className={msgClass(message.google)}>{message.google}</span>}
          <Button type="button" onClick={() => save("google", { google })} disabled={saving === "google" || loading}>
            {saving === "google" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Google
          </Button>
        </CardFooter>
      </Card>

      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-retail" />
            Meeting Availability
          </CardTitle>
          <CardDescription>
            Weekly hours leads can book demos into. Times already busy on the connected Google Calendar are hidden automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-3">
                  <label className="block text-sm font-medium mb-1">Timezone</label>
                  <input
                    type="text"
                    value={scheduling.timezone}
                    onChange={(e) => setScheduling({ ...scheduling, timezone: e.target.value })}
                    className={inputClass}
                    placeholder="Africa/Lagos"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Slot length (min)</label>
                  <input type="number" min={10} max={240} value={scheduling.slotMinutes} onChange={(e) => setScheduling({ ...scheduling, slotMinutes: Number(e.target.value) })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Buffer (min)</label>
                  <input type="number" min={0} max={120} value={scheduling.bufferMinutes} onChange={(e) => setScheduling({ ...scheduling, bufferMinutes: Number(e.target.value) })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Min notice (hours)</label>
                  <input type="number" min={0} max={168} value={scheduling.minNoticeHours} onChange={(e) => setScheduling({ ...scheduling, minNoticeHours: Number(e.target.value) })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Book up to (days ahead)</label>
                  <input type="number" min={1} max={60} value={scheduling.maxDaysAhead} onChange={(e) => setScheduling({ ...scheduling, maxDaysAhead: Number(e.target.value) })} className={inputClass} />
                </div>
              </div>

              <div className="space-y-2">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="flex flex-wrap items-start gap-2 rounded-md border border-border p-2">
                    <div className="w-24 pt-1.5 text-sm font-medium">{WEEKDAY_LABELS[day]}</div>
                    <div className="flex-1 space-y-1.5">
                      {scheduling.weekly[day].length === 0 && <p className="text-xs text-muted-foreground pt-1.5">Unavailable</p>}
                      {scheduling.weekly[day].map((w, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input type="time" value={w.start} onChange={(e) => updateWindow(day, idx, { start: e.target.value })} className={smallInput} />
                          <span className="text-xs text-muted-foreground">to</span>
                          <input type="time" value={w.end} onChange={(e) => updateWindow(day, idx, { end: e.target.value })} className={smallInput} />
                          <button type="button" onClick={() => removeWindow(day, idx)} className="text-muted-foreground hover:text-destructive" aria-label="Remove window">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button type="button" size="sm" variant="ghost" onClick={() => addWindow(day)}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="border-t pt-4 flex items-center justify-end gap-3 flex-wrap">
          {message.scheduling && <span className={msgClass(message.scheduling)}>{message.scheduling}</span>}
          <Button type="button" onClick={() => save("scheduling", { scheduling: normalizeScheduling(scheduling) })} disabled={saving === "scheduling" || loading}>
            {saving === "scheduling" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Availability
          </Button>
        </CardFooter>
      </Card>

      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-retail" />
            AI Meeting Notes
          </CardTitle>
          <CardDescription>
            Connect a notetaker (Fireflies, Fathom, or any tool via webhook). Its bot joins your Meet calls and the summary, action items and transcript land on each meeting&apos;s log.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Notetaker provider</label>
                <select
                  value={notes.provider}
                  onChange={(e) => setNotes({ ...notes, provider: e.target.value as MeetingNotesProvider })}
                  className={inputClass}
                >
                  <option value="disabled">Off — manual notes only</option>
                  <option value="fireflies">Fireflies.ai</option>
                  <option value="fathom">Fathom</option>
                  <option value="generic">Other / Zapier / custom</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">{PROVIDER_HINTS[notes.provider]}</p>
              </div>

              {notes.provider === "fireflies" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Fireflies API key</label>
                  <input
                    type="password"
                    value={notes.apiKey}
                    onChange={(e) => setNotes({ ...notes, apiKey: e.target.value })}
                    className={inputClass}
                    placeholder="ff_xxxxxxxxxxxxxxxx"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Fireflies → Settings → API → copy your API key.</p>
                </div>
              )}

              {notes.provider !== "disabled" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Webhook secret</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={notes.webhookSecret}
                        onChange={(e) => setNotes({ ...notes, webhookSecret: e.target.value })}
                        className={`${inputClass} font-mono text-xs`}
                        placeholder="Generate or paste a secret"
                      />
                      <Button type="button" size="sm" variant="outline" onClick={() => setNotes({ ...notes, webhookSecret: generateSecret() })}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        Generate
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Save before copying the URL below. If a MEETING_NOTES_WEBHOOK_SECRET env var is also set, either secret is accepted.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Webhook URL — paste this into the notetaker&apos;s settings</label>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/meeting-notes${notes.webhookSecret ? `?secret=${notes.webhookSecret}` : ""}`}
                        className={`${inputClass} font-mono text-xs bg-muted/40`}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            `${window.location.origin}/api/webhooks/meeting-notes${notes.webhookSecret ? `?secret=${notes.webhookSecret}` : ""}`,
                          )
                        }
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">If your MEETING_NOTES_WEBHOOK_SECRET env var is set, <code>?secret=&lt;that value&gt;</code> also works.</p>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="border-t pt-4 flex items-center justify-end gap-3 flex-wrap">
          {message.notes && <span className={msgClass(message.notes)}>{message.notes}</span>}
          <Button type="button" onClick={() => save("notes", { meetingNotes: normalizeMeetingNotes(notes) })} disabled={saving === "notes" || loading}>
            {saving === "notes" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Notetaker
          </Button>
        </CardFooter>
      </Card>
    </>
  )
}
