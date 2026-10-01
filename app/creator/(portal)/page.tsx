import Link from "next/link"
import { redirect } from "next/navigation"
import { requireCreatorSession } from "@/lib/creator-auth"
import { getCreatorOverviewStats } from "@/lib/creator-applications"
import { listCreatorNotifications } from "@/lib/creator-notifications"
import { creatorTrackingUrl } from "@/lib/creators"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CopyLinkButton } from "./copy-link-button"
import { BadgeCheck, Trophy, Wallet, Bell, GraduationCap } from "lucide-react"

function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      </CardContent>
    </Card>
  )
}

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

export default async function CreatorDashboardPage() {
  const { creator } = await requireCreatorSession()
  if (!creator) redirect("/creator/login")

  const [stats, notifications, challenges] = await Promise.all([
    getCreatorOverviewStats(creator.id),
    listCreatorNotifications(creator.id, 6),
    isSupabaseConfigured()
      ? supabase
          .from("creator_challenges")
          .select("id, name, slug, submission_deadline, status")
          .eq("status", "ACTIVE")
          .order("submission_deadline", { ascending: true })
          .limit(5)
          .then((r) => r.data || [])
      : Promise.resolve([]),
  ])

  const trackingUrl = creatorTrackingUrl(creator.referralCode)
  const unread = notifications.filter((n) => !n.readAt).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome back, {creator.fullName.split(" ")[0]}</h2>
          <div className="flex items-center gap-2 mt-1">
            <BadgeCheck className="w-4 h-4 text-green-600" />
            <span className="text-sm text-muted-foreground">
              {creator.levelLabel || "Starter"} Creator · {creator.creatorId}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link href="/creator/challenges">View Challenges</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/creator/learn">Learn MartPoint</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/creator/kit">Creator Kit</Link></Button>
        </div>
      </div>

      {/* Referral link card */}
      <Card className="border-retail/40 bg-retail-soft/30">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-retail">Your tracking link</p>
            <p className="font-mono text-sm truncate mt-1">{trackingUrl}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Referral code: <span className="font-mono font-semibold">{creator.referralCode}</span>
            </p>
          </div>
          <CopyLinkButton url={trackingUrl} />
        </CardContent>
      </Card>

      {/* Onboarding prompt */}
      {stats.onboardingStatus !== "COMPLETED" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-4">
            <GraduationCap className="w-8 h-8 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900">Complete your onboarding</p>
              <p className="text-sm text-amber-800">
                Learn how MartPoint works before joining challenges.{" "}
                {stats.onboardingProgress > 0 ? `${Math.round(stats.onboardingProgress)}% complete.` : ""}
              </p>
            </div>
            <Button asChild size="sm"><Link href="/creator/learn">Continue</Link></Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric value={stats.approvedContent} label="Approved Content" />
        <Metric value={stats.pendingSubmissions} label="Awaiting Review" />
        <Metric value={stats.clicks} label="Link Clicks" />
        <Metric value={stats.leads} label="Leads" />
        <Metric value={stats.demoBookings} label="Demo Bookings" />
        <Metric value={stats.signups} label="Sign-ups" />
        <Metric value={stats.conversions} label="Customers" />
        <Metric value={naira(stats.paidRewardsKobo)} label="Rewards Paid" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active challenges */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="w-4 h-4 text-retail" /> Active Challenges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {challenges.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No active challenges right now — we&apos;ll notify you when one launches.
              </p>
            )}
            {challenges.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  {c.submission_deadline && (
                    <p className="text-xs text-muted-foreground">
                      Deadline: {new Date(c.submission_deadline as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/creator/challenges`}>View</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Rewards summary + notifications */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="w-4 h-4 text-retail" /> Rewards
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold">{naira(stats.pendingRewardsKobo)}</p>
                <p className="text-[11px] text-muted-foreground uppercase">Pending</p>
              </div>
              <div>
                <p className="text-lg font-bold">{naira(stats.approvedRewardsKobo)}</p>
                <p className="text-[11px] text-muted-foreground uppercase">Approved</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{naira(stats.paidRewardsKobo)}</p>
                <p className="text-[11px] text-muted-foreground uppercase">Paid</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bell className="w-4 h-4 text-retail" /> Notifications
                {unread > 0 && (
                  <span className="rounded-full bg-retail px-2 py-0.5 text-[10px] font-bold text-white">{unread}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {notifications.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              )}
              {notifications.map((n) => (
                <div key={n.id} className="text-sm rounded-lg border p-3">
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
              ))}
              {notifications.length > 0 && (
                <Link href="/creator/notifications" className="text-xs text-retail hover:underline">
                  View all →
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
