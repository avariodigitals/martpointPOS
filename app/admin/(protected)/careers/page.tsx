"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2, Briefcase, FileText, Clock, Users, Star, ClipboardCheck,
  CheckCircle2, MapPin, UserCheck, AlertCircle, Activity,
} from "lucide-react"
import { enumLabel } from "@/lib/utils"

interface Stats {
  draftVacancies: number
  publishedVacancies: number
  closingSoon: number
  totalApplications: number
  newApplications: number
  shortlisted: number
  assessmentPending: number
  verified: number
  availableWorkers: number
  deployedWorkers: number
  activeDeployments: number
  talentPool: number
}

interface ByVacancy { vacancyId: string; title: string; count: number }
interface ByState { state: string; count: number }
interface AuditEvent {
  id: string; action: string; actor_name: string | null
  entity_type: string; created_at: string; metadata: Record<string, unknown> | null
}

export default function CareersDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [byVacancy, setByVacancy] = useState<ByVacancy[]>([])
  const [byState, setByState] = useState<ByState[]>([])
  const [recent, setRecent] = useState<AuditEvent[]>([])

  useEffect(() => {
    fetch("/api/admin/careers/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats || null)
        setByVacancy(d.byVacancy || [])
        setByState(d.byState || [])
        setRecent(d.recent || [])
      })
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
            <Briefcase className="w-5 h-5" /> Careers Dashboard
          </h2>
          <p className="text-muted-foreground">Recruitment pipeline and field workforce overview.</p>
        </div>
        <Button asChild>
          <Link href="/admin/careers/vacancies/new">New Vacancy</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard icon={FileText} label="Draft Vacancies" value={stats?.draftVacancies ?? 0} />
        <StatCard icon={Briefcase} label="Published" value={stats?.publishedVacancies ?? 0} color="text-green-600" />
        <StatCard icon={Clock} label="Closing Soon" value={stats?.closingSoon ?? 0} color="text-amber-600" />
        <StatCard icon={FileText} label="Total Applications" value={stats?.totalApplications ?? 0} />
        <StatCard icon={AlertCircle} label="New / Unreviewed" value={stats?.newApplications ?? 0} color="text-blue-600" />
        <StatCard icon={Star} label="Shortlisted" value={stats?.shortlisted ?? 0} color="text-purple-600" />
        <StatCard icon={ClipboardCheck} label="Assessment Pending" value={stats?.assessmentPending ?? 0} color="text-amber-600" />
        <StatCard icon={CheckCircle2} label="Verified / Selected" value={stats?.verified ?? 0} color="text-teal-600" />
        <StatCard icon={UserCheck} label="Verified Workers" value={stats?.availableWorkers ?? 0} color="text-green-600" />
        <StatCard icon={MapPin} label="Deployed Workers" value={stats?.deployedWorkers ?? 0} color="text-green-700" />
        <StatCard icon={Activity} label="Active Deployments" value={stats?.activeDeployments ?? 0} />
        <StatCard icon={Users} label="Talent Pool" value={stats?.talentPool ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Applications by vacancy</h3>
            {byVacancy.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              <ul className="space-y-2">
                {byVacancy.map((v) => (
                  <li key={v.vacancyId} className="flex items-center justify-between text-sm">
                    <Link href={`/admin/careers/vacancies/${v.vacancyId}`} className="text-foreground hover:text-retail truncate pr-3">
                      {v.title}
                    </Link>
                    <span className="font-semibold">{v.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Applications by location</h3>
            {byState.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              <ul className="space-y-2">
                {byState.map((s) => (
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
            <h3 className="text-sm font-semibold mb-4">Recent recruitment activity</h3>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {recent.slice(0, 12).map((e) => (
                  <li key={e.id} className="text-xs">
                    <span className="font-medium text-foreground">{enumLabel(e.action)}</span>
                    <span className="text-muted-foreground"> — {e.actor_name || "System"} · {new Date(e.created_at).toLocaleString()}</span>
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

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 mb-1"><Icon className="w-4 h-4 text-muted-foreground" /><p className="text-[11px] uppercase text-muted-foreground">{label}</p></div>
      <p className={`text-2xl font-bold ${color || ""}`}>{value}</p>
    </CardContent></Card>
  )
}
