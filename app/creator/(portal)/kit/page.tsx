import { requireCreatorSession } from "@/lib/creator-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { createCreatorFileSignedUrl } from "@/lib/creator-storage"
import { RESOURCE_CATEGORY_LABELS, type ResourceCategory } from "@/lib/creator-constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FolderOpen, Download, ExternalLink } from "lucide-react"

export default async function CreatorKitPage() {
  await requireCreatorSession()

  const rows = isSupabaseConfigured()
    ? (await supabase
        .from("creator_resources")
        .select("id, name, description, category, file_path, external_url, version, published_at")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .limit(200)).data || []
    : []

  // Private files get short-lived signed URLs; external links pass through.
  const resources = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      href: (r.external_url as string | null)
        || (r.file_path ? await createCreatorFileSignedUrl(r.file_path as string, 300) : null),
      isFile: Boolean(r.file_path),
    }))
  )

  const byCategory = new Map<string, typeof resources>()
  for (const r of resources) {
    const key = r.category as string
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(r)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-2xl font-bold tracking-tight">Creator Kit</h2>
      {resources.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Creator Kit coming soon</p>
            <p className="text-sm text-muted-foreground mt-1">
              Brand assets, product screenshots, guides and templates will be available here.
            </p>
          </CardContent>
        </Card>
      ) : (
        [...byCategory.entries()].map(([category, items]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {RESOURCE_CATEGORY_LABELS[category as ResourceCategory] || category}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{r.name}{r.version ? <span className="text-xs text-muted-foreground ml-1">v{r.version}</span> : null}</p>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                  </div>
                  {r.href && (
                    <a
                      href={r.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 text-xs text-retail hover:underline"
                    >
                      {r.isFile ? <Download className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                      {r.isFile ? "Download" : "Open"}
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
