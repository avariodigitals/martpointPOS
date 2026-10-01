import { Card, CardContent } from "@/components/ui/card"
import { ClipboardCheck } from "lucide-react"

export default function CreatorSubmissionsAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5" /> Submissions
        </h2>
        <p className="text-muted-foreground">Review published content submitted for challenges.</p>
      </div>
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Submission review ships in Phase 3 alongside the challenge engine.
        </CardContent>
      </Card>
    </div>
  )
}
