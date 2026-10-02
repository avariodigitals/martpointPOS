"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2, Users, FileText, Clock, BadgeCheck, Trophy,
  MapPin, Funnel, Wallet, Video, GraduationCap, ListChecks,
} from "lucide-react"

interface Stats {
  totalApplications: number
  pendingReview: number
  approvalRate: number
  activeCreators: number
  creatorsByState: { state: string; count: number }[]
  applicationsByState: { state: string; count: number }[]
  activeChallenges: number
  pendingSubmissions: number
  totalLeads: number
  rewardsPaidKobo: number
  learning?: {
    totalCreators: number
    started: number
    completed: number
    completionRate: number
    avgCompletionDays: number | null
    assessmentAttempts: number
    assessmentPasses: number
    assessmentPassRate: number
    incompleteLessons: { contentId: string; title: string; incomplete: number }[]
  }
}

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

export default function CreatorsDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch("/api/admin/creators/dashboard")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Video className="w-5 h-5" /> Creator Network
          </h2>
          <p className="text-muted-foreground">Creator recruitment, challenges and performance overview.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/admin/creators/applications">Applications</Link></Button>
          <Button asChild><Link href="/admin/creators/applications?status=SUBMITTED">Review Queue</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard icon={FileText} label="Applications" value={stats?.totalApplications ?? 0} />
        <StatCard icon={Clock} label="Pending Review" value={stats?.pendingReview ?? 0} color="text-amber-600" />
        <StatCard icon={BadgeCheck} label="Approval Rate" value={`${stats?.approvalRate ?? 0}%`} color="text-green-600" />
        <StatCard icon={Users} label="Active Creators" value={stats?.activeCreators ?? 0} color="text-green-600" />
        <StatCard icon={Trophy} label="Active Challenges" value={stats?.activeChallenges ?? 0} />
        <StatCard icon={FileText} label="Pending Submissions" value={stats?.pendingSubmissions ?? 0} color="text-amber-600" />
        <StatCard icon={Funnel} label="Creator Leads" value={stats?.totalLeads ?? 0} />
        <StatCard icon={Wallet} label="Rewards Paid" value={naira(stats?.rewardsPaidKobo ?? 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><MapPin className="w-4 h-4" /> Creators by state</h3>
            {!stats?.creatorsByState?.length ? (
              <p className="text-sm text-muted-foreground">No creators yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.creatorsByState.slice(0, 12).map((s) => (
                  <li key={s.state} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{s.state}</span>
                    <span className="font-semibold">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><MapPin className="w-4 h-4" /> Applications by state</h3>
            {!stats?.applicationsByState?.length ? (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.applicationsByState.slice(0, 12).map((s) => (
                  <li key={s.state} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{s.state}</span>
                    <span className="font-semibold">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Onboarding &amp; learning</h3>
            {!stats?.learning ? (
              <p className="text-sm text-muted-foreground">No learning data yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between"><span>Started onboarding</span><span className="font-semibold">{stats.learning.started}</span></li>
                <li className="flex justify-between"><span>Completed</span><span className="font-semibold">{stats.learning.completed}</span></li>
                <li className="flex justify-between"><span>Completion rate</span><span className="font-semibold">{stats.learning.completionRate}%</span></li>
                <li className="flex justify-between"><span>Avg. time to complete</span><span className="font-semibold">{stats.learning.avgCompletionDays != null ? `${stats.learning.avgCompletionDays}d` : "—"}</span></li>
                <li className="flex justify-between"><span>Assessment pass rate</span><span className="font-semibold">{stats.learning.assessmentPassRate}%</span></li>
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><ListChecks className="w-4 h-4" /> Required lessons pending</h3>
            {!stats?.learning?.incompleteLessons?.length ? (
              <p className="text-sm text-muted-foreground">All active creators have completed required lessons — or none are configured.</p>
            ) : (
              <ul className="space-y-2">
                {stats.learning.incompleteLessons.slice(0, 10).map((l) => (
                  <li key={l.contentId} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{l.title}</span>
                    <span className="font-semibold">{l.incomplete} pending</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 mb-1"><Icon className="w-4 h-4 text-muted-foreground" /><p className="text-[11px] uppercase text-muted-foreground">{label}</p></div>
      <p className={`text-2xl font-bold ${color || ""}`}>{value}</p>
    </CardContent></Card>
  )
}
