"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Ban, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react"

interface Creator {
  id: string; creatorId: string; referralCode: string; fullName: string; email: string
  phone: string | null; whatsapp: string | null; state: string | null; city: string | null
  primaryCategory: string | null; bio: string | null; status: string
  levelLabel: string | null; activatedAt: string | null; lastLoginAt: string | null
  applicationId: string
}
interface Stats {
  approvedContent: number; pendingSubmissions: number; clicks: number; leads: number
  demoBookings: number; signups: number; conversions: number; paidRewardsKobo: number
}
interface Note { id: string; note: string; authorName: string | null; createdAt: string }
interface Social { id: string; platform: string; profile_url: string; followers: number | null }
interface Flag { id: string; type: string; severity: string; description: string; status: string; created_at: string }
interface LearningProgressRow {
  contentId: string; title: string; type: string; required: boolean
  status: string; score: number | null; videoPercent: number
  completedAt: string | null; lastActivityAt: string | null
}
interface AttemptRow {
  contentId: string; title: string; score: number; passed: boolean
  attemptNumber: number; submittedAt: string
}
interface LearningDetail {
  readiness: string
  onboarding: { pct: number; requiredTotal: number; requiredDone: number; completedAt: string | null; readinessLabel: string }
  progress: LearningProgressRow[]
  attempts: AttemptRow[]
  downloads: number
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

export default function AdminCreatorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [creator, setCreator] = useState<Creator | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [socials, setSocials] = useState<Social[]>([])
  const [flags, setFlags] = useState<Flag[]>([])
  const [learning, setLearning] = useState<LearningDetail | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState("")

