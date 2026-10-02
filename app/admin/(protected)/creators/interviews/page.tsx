"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CalendarClock, Video } from "lucide-react"
import { enumLabel } from "@/lib/utils"

interface InterviewRow {
  id: string
  application_id: string
  status: string
  scheduled_at: string | null
  duration_minutes: number
  meeting_url: string | null
  meeting_location: string | null
  interviewer_name: string | null
  result: string | null
  creator_applications: { full_name: string; reference_number: string; email: string } | null
}

export default function CreatorInterviewsPage() {
  const [loading, setLoading] = useState(true)
  const [interviews, setInterviews] = useState<InterviewRow[]>([])

  useEffect(() => {
    fetch("/api/admin/creators/interviews")
      .then((r) => r.json())
      .then((d) => setInterviews(d.interviews || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarClock className="w-5 h-5" /> Creator Interviews
        </h2>
        <p className="text-muted-foreground">Scheduled and completed creator interviews.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : interviews.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No interviews scheduled.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {interviews.map((iv) => (
            <Card key={iv.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/creators/applications/${iv.application_id}`}
                    className="font-medium text-sm hover:text-retail"
                  >
                    {iv.creator_applications?.full_name || "Unknown"}{" "}
                    <span className="font-mono text-xs text-muted-foreground">{iv.creator_applications?.reference_number}</span>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleString("en-GB") : "—"} · {iv.duration_minutes}m
                    {iv.interviewer_name ? ` · ${iv.interviewer_name}` : ""}
                  </p>
                  {iv.result && <p className="text-xs mt-1">Result: {iv.result}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {iv.meeting_url && (
                    <a
                      href={iv.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-retail hover:underline"
                    >
                      <Video className="w-3.5 h-3.5" /> Join
                    </a>
                  )}
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{enumLabel(iv.status)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
