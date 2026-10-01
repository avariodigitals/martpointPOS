import { requireCreatorSession } from "@/lib/creator-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { LEARNING_CATEGORY_LABELS, type LearningCategory } from "@/lib/creator-constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, PlayCircle, FileText } from "lucide-react"

export default async function CreatorLearnPage() {
  await requireCreatorSession()

  const lessons = isSupabaseConfigured()
    ? (await supabase
        .from("creator_learning_content")
        .select("id, title, description, category, type, video_url, external_url, related_links, required, sort_order")
        .eq("status", "PUBLISHED")
        .order("sort_order", { ascending: true })
        .limit(200)).data || []
    : []

  const byCategory = new Map<string, typeof lessons>()
  for (const l of lessons) {
    const key = l.category as string
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(l)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-2xl font-bold tracking-tight">Learn MartPoint</h2>
      {lessons.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Learning content coming soon</p>
            <p className="text-sm text-muted-foreground mt-1">
              The MartPoint team is preparing lessons, guides and videos for creators.
            </p>
          </CardContent>
        </Card>
      ) : (
        [...byCategory.entries()].map(([category, items]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {LEARNING_CATEGORY_LABELS[category as LearningCategory] || category}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((l) => (
                <div key={l.id} className="flex items-start gap-3 rounded-lg border p-3">
                  {l.type === "VIDEO"
                    ? <PlayCircle className="w-5 h-5 text-retail mt-0.5 shrink-0" />
                    : <FileText className="w-5 h-5 text-retail mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {l.title}
                      {l.required ? <span className="ml-1.5 text-[10px] font-semibold text-retail uppercase">Required</span> : null}
                    </p>
                    {l.description && <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      {l.video_url && (
                        <a href={l.video_url as string} target="_blank" rel="noopener noreferrer" className="text-xs text-retail hover:underline">
                          Watch video →
                        </a>
                      )}
                      {l.external_url && (
                        <a href={l.external_url as string} target="_blank" rel="noopener noreferrer" className="text-xs text-retail hover:underline">
                          Open guide →
                        </a>
                      )}
                      {((l.related_links as { label?: string; url?: string }[]) || []).map((link, i) =>
                        link?.url ? (
                          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-retail hover:underline">
                            {link.label || "Related link"} →
                          </a>
                        ) : null
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
