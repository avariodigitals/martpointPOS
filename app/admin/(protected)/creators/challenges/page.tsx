import { Card, CardContent } from "@/components/ui/card"
import { Trophy } from "lucide-react"

export default function CreatorChallengesAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Trophy className="w-5 h-5" /> Challenges
        </h2>
        <p className="text-muted-foreground">Create and manage creator challenges.</p>
      </div>
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Challenge management ships in Phase 3. The data model is already in place.
        </CardContent>
      </Card>
    </div>
  )
}
