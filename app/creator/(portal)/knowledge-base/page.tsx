import Link from "next/link"
import { requireCreatorSession } from "@/lib/creator-auth"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen } from "lucide-react"

export default async function CreatorKnowledgeBasePage() {
  await requireCreatorSession()

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight">Knowledge Base</h2>
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <BookOpen className="w-10 h-10 text-retail mx-auto" />
          <div>
            <p className="font-semibold">MartPoint Help Centre</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Detailed product guides for every MartPoint feature — POS, inventory, online store,
              reporting, staff and more. Use these to make accurate, helpful content.
            </p>
          </div>
          <Button asChild>
            <Link href="/help-centre">Open Help Centre</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
