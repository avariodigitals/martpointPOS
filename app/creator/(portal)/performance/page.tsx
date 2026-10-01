import { requireCreatorSession } from "@/lib/creator-auth"
import { getCreatorOverviewStats } from "@/lib/creator-applications"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-4 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  )
}

export default async function CreatorPerformancePage() {
  const { creator } = await requireCreatorSession()
  const stats = await getCreatorOverviewStats(creator.id)

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-2xl font-bold tracking-tight">Performance</h2>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Content</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Approved" value={stats.approvedContent} />
          <Stat label="In Review" value={stats.pendingSubmissions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Attribution Funnel</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Stat label="Clicks" value={stats.clicks} />
          <Stat label="Leads" value={stats.leads} />
          <Stat label="Demos" value={stats.demoBookings} />
          <Stat label="Sign-ups" value={stats.signups} />
          <Stat label="Customers" value={stats.conversions} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 flex items-start gap-3">
          <BarChart3 className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Reach and engagement metrics from your content appear here once MartPoint verifies
            submission performance data. Metrics shown during judging are snapshots taken at the
            challenge cutoff.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
