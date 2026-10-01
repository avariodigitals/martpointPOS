import Link from "next/link"
import { requireCreatorSession } from "@/lib/creator-auth"
import {
  listPublishedLearning,
  getProgressMap,
  getOnboardingState,
} from "@/lib/creator-learning"
import {
  LEARNING_CATEGORY_LABELS,
  LEARNING_TYPE_LABELS,
  CREATOR_READINESS_LABELS,
  type LearningCategory,
} from "@/lib/creator-constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  GraduationCap,
  CheckCircle2,
  Circle,
  PlayCircle,
  FileText,
  ClipboardCheck,
  ArrowRight,
  Lock,
  Download,
  Link2,
  Map,
} from "lucide-react"

export const dynamic = "force-dynamic"

function TypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "VIDEO":
      return <PlayCircle className={className} />
    case "ASSESSMENT":
      return <ClipboardCheck className={className} />
    case "LINK":
      return <Link2 className={className} />
    case "DOWNLOAD":
      return <Download className={className} />
    default:
      return <FileText className={className} />
  }
}

export default async function CreatorLearnPage() {
  const { creator } = await requireCreatorSession()

  const [all, progress, onboarding] = await Promise.all([
    listPublishedLearning(),
    getProgressMap(creator.id),
    getOnboardingState(creator.id),
  ])

  const journey = all
    .filter((c) => c.isOnboardingStep || c.required)
    .sort((a, b) => (a.onboardingOrder ?? a.sortOrder) - (b.onboardingOrder ?? b.sortOrder))
  const library = all.filter((c) => !c.isOnboardingStep && !c.required)

  const byCategory = new globalThis.Map<string, typeof library>()
  for (const l of library) {
    if (!byCategory.has(l.category)) byCategory.set(l.category, [])
    byCategory.get(l.category)!.push(l)
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Learn MartPoint</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Finish the onboarding path to unlock Creator Challenges.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            onboarding.readiness === "READY"
              ? "bg-green-100 text-green-700"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {CREATOR_READINESS_LABELS[onboarding.readiness]}
        </span>
      </div>

      {/* Onboarding journey */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Creator Onboarding</CardTitle>
            <span className="text-sm font-semibold text-retail">
              {onboarding.progressPct}% complete
            </span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-retail transition-all"
              style={{ width: `${onboarding.progressPct}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {journey.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Onboarding lessons are being prepared.
            </p>
          )}
          {journey.map((item, i) => {
            const p = progress.get(item.id)
            const done = p?.status === "COMPLETED"
            const isNext = !done && journey.slice(0, i).every((j) => progress.get(j.id)?.status === "COMPLETED")
            return (
              <Link
                key={item.id}
                href={`/creator/learn/${item.slug}`}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  isNext
                    ? "border-retail/50 bg-retail-soft/40"
                    : "border-transparent hover:bg-muted/50"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <Circle className={`h-5 w-5 shrink-0 ${isNext ? "text-retail" : "text-muted-foreground/50"}`} />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? "text-muted-foreground" : ""}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {LEARNING_TYPE_LABELS[item.type]}
                    {item.required ? " · Required" : " · Optional"}
                    {p && !done && item.type === "VIDEO" && p.progressPct > 0
                      ? ` · ${Math.round(p.progressPct)}% watched`
                      : ""}
                    {done && p?.score != null ? ` · Score ${p.score}%` : ""}
                  </p>
                </div>
                {isNext && (
                  <span className="text-xs font-semibold text-retail flex items-center gap-1 shrink-0">
                    Continue <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </Link>
            )
          })}
        </CardContent>
      </Card>

      {/* Optional library */}
      {library.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Library</h3>
          {[...byCategory.entries()].map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {LEARNING_CATEGORY_LABELS[category as LearningCategory] || category}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((l) => {
                  const done = progress.get(l.id)?.status === "COMPLETED"
                  return (
                    <Link
                      key={l.id}
                      href={`/creator/learn/${l.slug}`}
                      className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <TypeIcon type={l.type} className="h-5 w-5 text-retail mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium flex items-center gap-2">
                          {l.title}
                          {done && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        </p>
                        {l.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {l.description}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {all.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Learning content coming soon</p>
            <p className="text-sm text-muted-foreground mt-1">
              The MartPoint team is preparing lessons, guides and videos for creators.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 flex-wrap">
        <Button asChild variant="outline" size="sm">
          <Link href="/creator/guides">
            <Map className="mr-2 h-4 w-4" /> Business Type Guides
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/creator/knowledge-base">
            <Lock className="mr-2 h-4 w-4" /> Knowledge Base
          </Link>
        </Button>
      </div>
    </div>
  )
}
