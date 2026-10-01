import { Card, CardContent } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

export default function CreatorReportsAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5" /> Creator Reports
        </h2>
        <p className="text-muted-foreground">Acquisition funnel, performance and reward expenditure reports.</p>
      </div>
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Creator reporting ships in Phase 4.
        </CardContent>
      </Card>
    </div>
  )
}
