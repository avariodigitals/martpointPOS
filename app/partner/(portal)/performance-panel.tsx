"use client"

import { useEffect, useState } from "react"
import { Award, CheckCircle2, Circle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GRADED_PARTNER_TYPE_LABEL, type GradedPartnerType } from "@/lib/partner-performance-grading"

type Track = {
  partnerType: string; currentGrade: string; nextGrade: string | null; qualifyingOutcomes: number;
  partnershipDays: number; requiredOutcomes: number | null; requiredDays: number | null;
  progressPercent: number; eligibleForAssessment: boolean; outstanding: string[]; policyStatus: string;
}

export function PerformancePanel() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  useEffect(() => {
    let active = true
    fetch("/api/partner/performance").then(async (res) => {
      if (!res.ok) throw new Error("Could not load grading progress")
      return res.json()
    }).then((data) => { if (active) { setTracks(data.tracks || []); setState("ready") } }).catch(() => { if (active) setState("error") })
    return () => { active = false }
  }, [])

  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2 text-sm font-medium"><Award className="h-4 w-4" /> Performance &amp; Grading</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      {state === "loading" && <p className="text-sm text-muted-foreground">Loading verified performance records…</p>}
      {state === "error" && <p className="text-sm text-muted-foreground">Performance progress is temporarily unavailable.</p>}
      {state === "ready" && tracks.length === 0 && <p className="text-sm text-muted-foreground">No performance tracks apply to this Partner Type.</p>}
      {tracks.map((track) => <section key={track.partnerType} className="space-y-3 border-b border-border pb-4 last:border-0 last:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="font-semibold">{GRADED_PARTNER_TYPE_LABEL[track.partnerType as GradedPartnerType] || track.partnerType}</h3><p className="text-xs text-muted-foreground">{track.currentGrade === "UNGRADED" ? "Ungraded" : `${track.currentGrade.charAt(0)}${track.currentGrade.slice(1).toLowerCase()} Partner`} · {track.policyStatus === "APPROVED" ? "Current policy" : track.policyStatus === "NOT_CONFIGURED" ? "Awaiting approved criteria" : "Proposed criteria"}</p></div>
          {track.eligibleForAssessment && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Ready for Management review</span>}
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div><span className="text-muted-foreground">Verified outcomes</span><p className="font-medium">{track.qualifyingOutcomes}{track.requiredOutcomes && track.nextGrade ? ` / ${track.requiredOutcomes}` : ""}</p></div>
          <div><span className="text-muted-foreground">Partnership duration</span><p className="font-medium">{track.partnershipDays} days{track.requiredDays ? ` / ${track.requiredDays}` : ""}</p></div>
          <div><span className="text-muted-foreground">Next grade</span><p className="font-medium">{track.nextGrade || "Top grade reached"}</p></div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-retail transition-all" style={{ width: `${track.progressPercent}%` }} /></div>
        {track.outstanding.length ? <div className="space-y-1">{track.outstanding.map((item, i) => <p className="flex items-start gap-2 text-xs text-muted-foreground" key={`${track.partnerType}-${i}`}><Circle className="mt-0.5 h-3 w-3 shrink-0" />{item}</p>)}</div> : <p className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Qualification requirements met. Grade remains subject to formal Management approval.</p>}
      </section>)}
      {state === "ready" && <p className="text-xs text-muted-foreground">Each track counts only verified, type-specific business outcomes. Leads, meetings, demonstrations, proposals, training and the 90-day activity check do not award a grade. Grades are separate by Partner Type and do not change contractual earnings.</p>}
    </CardContent>
  </Card>
}
