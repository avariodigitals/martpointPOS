"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, HeartHandshake, ArrowLeft, Play, RotateCcw, Send, Users } from "lucide-react"

interface AutomationState {
  id: string
  enabled: boolean
  delayDays: number
  intervalDays: number
  maxSteps: number
}

interface ClientRow {
  id: string
  businessName: string
  contactName: string | null
  email: string
  status: string
  connectedAt: string | null
  daysUsing: number
  run: { status: string; step: number; scheduledFor: string | null; lastSentAt: string | null } | null
}

interface Overview {
  config: { welcomeEnabled: boolean; founderName: string; founderEmail: string; milestoneTemplates: string[] }
  automation: AutomationState | null
  clients: ClientRow[]
}

const MILESTONE_DAYS = [30, 60, 90, 120]

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })
}

export default function ClientCheckinsPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string>("")
  const [message, setMessage] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [welcomeEnabled, setWelcomeEnabled] = useState(true)
  const [founderName, setFounderName] = useState("Ralph")
  const [founderEmail, setFounderEmail] = useState("ralph@martpoint.com.ng")
  const [startWithWelcome, setStartWithWelcome] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/client-checkins", { cache: "no-store" })
    const json = (await res.json()) as Overview & { error?: string }
    if (res.ok) {
      setData(json)
      setEnabled(json.automation?.enabled ?? false)
      setWelcomeEnabled(json.config.welcomeEnabled)
      setFounderName(json.config.founderName)
      setFounderEmail(json.config.founderEmail)
    } else {
      setMessage(json.error || "Failed to load check-in state.")
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch("/api/admin/client-checkins", { cache: "no-store" })
      .then((res) => res.json().then((json: Overview & { error?: string }) => ({ res, json })))
      .then(({ res, json }) => {
        if (res.ok) {
          setData(json)
          setEnabled(json.automation?.enabled ?? false)
          setWelcomeEnabled(json.config.welcomeEnabled)
          setFounderName(json.config.founderName)
          setFounderEmail(json.config.founderEmail)
        } else {
          setMessage(json.error || "Failed to load check-in state.")
        }
      })
      .catch(() => setMessage("Network error loading check-ins."))
      .finally(() => setLoading(false))
  }, [])

  const post = async (payload: Record<string, unknown>, busyKey: string, doneMsg: string) => {
    setBusy(busyKey)
    setMessage("")
    try {
      const res = await fetch("/api/admin/client-checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (res.ok && json.ok !== false) {
        setMessage(doneMsg)
        await load()
      } else {
        setMessage(json.error || "Action failed.")
      }
    } catch {
      setMessage("Network error. Please try again.")
    } finally {
      setBusy("")
    }
  }

  const saveConfig = (e: React.FormEvent) => {
    e.preventDefault()
    post({ action: "config", welcomeEnabled, founderName, founderEmail }, "config", "Check-in settings saved.")
  }

  const runState = (c: ClientRow): { label: string; tone: string } => {
    if (!c.run) return { label: "Not started", tone: "text-amber-600" }
    switch (c.run.status) {
      case "pending": {
        const day = MILESTONE_DAYS[c.run.step - 1] ?? c.run.step * 30
        return { label: `${day}-day check-in ${fmtDate(c.run.scheduledFor)}`, tone: "text-blue-600" }
      }
      case "sent":
        return { label: "Completed (all 4)", tone: "text-green-600" }
      case "cancelled":
        return { label: "Cancelled", tone: "text-muted-foreground" }
      case "failed":
        return { label: "Failed — restart?", tone: "text-red-600" }
      default:
        return { label: c.run.status, tone: "text-muted-foreground" }
    }
  }

  const overdue = (data?.clients || []).filter((c) => c.daysUsing >= 30 && (!c.run || c.run.status === "cancelled" || c.run.status === "failed"))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Settings
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <HeartHandshake className="w-5 h-5" />
          Client Check-ins
        </h2>
        <p className="text-muted-foreground">
          Personal founder emails to your clients: a welcome note the moment they receive their access details, then
          emotional check-ins every 30 days (30, 60, 90, 120). Replies land directly at the founder&apos;s inbox.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {!data?.automation && (
            <Card className="border-amber-300">
              <CardContent className="pt-6 text-sm">
                The check-in automation is not installed yet — apply migration <code>089_client_checkin_automation.sql</code>{" "}
                to activate the sequence.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Sequence</CardTitle>
              <CardDescription>
                Starts automatically the first time a client receives the access/credentials email. Day 0 is that moment;
                check-ins then go out at {MILESTONE_DAYS.join(", ")} days after connection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => {
                    const next = e.target.checked
                    setEnabled(next)
                    post({ action: "toggle", enabled: next }, "toggle", next ? "Check-ins enabled." : "Check-ins paused. Scheduled check-ins will be cancelled by the next sweep.")
                  }}
                  className="h-4 w-4 rounded border-input"
                />
                Enable the monthly check-in sequence
              </label>

              <form onSubmit={saveConfig} className="space-y-4">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={welcomeEnabled}
                    onChange={(e) => setWelcomeEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input"
                  />
                  <span>
                    <span className="font-medium">Send the founder welcome note</span>
                    <span className="block text-xs text-muted-foreground">
                      Immediately after the access/credentials email goes out (day 0).
                    </span>
                  </span>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Founder name (signs the emails)</label>
                    <input
                      type="text"
                      value={founderName}
                      onChange={(e) => setFounderName(e.target.value)}
                      maxLength={60}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Ralph"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Reply-to email (replies reach you)</label>
                    <input
                      type="email"
                      value={founderEmail}
                      onChange={(e) => setFounderEmail(e.target.value)}
                      maxLength={160}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="ralph@martpoint.com.ng"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={busy === "config"}>
                    {busy === "config" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save
                  </Button>
                  <Link href="/admin/settings/email-templates" className="text-sm text-blue-600 hover:underline">
                    Edit the welcome &amp; check-in wording →
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Your clients ({(data?.clients || []).length})
              </CardTitle>
              <CardDescription>
                Days are counted from when each client connected (access email sent; older clients fall back to their
                creation date). Use the buttons to trigger manually — some clients are already past their milestones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={startWithWelcome}
                    onChange={(e) => setStartWithWelcome(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  Include welcome note when starting clients
                </label>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy !== "" || overdue.length === 0} onClick={() => post({ action: "backfill", sendWelcome: startWithWelcome }, "backfill", `Started ${overdue.length} overdue client(s).`)}>
                    {busy === "backfill" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    Backfill all overdue ({overdue.length})
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => post({ action: "sweep" }, "sweep", "Ran the due-check-ins sweep.")}>
                    {busy === "sweep" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Send all due check-ins now
                  </Button>
                </div>
              </div>

              {message && <p className="text-sm text-blue-700">{message}</p>}

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Business</th>
                      <th className="px-3 py-2 font-medium">Contact</th>
                      <th className="px-3 py-2 font-medium">Connected</th>
                      <th className="px-3 py-2 font-medium">Days</th>
                      <th className="px-3 py-2 font-medium">Sequence</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.clients || []).slice(0, 50).map((c) => {
                      const st = runState(c)
                      const noLiveRun = !c.run || c.run.status === "cancelled" || c.run.status === "failed"
                      return (
                        <tr key={c.id} className="border-t">
                          <td className="px-3 py-2">
                            <span className="font-medium">{c.businessName}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{c.status}</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {c.contactName || "—"} <span className="block text-xs">{c.email}</span>
                          </td>
                          <td className="px-3 py-2">{fmtDate(c.connectedAt)}</td>
                          <td className="px-3 py-2">{c.daysUsing}</td>
                          <td className={`px-3 py-2 ${st.tone}`}>{st.label}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {noLiveRun ? (
                              <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => post({ action: "start", businessId: c.id, sendWelcome: startWithWelcome }, c.id, `Check-ins started for ${c.businessName}.`)}>
                                {busy === c.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                                Start
                              </Button>
                            ) : c.run?.status === "pending" ? (
                              <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => post({ action: "run-now", businessId: c.id }, c.id, `Next check-in sent to ${c.businessName}.`)}>
                                {busy === c.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Send next now
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                    {(data?.clients || []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                          No live clients yet — the sequence starts automatically with the first access email.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {(data?.clients || []).length > 50 && (
                <p className="text-xs text-muted-foreground">Showing the first 50 of {data?.clients.length} clients.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
