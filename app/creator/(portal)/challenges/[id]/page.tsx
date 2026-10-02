"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2, ArrowLeft, Trophy, Lock, Clock, AlertTriangle,
  Download, Send, Copy, CheckCheck, Megaphone,
} from "lucide-react"
import { enumLabel } from "@/lib/utils"

interface Detail {
  challenge: {
    id: string; name: string; slug: string; description: string | null
    objective: string | null; theme: string | null; status: string
    startDate: string | null; submissionDeadline: string | null
    performanceCutoff: string | null; announcementDate: string | null
    eligiblePlatforms: string[]; requiredHashtags: string[]; requiredMentions: string[]
    requiredCta: string | null; contentRequirements: string | null
    prohibitedClaims: string | null; judgingCriteria: string | null; terms: string | null
    minSubmissions: number; maxSubmissions: number | null
    rulesVersion: number; amended: boolean; leaderboardVisible: boolean
  }
  awards: { id: string; type: string; title: string; description: string | null; winnersCount: number; cashNaira: number | null; nonCashReward: string | null; judgingCriteria: string | null }[]
  brief: Record<string, unknown> | null
  resources: { linkId: string; required: boolean; resource: { id: string; name: string; description: string | null; category: string } | null }[]
  participant: { status: string; joinedAt: string; rulesVersionAccepted: number; acknowledgedVersion: number | null } | null
  needsAcknowledgement: boolean
  eligibility: { eligible: boolean; reasons: string[] }
  mySubmissions: {
    id: string; platform: string; contentUrl: string; trackingToken: string
    status: string; caption: string | null; publishedAt: string | null
    submittedAt: string; reviewFeedback: string | null
    metrics: { verified: boolean; views: number | null; likes: number | null; comments: number | null; shares: number | null; engagementRate: number | null } | null
    referrals: { clicks: number; leads: number; demos: number; signups: number; customers: number }
  }[]
  leaderboard: { creatorCode: string; displayName: string; metrics: Record<string, number> }[]
  trackingBaseUrl: string
}

const SUB_BADGE: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: "In review queue", cls: "bg-blue-100 text-blue-700" },
  UNDER_REVIEW: { label: "Under review", cls: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Approved", cls: "bg-green-100 text-green-700" },
  NEEDS_CORRECTION: { label: "Needs correction", cls: "bg-orange-100 text-orange-700" },
  REJECTED: { label: "Not accepted", cls: "bg-red-100 text-red-700" },
  DISQUALIFIED: { label: "Disqualified", cls: "bg-red-200 text-red-800" },
}

