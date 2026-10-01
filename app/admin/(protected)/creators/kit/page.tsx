import { Card, CardContent } from "@/components/ui/card"
import { FolderOpen } from "lucide-react"

export default function CreatorKitAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderOpen className="w-5 h-5" /> Creator Kit
        </h2>
        <p className="text-muted-foreground">Manage downloadable resources for creators.</p>
      </div>
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Creator Kit management ships in Phase 2.
        </CardContent>
      </Card>
    </div>
  )
}
