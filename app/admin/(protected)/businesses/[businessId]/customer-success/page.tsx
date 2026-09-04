"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, HeartHandshake, ArrowLeft, Activity, TrendingUp } from "lucide-react"
import type { CustomerSuccessProfile, CustomerSuccessActivity, HealthSignals } from "@/lib/customer-success"

const STAGE_COLORS: Record<string, string> = {
  ONBOARDING: "bg-blue-100 text-blue-700",
  LIVE: "bg-green-100 text-green-700",
  ADOPTION: "bg-indigo-100 text-indigo-700",
  AT_RISK: "bg-amber-100 text-amber-700",
  RENEWAL: "bg-violet-100 text-violet-700",
  CHURNED: "bg-gray-100 text-gray-700",
}

const HEALTH_COLORS: Record<string, string> = {
  HEALTHY: "bg-green-100 text-green-700",
  WATCH: "bg-amber-100 text-amber-700",
  AT_RISK: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

export default function BusinessCustomerSuccessPage() {
  const { businessId } = useParams() as { businessId: string }
  const [profile, setProfile] = useState<CustomerSuccessProfile | null>(null)
  const [activities, setActivities] = useState<CustomerSuccessActivity[]>([])
  const [signals, setSignals] = useState<HealthSignals | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/customer-success?business=${businessId}`)
      const data = await res.json()
      if (data.success) {
        setProfile(data.profile as CustomerSuccessProfile | null)
        setActivities((data.activities || []) as CustomerSuccessActivity[])
        setSignals(data.signals as HealthSignals | null)
      } else {
        setMessage(data.error || "Failed to load customer success data")
      }
    } catch {
      setMessage("Failed to load customer success data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!businessId) return
    load()
  }, [businessId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/businesses/${businessId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Business
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <HeartHandshake className="w-5 h-5" />
          Customer Success · {businessId}
        </h2>
      </div>

      {message && <p className="text-sm text-red-500">{message}</p>}

      {!profile ? (
        <p className="text-sm text-muted-foreground">No customer success profile for this business.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Stage</p>
                <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STAGE_COLORS[profile.stage]}`}>
                  {profile.stage}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Health</p>
                <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${HEALTH_COLORS[profile.health]}`}>
                  {profile.health}
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Owner</p>
                <p className="text-lg font-bold">{profile.owner_admin_user_id || "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Last Contact</p>
                <p className="text-lg font-bold">{fmtDate(profile.last_contact_at)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Health Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {signals ? (
                  <>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Open tickets</span><span className="font-medium">{signals.open_tickets ?? "—"}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Urgent tickets</span><span className="font-medium">{signals.urgent_tickets ?? "—"}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">SLA breaches</span><span className="font-medium">{signals.sla_breaches ?? "—"}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Outstanding balance</span><span className="font-medium">{signals.outstanding_balance ?? "—"}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Renewal approaching</span><span className="font-medium">{signals.renewal_approaching ? "Yes" : "No"}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Onboarding complete</span><span className="font-medium">{signals.onboarding_incomplete ? "No" : "Yes"}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Deployment live</span><span className="font-medium">{signals.deployment_not_live ? "No" : "Yes"}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Training complete</span><span className="font-medium">{signals.training_complete ? "Yes" : "No"}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Last contact days</span><span className="font-medium">{signals.last_contact_days ?? "—"}</span></div>
                    <div className="flex items-center justify-between"><span className="text-muted-foreground">Subscription status</span><span className="font-medium">{signals.subscription_status || "—"}</span></div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No health signals available.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Next Action
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile.next_follow_up_at ? (
                  <div className="text-sm space-y-1">
                    <p className="font-medium">Next follow-up: {fmtDate(profile.next_follow_up_at)}</p>
                    {activities[0]?.next_action && (
                      <p className="text-muted-foreground">{activities[0].next_action}</p>
                    )}
                    {!activities[0]?.next_action && <p className="text-muted-foreground">No next action recorded.</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No follow-up scheduled.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4" /> Recent Activities ({activities.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No activities yet.</p>
              ) : (
                <div className="space-y-2">
                  {activities.map((a) => (
                    <div key={a.id} className="p-3 rounded-md border border-border bg-muted/10 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{a.activity_type}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(a.created_at)}</span>
                      </div>
                      <p className="mt-0.5">{a.summary}</p>
                      {a.outcome && <p className="text-xs text-muted-foreground">Outcome: {a.outcome}</p>}
                      {a.next_action && <p className="text-xs text-muted-foreground">Next: {a.next_action} · {fmtDate(a.next_action_at)}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