  const load = useCallback(() => {
    return fetch(`/api/admin/creators/creators/${id}`)
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (ok) {
          setCreator(d.creator)
          setStats(d.stats)
          setNotes(d.notes || [])
          setSocials(d.socials || [])
          setFlags(d.flags || [])
        }
      })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/creators/creators/${id}`)
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return
        if (ok) {
          setCreator(d.creator)
          setStats(d.stats)
          setNotes(d.notes || [])
          setSocials(d.socials || [])
          setFlags(d.flags || [])
        }
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    fetch(`/api/admin/creators/creators/${id}/learning`)
      .then((res) => res.ok ? res.json() : null)
      .then((d) => { if (!cancelled && d) setLearning(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id])

  async function resetLearning() {
    if (!confirm("Reset all learning progress and assessment attempts for this creator?")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/creators/creators/${id}/learning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      })
      const d = await res.json()
      setToast(res.ok ? "Learning progress reset" : d.error || "Failed")
      if (res.ok) {
        const r2 = await fetch(`/api/admin/creators/creators/${id}/learning`)
        if (r2.ok) setLearning(await r2.json())
      }
    } finally {
      setBusy(false)
      setTimeout(() => setToast(""), 5000)
    }
  }

  async function setStatus(status: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/creators/creators/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: reason || null }),
      })
      const d = await res.json()
      setToast(res.ok ? `Creator ${status.toLowerCase().replace("_", " ")}` : d.error || "Failed")
      if (res.ok) await load()
    } finally {
      setBusy(false)
      setTimeout(() => setToast(""), 5000)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }
  if (!creator) return <p className="text-muted-foreground py-16 text-center">Creator not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/creators/creators")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {creator.fullName} <span className="text-sm font-mono text-muted-foreground">{creator.creatorId}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {creator.levelLabel || "Starter"} · {creator.status.replace(/_/g, " ")} · ref {creator.referralCode}
          </p>
        </div>
      </div>

      {toast && <p className="rounded-md bg-muted px-4 py-2 text-sm">{toast}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-muted-foreground">Email:</span> {creator.email}</div>
              <div><span className="text-muted-foreground">Phone:</span> {creator.phone || "—"}</div>
              <div><span className="text-muted-foreground">Location:</span> {[creator.city, creator.state].filter(Boolean).join(", ") || "—"}</div>
              <div><span className="text-muted-foreground">Category:</span> {creator.primaryCategory || "—"}</div>
              <div><span className="text-muted-foreground">Activated:</span> {creator.activatedAt ? new Date(creator.activatedAt).toLocaleDateString("en-GB") : "—"}</div>
              <div><span className="text-muted-foreground">Last login:</span> {creator.lastLoginAt ? new Date(creator.lastLoginAt).toLocaleString("en-GB") : "—"}</div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Application:</span>{" "}
                <a href={`/admin/creators/applications/${creator.applicationId}`} className="text-retail hover:underline text-xs">view original application →</a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Performance</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 sm:grid-cols-4 gap-3 text-center">
              {[
                ["Approved", stats?.approvedContent ?? 0],
                ["In review", stats?.pendingSubmissions ?? 0],
                ["Clicks", stats?.clicks ?? 0],
                ["Leads", stats?.leads ?? 0],
                ["Demos", stats?.demoBookings ?? 0],
                ["Sign-ups", stats?.signups ?? 0],
                ["Customers", stats?.conversions ?? 0],
                ["Paid", `₦${((stats?.paidRewardsKobo ?? 0) / 100).toLocaleString("en-NG")}`],
              ].map(([label, v]) => (
                <div key={label as string} className="rounded-lg border p-3">
                  <p className="text-lg font-bold">{v}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Onboarding &amp; Learning</CardTitle>
                {learning && (
                  <Button size="sm" variant="outline" className="text-red-600" disabled={busy} onClick={resetLearning}>
                    Reset progress
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!learning ? (
                <p className="text-sm text-muted-foreground">Loading learning data…</p>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{learning.onboarding.readinessLabel}</span>
                        <span className="text-muted-foreground">
                          {learning.onboarding.requiredDone}/{learning.onboarding.requiredTotal} required · {learning.onboarding.pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-retail rounded-full" style={{ width: `${learning.onboarding.pct}%` }} />
                      </div>
                    </div>
                  </div>
                  {learning.progress.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Not started — no lesson activity yet.</p>
                  ) : (
                    <div className="divide-y rounded-lg border">
                      {learning.progress.map((p) => (
                        <div key={p.contentId} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p.title}</p>
                            <p className="text-muted-foreground">
                              {p.type}{p.required ? " · required" : ""}
                              {p.type === "VIDEO" && p.videoPercent > 0 ? ` · ${Math.round(p.videoPercent)}% watched` : ""}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${p.status === "COMPLETED" ? "bg-green-100 text-green-700" : p.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                            {p.status === "COMPLETED" ? "Done" : p.status === "IN_PROGRESS" ? "In progress" : "—"}
                            {p.score != null ? ` · ${p.score}%` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {learning.attempts.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Assessment attempts</p>
                      <div className="divide-y rounded-lg border">
                        {learning.attempts.map((a, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                            <span>{a.title} · attempt {a.attemptNumber}</span>
                            <span className={a.passed ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                              {a.score}% {a.passed ? "· passed" : "· failed"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{learning.downloads} resource download{learning.downloads === 1 ? "" : "s"} tracked</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Social Profiles</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {socials.length === 0 && <p className="text-sm text-muted-foreground">None linked.</p>}
              {socials.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <p className="font-medium">{s.platform}</p>
                  <a href={s.profile_url} target="_blank" rel="noopener noreferrer" className="text-xs text-retail hover:underline inline-flex items-center gap-1 break-all">
                    {s.profile_url} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Manage</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <textarea className={inputCls} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required to suspend/remove)" />
              {creator.status !== "ACTIVE" && creator.status !== "REMOVED" && (
                <Button size="sm" className="w-full" disabled={busy} onClick={() => setStatus("ACTIVE")}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Reactivate
                </Button>
              )}
              {creator.status === "ACTIVE" && (
                <Button size="sm" variant="outline" className="w-full text-amber-700" disabled={busy || !reason.trim()} onClick={() => setStatus("SUSPENDED")}>
                  <Ban className="w-3.5 h-3.5 mr-1" /> Suspend
                </Button>
              )}
              {creator.status !== "REMOVED" && (
                <Button size="sm" variant="outline" className="w-full text-red-600" disabled={busy || !reason.trim()} onClick={() => setStatus("REMOVED")}>
                  Remove Creator
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Risk Flags</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {flags.length === 0 && <p className="text-sm text-muted-foreground">No flags.</p>}
              {flags.map((f) => (
                <div key={f.id} className="rounded-lg border p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">{f.type.replace(/_/g, " ")}</span>
                    <span className={`rounded-full px-2 py-0.5 ${f.status === "OPEN" ? "bg-red-100 text-red-700" : "bg-muted"}`}>{f.status}</span>
                  </div>
                  <p className="text-muted-foreground mt-1">{f.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Internal Notes</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes.</p>}
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg border p-3 text-xs">
                  <p>{n.note}</p>
                  <p className="text-muted-foreground mt-1">{n.authorName || "—"} · {new Date(n.createdAt).toLocaleString("en-GB")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
