import { requireCreatorSession } from "@/lib/creator-auth"
import { listKbLinks } from "@/lib/creator-resources"
import { KbLinks } from "./kb-links"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen, ExternalLink } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function CreatorKbPage() {
  await requireCreatorSession()
  const links = await listKbLinks({ activeOnly: true })

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Knowledge Base</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Curated MartPoint help topics for creators — deeper product detail when you need it.
        </p>
      </div>

      <Card className="border-retail/30 bg-retail-soft/30">
        <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-retail shrink-0" />
            <p className="text-sm">
              The full public Help Centre has step-by-step product guides.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/help-centre" target="_blank" rel="noopener noreferrer">
              Open Help Centre <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {links.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Curated topics are being added — use the Help Centre above for now.
          </CardContent>
        </Card>
      ) : (
        <KbLinks links={links} />
      )}
    </div>
  )
}
