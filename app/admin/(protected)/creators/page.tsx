"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2, Users, FileText, Clock, BadgeCheck, Trophy,
  MapPin, Funnel, Wallet, Video,
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
            {!stats || stats.creatorsByState.length === 0 ? (
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
            {!stats || stats.applicationsByState.length === 0 ? (
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