export default function CreatorChallengeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)

  const load = useCallback(() => {
    fetch(`/api/creator/challenges/${id}`).then((r) => r.json()).then((data) => {
      setD(data)
      const dl = data?.challenge?.submissionDeadline
      setDaysLeft(dl ? Math.max(0, Math.ceil((new Date(dl).getTime() - Date.now()) / 86400000)) : null)
    }).finally(() => setLoading(false))
  }, [id])
  useEffect(() => { load() }, [load])

  const call = async (method: string, body?: unknown) => {
    if (inFlight.current || busy) return
    inFlight.current = true; setBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/creator/challenges/${id}/join`, {
        method, headers: { "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ kind: "err", text: data.reasons?.[0] ?? data.error ?? "Failed" })
      } else {
        setMsg({ kind: "ok", text: method === "POST" ? "You're in! Check the brief and start creating." : "Done." })
        load()
      }
    } finally { setBusy(false); inFlight.current = false }
  }

  const copyLink = (token: string) => {
    const url = `${d!.trackingBaseUrl}&s=${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token); setTimeout(() => setCopied(null), 2000)
    })
  }

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
  if (!d || !(d as { challenge?: unknown }).challenge) {
    return <div className="p-10 text-center text-muted-foreground">Challenge not found.</div>
  }

  const c = d.challenge
  const joined = d.participant?.status === "JOINED"
  const canSubmit = joined && c.status === "ACTIVE"

  const arr = (k: string): string[] => ((d.brief?.[k] as string[] | undefined) ?? [])

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start gap-3">
        <Link href="/creator/challenges"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold tracking-tight">{c.name}</h2>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            {c.theme && <span className="text-retail font-medium">{c.theme}</span>}
            {c.submissionDeadline && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                {daysLeft === 0 ? "Deadline today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to submit`}
              </span>
            )}
            {c.performanceCutoff && <span>Performance measured until {new Date(c.performanceCutoff).toLocaleDateString("en-GB")}</span>}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${c.status === "ACTIVE" ? "bg-green-100 text-green-700" : c.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-muted"}`}>
          {enumLabel(c.status)}
        </span>
      </div>

      {d.needsAcknowledgement && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center justify-between gap-3 flex-wrap">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> This challenge&apos;s rules were amended (now v{c.rulesVersion}). Please review and acknowledge.</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => call("PATCH")}>I&apos;ve reviewed the updated rules</Button>
        </div>
      )}

      {msg && <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>}

      {/* Join card */}
      {!joined && (
        <Card>
          <CardContent className="p-5 space-y-3">
            {d.eligibility.eligible ? (
              <>
                <p className="text-sm">Review the brief, awards and terms below. Joining enters you into the challenge — it doesn&apos;t guarantee a reward. Winners are decided by the rules after the performance period.</p>
                {c.terms && (
                  <div className="rounded-md bg-muted p-3 text-xs max-h-40 overflow-y-auto whitespace-pre-wrap">{c.terms}</div>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                  <span>I&apos;ve read and accept the challenge rules and terms (version {c.rulesVersion}).</span>
                </label>
                <Button onClick={() => call("POST", { acceptTerms: true })} disabled={!acceptTerms || busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Join challenge
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium"><Lock className="w-4 h-4 text-amber-600" /> You can&apos;t join this challenge yet</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {d.eligibility.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {joined && d.participant?.status === "WITHDRAWN" && (
        <p className="text-sm text-muted-foreground">You withdrew from this challenge.</p>
      )}

      {/* Awards */}
      {d.awards.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4" /> Awards</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {d.awards.map((a) => (
              <div key={a.id} className="rounded-md border border-input p-3">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {a.cashNaira ? `₦${a.cashNaira.toLocaleString()}` : ""}{a.cashNaira && a.nonCashReward ? " + " : ""}{a.nonCashReward ?? ""}
                  {" · "}{a.winnersCount} winner{a.winnersCount > 1 ? "s" : ""}
                </p>
                {a.judgingCriteria && <p className="text-[11px] text-muted-foreground mt-1">{a.judgingCriteria}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Brief */}
      <Card>
        <CardHeader><CardTitle className="text-base">Challenge brief</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {(d.brief?.overview || c.description) && <p className="whitespace-pre-wrap">{(d.brief?.overview as string) || c.description}</p>}
          {d.brief?.objective === undefined && c.objective && <p className="text-muted-foreground">Objective: {c.objective}</p>}
          {!!d.brief?.audience && <Section title="Audience" text={d.brief.audience as string} />}
          {!!d.brief?.keyMessage && <Section title="Key message" text={d.brief.keyMessage as string} />}
          {arr("directions").length > 0 && <ListSection title="Content directions" items={arr("directions")} />}
          {arr("requiredElements").length > 0 && <ListSection title="Required elements" items={arr("requiredElements")} />}
          {arr("exampleIdeas").length > 0 && <ListSection title="Ideas &amp; hooks" items={arr("exampleIdeas")} />}

          {(c.requiredHashtags.length > 0 || c.requiredMentions.length > 0 || c.requiredCta) && (
            <div className="rounded-md bg-muted p-3 space-y-1">
              <p className="text-xs font-medium">Required in your post</p>
              {c.requiredHashtags.length > 0 && <p className="text-xs">{c.requiredHashtags.join(" ")}</p>}
              {c.requiredMentions.length > 0 && <p className="text-xs">Mention: {c.requiredMentions.join(", ")}</p>}
              {c.requiredCta && <p className="text-xs">Call to action: {c.requiredCta}</p>}
            </div>
          )}

          {c.contentRequirements && <Section title="Content requirements" text={c.contentRequirements} />}
          {c.prohibitedClaims && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-medium text-red-800">Not allowed</p>
              <p className="text-xs text-red-700 whitespace-pre-wrap mt-1">{c.prohibitedClaims}</p>
            </div>
          )}
          {!!d.brief?.submissionInstructions && <Section title="How to submit" text={d.brief.submissionInstructions as string} />}
          {!!d.brief?.judgingExplainer && <Section title="How winners are decided" text={d.brief.judgingExplainer as string} />}
          {c.judgingCriteria && !d.brief?.judgingExplainer && <Section title="Judging criteria" text={c.judgingCriteria} />}

          {/* Resources */}
          {d.resources.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Challenge resources</p>
              <div className="space-y-1.5">
                {d.resources.map((r) => r.resource && (
                  <a key={r.linkId} href={`/api/creator/resources/${r.resource.id}/open?kind=download`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-xs hover:border-retail/50">
                    <Download className="w-3.5 h-3.5 text-retail" />
                    <span className="font-medium">{r.resource.name}</span>
                    <span className="text-muted-foreground">{enumLabel(r.resource.category)}</span>
                    {r.required && <span className="rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[9px] font-medium">Required</span>}
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My submissions + submit form */}
      {joined && <SubmissionsSection detail={d} canSubmit={canSubmit} reload={load} copyLink={copyLink} copied={copied} />}

      {/* Leaderboard */}
      {c.leaderboardVisible && d.leaderboard.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Leaderboard</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground text-xs">
                <th className="px-4 py-2 font-medium">#</th><th className="px-4 py-2 font-medium">Creator</th>
                <th className="px-4 py-2 font-medium text-right">Submissions</th>
                <th className="px-4 py-2 font-medium text-right">Reach</th>
                <th className="px-4 py-2 font-medium text-right">Clicks</th>
                <th className="px-4 py-2 font-medium text-right">Leads</th>
                <th className="px-4 py-2 font-medium text-right">Conversions</th>
              </tr></thead>
              <tbody>
                {d.leaderboard.map((r, i) => (
                  <tr key={r.creatorCode} className="border-b last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2 font-medium">{r.displayName} <span className="font-mono text-xs text-muted-foreground">{r.creatorCode}</span></td>
                    <td className="px-4 py-2 text-right text-xs">{r.metrics.submissions ?? 0}</td>
                    <td className="px-4 py-2 text-right text-xs">{(r.metrics.reach ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-xs">{r.metrics.clicks ?? 0}</td>
                    <td className="px-4 py-2 text-right text-xs">{r.metrics.leads ?? 0}</td>
                    <td className="px-4 py-2 text-right text-xs">{r.metrics.conversions ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {joined && d.participant?.status === "JOINED" && c.status === "ACTIVE" && (
        <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => { if (confirm("Withdraw from this challenge?")) call("DELETE") }}>
          Withdraw from challenge
        </button>
      )}
    </div>
  )
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="whitespace-pre-wrap mt-0.5">{text}</p>
    </div>
  )
}
function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="list-disc pl-5 mt-0.5 space-y-0.5">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </div>
  )
}

/* ═══ My submissions + submit form ═══ */
function SubmissionsSection({ detail, canSubmit, reload, copyLink, copied }: {
  detail: Detail; canSubmit: boolean; reload: () => void
  copyLink: (token: string) => void; copied: string | null
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ platform: detail.challenge.eligiblePlatforms[0] ?? "INSTAGRAM", contentUrl: "", caption: "", publishedAt: "", notes: "" })
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [evidence, setEvidence] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [err, setErr] = useState("")

  const upload = async (f: File | null): Promise<string | null> => {
    if (!f) return null
    const fd = new FormData()
    fd.append("file", f)
    const res = await fetch("/api/creator/upload", { method: "POST", body: fd })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Upload failed")
    return data.path as string
  }

  const submit = async () => {
    if (inFlight.current || busy) return
    inFlight.current = true; setBusy(true); setErr("")
    try {
      const screenshotPath = await upload(screenshot)
      const analyticsEvidencePath = await upload(evidence)
      const res = await fetch("/api/creator/submissions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: detail.challenge.id, platform: form.platform, contentUrl: form.contentUrl,
          caption: form.caption || null, publishedAt: form.publishedAt || null, notes: form.notes || null,
          screenshotPath, analyticsEvidencePath,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? "Failed"); return }
      setShowForm(false)
      setForm({ ...form, contentUrl: "", caption: "", notes: "" })
      setScreenshot(null); setEvidence(null)
      reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally { setBusy(false); inFlight.current = false }
  }

  const maxReached = detail.challenge.maxSubmissions != null &&
    detail.mySubmissions.filter((s) => s.status !== "DISQUALIFIED").length >= detail.challenge.maxSubmissions

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">My submissions</h3>
        {canSubmit && !maxReached && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Send className="w-3.5 h-3.5 mr-1" /> Submit content
          </Button>
        )}
      </div>

      {canSubmit && (
        <p className="text-xs text-muted-foreground">
          Track link for approved submissions: <span className="font-mono">{detail.trackingBaseUrl}</span> — after approval each submission gets its own tracking link so we can measure exactly which post performs.
        </p>
      )}

      {showForm && canSubmit && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs"><span className="block font-medium mb-1 text-muted-foreground">Platform</span>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                  {(detail.challenge.eligiblePlatforms.length ? detail.challenge.eligiblePlatforms : ["TIKTOK", "INSTAGRAM", "YOUTUBE", "FACEBOOK", "X", "LINKEDIN", "BLOG", "OTHER"]).map((p) => (
                    <option key={p} value={p}>{enumLabel(p)}</option>
                  ))}
                </select></label>
              <label className="text-xs"><span className="block font-medium mb-1 text-muted-foreground">Published at (date &amp; time)</span>
                <input type="datetime-local" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.publishedAt} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })} /></label>
            </div>
            <label className="text-xs block"><span className="block font-medium mb-1 text-muted-foreground">Public content URL *</span>
              <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="https://tiktok.com/@you/video/…" value={form.contentUrl} onChange={(e) => setForm({ ...form, contentUrl: e.target.value })} /></label>
            <label className="text-xs block"><span className="block font-medium mb-1 text-muted-foreground">Caption (optional)</span>
              <textarea rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs block"><span className="block font-medium mb-1 text-muted-foreground">Screenshot (optional)</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="text-xs" onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)} /></label>
              <label className="text-xs block"><span className="block font-medium mb-1 text-muted-foreground">Analytics evidence (optional)</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="text-xs" onChange={(e) => setEvidence(e.target.files?.[0] ?? null)} /></label>
            </div>
            <label className="text-xs block"><span className="block font-medium mb-1 text-muted-foreground">Notes for the review team (optional)</span>
              <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="flex gap-2">
              <Button onClick={submit} disabled={busy || !form.contentUrl.trim()}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Submit for review
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {detail.mySubmissions.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          {canSubmit ? "Nothing submitted yet — publish your content on the platform, then submit the public URL here." : "No submissions."}
        </CardContent></Card>
      ) : (
        detail.mySubmissions.map((s) => {
          const badge = SUB_BADGE[s.status] ?? { label: s.status, cls: "bg-muted" }
          return (
            <Card key={s.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a href={s.contentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-retail hover:underline break-all">{s.contentUrl}</a>
                    <p className="text-[11px] text-muted-foreground">{enumLabel(s.platform)} · submitted {new Date(s.submittedAt).toLocaleString("en-GB")}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                </div>
                {s.reviewFeedback && <p className="text-xs bg-muted rounded px-2 py-1.5">{s.reviewFeedback}</p>}
                {s.status === "APPROVED" && (
                  <div className="rounded-md bg-muted p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium">Your tracking link — share this in your post/bio</p>
                      <button onClick={() => copyLink(s.trackingToken)} className="flex items-center gap-1 text-[11px] text-retail hover:underline">
                        {copied === s.trackingToken ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === s.trackingToken ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="font-mono text-[11px] break-all text-muted-foreground">{detail.trackingBaseUrl}&amp;s={s.trackingToken}</p>
                  </div>
                )}
                {(s.metrics || s.referrals.clicks > 0 || s.referrals.leads > 0) && (
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    {s.metrics && <span>{Number(s.metrics.views ?? 0).toLocaleString()} views · {Number(s.metrics.likes ?? 0)} likes{s.metrics.verified ? " · verified" : " · awaiting verification"}</span>}
                    <span>{s.referrals.clicks} clicks · {s.referrals.leads} leads · {s.referrals.demos} demos · {s.referrals.customers} conversions</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}

      {canSubmit && detail.challenge.status === "ACTIVE" && detail.challenge.minSubmissions > detail.mySubmissions.filter((s) => s.status === "APPROVED").length && (
        <p className="flex items-center gap-1.5 text-xs text-amber-700"><Megaphone className="w-3.5 h-3.5" />This challenge needs at least {detail.challenge.minSubmissions} approved submission{detail.challenge.minSubmissions > 1 ? "s" : ""} to be eligible for awards.</p>
      )}
    </div>
  )
}
