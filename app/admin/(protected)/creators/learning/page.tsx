import { Card, CardContent } from "@/components/ui/card"
import { GraduationCap } from "lucide-react"

export default function CreatorLearningAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="w-5 h-5" /> Learning Centre
        </h2>
        <p className="text-muted-foreground">CMS for creator lessons, guides and onboarding content.</p>
      </div>
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Learning content management ships in Phase 2. All content will be admin-managed — nothing hard-coded.
        </CardContent>
      </Card>
    </div>
  )
}
