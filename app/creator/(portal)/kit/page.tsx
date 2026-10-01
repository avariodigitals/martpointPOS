import { requireCreatorSession } from "@/lib/creator-auth"
import { listResources } from "@/lib/creator-resources"
import { KitBrowser } from "./kit-browser"
import { Card, CardContent } from "@/components/ui/card"
import { FolderOpen } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function CreatorKitPage() {
  await requireCreatorSession()
  const resources = await listResources({ activeOnly: true })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Creator Kit</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Official MartPoint assets, guides and templates. Always use official
          product screenshots and descriptions — never recreate the interface yourself.
        </p>
      </div>

      {resources.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Creator Kit is being stocked</p>
            <p className="text-sm text-muted-foreground mt-1">
              Logos, screenshots, guides and templates will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <KitBrowser
          resources={resources.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            category: r.category,
            resourceType: r.resourceType,
            version: r.version,
            usageNotes: r.usageNotes,
            downloadCount: r.downloadCount,
            hasFile: !!r.filePath,
            hasLink: !!r.externalUrl,
          }))}
        />
      )}
    </div>
  )
}
