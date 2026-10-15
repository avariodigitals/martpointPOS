"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, HeartHandshake, ArrowLeft, Play, RotateCcw, Send, Users, ImagePlus, X, KeyRound, Copy, TriangleAlert } from "lucide-react"

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
  lastUsageAt: string | null
  lastSystemPingAt: string | null
  connectionStatus: "not_connected" | "recently_active" | "no_checkin_30d"
  dormancyPaused: boolean
  token: string | null
  dormantLast: { status: string; at: string; error: string | null } | null
  run: { status: string; step: number; scheduledFor: string | null; lastSentAt: string | null } | null
}

interface PingIssue {
  id: number
  businessId: string | null
  businessName: string | null
  source: string
  pingType: string
  outcome: string
  detail: string | null
  createdAt: string
}

interface Overview {
  config: {
    welcomeEnabled: boolean
    dormantEnabled: boolean
    founderName: string
    founderEmail: string
    signatureImageUrl: string
    milestoneTemplates: string[]
  }
  automation: AutomationState | null
  clients: ClientRow[]
  issues: PingIssue[]
}

const MILESTONE_DAYS = [30, 60, 90, 120, 180, 270, 365]

const CONNECTION_META: Record<ClientRow["connectionStatus"], { label: string; tone: string }> = {
  not_connected: { label: "Not connected", tone: "text-muted-foreground" },
  recently_active: { label: "Recently active", tone: "text-green-600" },
  no_checkin_30d: { label: "No check-in for 30 days", tone: "text-amber-600" },
}

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
  const [dormantEnabled, setDormantEnabled] = useState(false)
  const [founderName, setFounderName] = useState("Ralph")
  const [founderEmail, setFounderEmail] = useState("ralph@martpoint.com.ng")
  const [signatureImageUrl, setSignatureImageUrl] = useState("")
  const [startWithWelcome, setStartWithWelcome] = useState(true)
  const [showQuietOnly, setShowQuietOnly] = useState(false)
  const [copiedId, setCopiedId] = useState("")
  const sigFileRef = useRef<HTMLInputElement>(null)

  const applyOverview = useCallback((json: Overview) => {
    setData(json)
    setEnabled(json.automation?.enabled ?? false)
    setWelcomeEnabled(json.config.welcomeEnabled)
    setDormantEnabled(json.config.dormantEnabled)
    setFounderName(json.config.founderName)
    setFounderEmail(json.config.founderEmail)
    setSignatureImageUrl(json.config.signatureImageUrl || "")
  }, [])

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/client-checkins", { cache: "no-store" })
    const json = (await res.json()) as Overview & { error?: string }
    if (res.ok) applyOverview(json)
    else setMessage(json.error || "Failed to load check-in state.")
    setLoading(false)
  }, [applyOverview])

  useEffect(() => {
    fetch("/api/admin/client-checkins", { cache: "no-store" })
      .then((res) => res.json().then((json: Overview & { error?: string }) => ({ res, json })))
      .then(({ res, json }) => {
        if (res.ok) applyOverview(json)
        else setMessage(json.error || "Failed to load check-in state.")
      })
      .catch(() => setMessage("Network error loading check-ins."))
      .finally(() => setLoading(false))
  }, [applyOverview])

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
    post({ action: "config", welcomeEnabled, dormantEnabled, founderName, founderEmail, signatureImageUrl }, "config", "Check-in settings saved.")
  }

  const copyToken = (c: ClientRow) => {
    if (!c.token) return
    void navigator.clipboard.writeText(c.token).then(() => {
      setCopiedId(c.id)
      setTimeout(() => setCopiedId(""), 1500)
    })
  }

  const uploadSignature = async (file: File) => {
    setBusy("signature")
    setMessage("")
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "")
        reader.onerror = () => reject(new Error("read failed"))
        reader.readAsDataURL(file)
      })
      const res = await fetch("/api/admin/marketing/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mimeType: file.type, content: base64 }),
      })
      const json = await res.json()
      if (res.ok && json.url) {
        setSignatureImageUrl(String(json.url))
        setMessage("Signature image ready — press Save to attach it to your check-ins.")
      } else {
        setMessage(json.error || "Signature upload failed.")
      }
    } catch {
      setMessage("Signature upload failed. Please try again.")
    } finally {
      setBusy("")
      if (sigFileRef.current) sigFileRef.current.value = ""
    }
  }

  const runState = (c: ClientRow): { label: string; tone: string } => {
    if (!c.run) return { label: "Not started", tone: "text-amber-600" }
    switch (c.run.status) {
      case "pending": {
        const day = MILESTONE_DAYS[c.run.step - 1] ?? `${c.run.step}th`
        return { label: `${day}-day check-in ${fmtDate(c.run.scheduledFor)}`, tone: "text-blue-600" }
      }
      case "sent":
        return { label: "Completed (all 7 incl. 1-year thank-you)", tone: "text-green-600" }
      case "cancelled":
        return { label: "Cancelled", tone: "text-muted-foreground" }
      case "failed":
        return { label: "Failed — restart?", tone: "text-red-600" }
      default:
        return { label: c.run.status, tone: "text-muted-foreground" }
    }
  }

  const clients = data?.clients || []
  const overdue = clients.filter((c) => c.daysUsing >= 30 && (!c.run || c.run.status === "cancelled" || c.run.status === "failed"))
  const quiet = clients.filter((c) => c.connectionStatus === "no_checkin_30d")
  const visible = showQuietOnly ? quiet : clients

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
          check-ins at 30, 60, 90, 120, 180, 270 days — and a thank-you at 1 year. Plus a gentle &ldquo;we haven&apos;t
          received a recent check-in&rdquo; note for installs that have gone quiet. Replies land directly at the
          founder&apos;s inbox.
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
                The check-in automation is not installed yet — apply migrations{" "}
                <code>089_client_checkin_automation.sql</code> and <code>092_install_checkin_tokens.sql</code> to
                activate the sequence and install monitoring.
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
                Enable the check-in sequence
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

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={dormantEnabled}
                    onChange={(e) => setDormantEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input"
                  />
                  <span>
                    <span className="font-medium">Automatically send the &ldquo;we haven&apos;t received a recent check-in&rdquo; note</span>
                    <span className="block text-xs text-muted-foreground">
                      OFF by default — review the quiet list below before enabling. Only installs that have genuinely
                      checked in via their private token are ever considered; never-reported clients are excluded, and
                      server-health beats never count as usage. Currently {quiet.length} client(s) are quiet. Each
                      client can also be paused individually below.
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

                <div>
                  <label className="block text-sm font-medium mb-1">Your handwritten signature (optional)</label>
                  <div className="flex flex-wrap items-center gap-3">
                    {signatureImageUrl ? (
                      <span className="inline-flex items-center gap-2 rounded-md border px-2 py-1">
                        <img src={signatureImageUrl} alt="Founder signature" className="h-10 max-w-40 object-contain" />
                        <button
                          type="button"
                          onClick={() => setSignatureImageUrl("")}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Remove signature image"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy !== ""}
                        onClick={() => sigFileRef.current?.click()}
                      >
                        {busy === "signature" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                        Upload signature image
                      </Button>
                    )}
                    <input
                      ref={sigFileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void uploadSignature(f)
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      PNG/JPEG up to 4MB, a transparent background looks best. Some inboxes block images until the
                      reader allows them — your typed name always signs below as a fallback.
                    </span>
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
                <Users className="h-4 w-4" /> Your clients ({clients.length})
              </CardTitle>
              <CardDescription>
                Days are counted from when each client connected (access email sent; older clients fall back to their
                creation date). Each install checks in with its own private token — generate one below and put it in the
                POS config. &ldquo;Recently active&rdquo; reflects real POS usage only; server-health beats are shown
                separately and never count.
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
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showQuietOnly}
                    onChange={(e) => setShowQuietOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  Quiet list only ({quiet.length})
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
                      <th className="px-3 py-2 font-medium">Connection</th>
                      <th className="px-3 py-2 font-medium">Check-in token</th>
                      <th className="px-3 py-2 font-medium">Sequence</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.slice(0, 50).map((c) => {
                      const st = runState(c)
                      const conn = CONNECTION_META[c.connectionStatus] || CONNECTION_META.not_connected
                      const noLiveRun = !c.run || c.run.status === "cancelled" || c.run.status === "failed"
                      return (
                        <tr key={c.id} className="border-t align-top">
                          <td className="px-3 py-2">
                            <span className="font-medium">{c.businessName}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{c.status}</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {c.contactName || "—"} <span className="block text-xs">{c.email}</span>
                          </td>
                          <td className="px-3 py-2">{fmtDate(c.connectedAt)}</td>
                          <td className="px-3 py-2">{c.daysUsing}</td>
                          <td className="px-3 py-2">
                            <span className={conn.tone}>{conn.label}</span>
                            <span className="block text-xs text-muted-foreground">
                              usage {fmtDate(c.lastUsageAt)}
                              {c.lastSystemPingAt ? ` · server ${fmtDate(c.lastSystemPingAt)}` : ""}
                            </span>
                            {c.dormantLast && (
                              <span className={`block text-xs ${c.dormantLast.status === "failed" ? "text-red-600" : "text-muted-foreground"}`}>
                                quiet note {c.dormantLast.status} {fmtDate(c.dormantLast.at)}
                                {c.dormantLast.error ? ` — ${c.dormantLast.error}` : ""}
                              </span>
                            )}
                            <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={c.dormancyPaused}
                                disabled={busy !== ""}
                                onChange={(e) => post({ action: "pause-dormancy", businessId: c.id, paused: e.target.checked }, `pause-${c.id}`, e.target.checked ? `Quiet-note paused for ${c.businessName}.` : `Quiet-note resumed for ${c.businessName}.`)}
                                className="h-3.5 w-3.5 rounded border-input"
                              />
                              Pause reminders
                            </label>
                          </td>
                          <td className="px-3 py-2">
                            {c.token ? (
                              <span className="inline-flex items-center gap-1.5">
                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{c.token.slice(0, 8)}…</code>
                                <button type="button" onClick={() => copyToken(c)} className="text-muted-foreground hover:text-foreground" aria-label="Copy token" title="Copy full token">
                                  {copiedId === c.id ? <span className="text-xs text-green-600">copied</span> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">none yet</span>
                            )}
                            <Button size="sm" variant="ghost" className="ml-1 h-6 px-2 text-xs" disabled={busy !== ""} onClick={() => post({ action: "rotate-token", businessId: c.id }, `token-${c.id}`, c.token ? `New token issued for ${c.businessName} — the old one is retired; update the POS config.` : `Token generated for ${c.businessName}.`)}>
                              {busy === `token-${c.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <KeyRound className="mr-1 h-3 w-3" />}
                              {c.token ? "Rotate" : "Generate"}
                            </Button>
                          </td>
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
                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                          {showQuietOnly
                            ? "No clients are quiet right now."
                            : "No live clients yet — the sequence starts automatically with the first access email."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {visible.length > 50 && (
                <p className="text-xs text-muted-foreground">Showing the first 50 of {visible.length} clients.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-amber-600" /> Connection problems
              </CardTitle>
              <CardDescription>
                Recent install check-ins that could not be saved — unknown tokens, hostnames shared by several
                clients, or write failures. Use this to spot installs that need their token updated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(data?.issues || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No problems recorded — every recent check-in was saved.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {(data?.issues || []).slice(0, 15).map((i) => (
                    <li key={i.id} className="flex flex-wrap items-baseline gap-2">
                      <span className="text-xs text-muted-foreground w-32">{new Date(i.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="font-medium">{i.businessName || (i.outcome === "ambiguous" ? "ambiguous hostname" : "unknown install")}</span>
                      <span className="text-muted-foreground">{i.outcome.replace(/_/g, " ")}</span>
                      {i.detail && <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{i.detail}</code>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
