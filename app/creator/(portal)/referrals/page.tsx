import { requireCreatorSession } from "@/lib/creator-auth"
import { creatorTrackingUrl } from "@/lib/creators"
import { getCreatorOverviewStats } from "@/lib/creator-applications"
import { CopyLinkButton } from "../copy-link-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Link2 } from "lucide-react"

export default async function CreatorReferralsPage() {
  const { creator } = await requireCreatorSession()
  const stats = await getCreatorOverviewStats(creator.id)
  const url = creatorTrackingUrl(creator.referralCode)

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight">Referrals</h2>

      <Card className="border-retail/40 bg-retail-soft/30">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Link2 className="w-4 h-4 text-retail" /> Your Tracking Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-mono text-sm break-all">{url}</p>
          <p className="text-xs text-muted-foreground">
            Share this link in your content descriptions. Visitors, leads, demo bookings and sign-ups
            through it are attributed to you automatically.
          </p>
          <div className="flex items-center gap-3">
            <CopyLinkButton url={url} />
            <span className="text-xs font-mono text-muted-foreground">Code: {creator.referralCode}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Clicks", value: stats.clicks },
          { label: "Leads", value: stats.leads },
          { label: "Demos", value: stats.demoBookings },
          { label: "Sign-ups", value: stats.signups },
          { label: "Customers", value: stats.conversions },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground uppercase">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
