import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"

export default function CreatorLeaderboardAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="w-5 h-5" /> Leaderboard
        </h2>
        <p className="text-muted-foreground">Creator rankings and challenge standings.</p>
      </div>
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Leaderboards ship in Phase 4 once attribution and verified metrics are live.
        </CardContent>
      </Card>
    </div>
  )
}
