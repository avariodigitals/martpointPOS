"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Trophy, ExternalLink } from "lucide-react"
import { enumLabel } from "@/lib/utils"

interface ChallengeRow {
  id: string
  name: string
  slug: string
  status: string
  rulesVersion: number
  amended: boolean
  startDate: string | null
  submissionDeadline: string | null
  performanceCutoff: string | null
  announcementDate: string | null
  participants: number
  submissions: number
  approvedSubmissions: number
  prizePoolKobo: number | null
  createdAt: string
}

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SCHEDULED: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-green-100 text-green-700",
  SUBMISSION_CLOSED: "bg-amber-100 text-amber-700",
  JUDGING: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  ARCHIVED: "bg-muted text-muted-foreground",
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"
}

export default function AdminChallengesPage() {
  const [challenges, setChallenges] = useState<ChallengeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "", description: "" })
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/admin/creators/challenges")
      .then((r) => r.json())
      .then((d) => setChallenges(d.challenges ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const create = async () => {
    if (inFlight.current || busy) return
    inFlight.current = true
    setBusy(true)
    setError("")
    try {
      const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const res = await fetch("/api/admin/creators/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, slug, description: form.description }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to create"); return }
      window.location.href = `/admin/creators/challenges/${data.id}`
    } finally {
      setBusy(false)
      inFlight.current = false
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Challenges</h2>
          <p className="text-muted-foreground text-sm">Creator challenge campaigns — create, run, judge and reward.</p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> New challenge
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create challenge</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Challenge name"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Slug (auto from name if blank)"
              value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} placeholder="Short description"
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={create} disabled={busy || !form.name.trim()}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Create draft
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
            <p className="text-xs text-muted-foreground">Creates a DRAFT. Configure dates, eligibility, brief, awards and terms on the challenge page before activating.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : challenges.length === 0 ? (
            <div className="p-10 text-center">
              <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No challenges yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first creator challenge to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-4 font-medium">Challenge</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Dates</th>
                    <th className="p-4 font-medium text-right">Joined</th>
                    <th className="p-4 font-medium text-right">Submissions</th>
                    <th className="p-4 font-medium text-right">Prize pool</th>
                    <th className="p-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="p-4">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{c.slug}</p>
                        {c.amended && <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 font-medium">Amended · v{c.rulesVersion}</span>}
                      </td>
                      <td className="p-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[c.status] ?? "bg-muted"}`}>
                          {enumLabel(c.status)}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(c.startDate)} → {fmtDate(c.submissionDeadline)}
                      </td>
                      <td className="p-4 text-right">{c.participants}</td>
                      <td className="p-4 text-right">{c.approvedSubmissions}/{c.submissions}</td>
                      <td className="p-4 text-right text-xs">
                        {c.prizePoolKobo ? `₦${(c.prizePoolKobo / 100).toLocaleString()}` : "—"}
                      </td>
                      <td className="p-4 text-right">
                        <Link href={`/admin/creators/challenges/${c.id}`}>
                          <Button size="sm" variant="outline"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Manage</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
