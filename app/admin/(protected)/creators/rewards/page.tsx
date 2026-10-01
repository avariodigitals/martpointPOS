import { Card, CardContent } from "@/components/ui/card"
import { Wallet } from "lucide-react"

export default function CreatorRewardsAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="w-5 h-5" /> Rewards
        </h2>
        <p className="text-muted-foreground">Reward ledger, approvals and payouts.</p>
      </div>
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          The rewards ledger ships in Phase 5.
        </CardContent>
      </Card>
    </div>
  )
}
