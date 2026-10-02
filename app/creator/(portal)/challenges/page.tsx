"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Trophy, Lock, CheckCircle2, Clock } from "lucide-react"
import { enumLabel } from "@/lib/utils"

interface ChallengeCard {
  id: string; name: string; description: string | null; theme: string | null
  status: string; startDate: string | null; submissionDeadline: string | null
  announcementDate: string | null; eligiblePlatforms: string[]
  featured: boolean; amended: boolean
  joined: boolean; participantStatus: string | null
  awardsCount: number; topPrizeLabel: string | null
  eligible: boolean; reasons: string[]
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: "Coming soon", cls: "bg-blue-100 text-blue-700" },
  ACTIVE: { label: "Active", cls: "bg-green-100 text-green-700" },
  SUBMISSION_CLOSED: { label: "Submissions closed", cls: "bg-amber-100 text-amber-700" },
  JUDGING: { label: "Judging", cls: "bg-purple-100 text-purple-700" },
  COMPLETED: { label: "Completed", cls: "bg-emerald-100 text-emerald-800" },
}

export default function CreatorChallengesPage() {
  const [items, setItems] = useState<ChallengeCard[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"available" | "joined" | "completed">("available")

  useEffect(() => {
    fetch("/api/creator/challenges")
      .then((r) => r.json())
      .then((d) => setItems(d.challenges ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const joined = items.filter((c) => c.participantStatus === "JOINED")
  const completed = items.filter((c) => c.status === "COMPLETED" || (c.participantStatus && c.status !== "ACTIVE"))
  const available = items.filter((c) => !joined.includes(c) && !completed.includes(c))
  const shown = tab === "joined" ? joined : tab === "completed" ? completed : available

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Challenges</h2>
        <p className="text-sm text-muted-foreground">Join creator challenges, publish content, and compete for awards. Joining never guarantees a reward — winners are decided by the challenge rules.</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["available", "joined", "completed"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${tab === t ? "border-retail text-foreground" : "border-transparent text-muted-foreground"}`}>
            {t} {t === "joined" && joined.length > 0 ? `(${joined.length})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : shown.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">
            {tab === "available" ? "No challenges open right now" : tab === "joined" ? "You haven't joined any challenges" : "No completed challenges"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === "available" ? "New challenges are announced in your notifications." : "Challenges you join will appear here."}
          </p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {shown.map((c) => {
            const badge = STATUS_BADGE[c.status] ?? { label: enumLabel(c.status), cls: "bg-muted" }
            return (
              <Link key={c.id} href={`/creator/challenges/${c.id}`}>
                <Card className="hover:border-retail/50 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{c.name}</p>
                          {c.joined && <span className="rounded-full bg-retail/10 text-retail px-2 py-0.5 text-[10px] font-medium">Joined</span>}
                          {c.amended && <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-medium">Rules updated</span>}
                        </div>
                        {c.theme && <p className="text-xs text-retail mt-0.5">{c.theme}</p>}
                        {c.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          {c.submissionDeadline && (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Deadline {new Date(c.submissionDeadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                          )}
                          {c.eligiblePlatforms.length > 0 && <span>{c.eligiblePlatforms.map(enumLabel).join(", ")}</span>}
                          {c.topPrizeLabel && <span className="font-medium text-foreground">Up to {c.topPrizeLabel} in prizes</span>}
                          {c.awardsCount > 0 && <span>{c.awardsCount} award{c.awardsCount > 1 ? "s" : ""}</span>}
                        </div>
                        {!c.eligible && c.reasons.length > 0 && (
                          <p className="flex items-center gap-1 text-xs text-amber-700 mt-2"><Lock className="w-3 h-3" />{c.reasons[0]}</p>
                        )}
                        {c.joined && <p className="flex items-center gap-1 text-xs text-green-700 mt-2"><CheckCircle2 className="w-3 h-3" />You&apos;re in — check the brief and submit your content.</p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
