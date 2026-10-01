import Link from "next/link"
import { notFound } from "next/navigation"
import { requireCreatorSession } from "@/lib/creator-auth"
import { getGuideBySlug } from "@/lib/creator-resources"
import { allIndustries, type IndustryData } from "@/lib/industries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft, AlertTriangle, Lightbulb, Quote, MessageSquareWarning,
  Clapperboard, Target, BookOpen, Link2, Ban,
} from "lucide-react"

export const dynamic = "force-dynamic"

const industries = new Map<string, IndustryData>(allIndustries.map((i) => [i.slug, i]))

function ListSection({
  icon: Icon, title, items, tone,
}: {
  icon: React.ElementType
  title: string
  items: string[]
  tone?: "danger" | "default"
}) {
  if (items.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className={`text-sm font-semibold flex items-center gap-2 ${tone === "danger" ? "text-red-600" : ""}`}>
          <Icon className="h-4 w-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="text-sm text-muted-foreground flex gap-2">
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${tone === "danger" ? "bg-red-400" : "bg-retail"}`} />
              {it}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export default async function CreatorGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await requireCreatorSession()

  const industry = industries.get(slug)
  const guide = await getGuideBySlug(slug, { publishedOnly: true })
  if (!industry && !guide) notFound()

  // CMS fields win; fall back to the authored industry page data for context.
  const problems =
    guide && guide.commonProblems.length > 0
      ? guide.commonProblems
      : industry?.painPoints.map((p) => `${p.title} — ${p.desc}`) ?? []
  const howHelps = guide?.howHelps ?? industry?.hero.paragraph ?? null
  const features =
    guide && guide.features.length > 0
      ? guide.features
      : industry?.solutions.map((s) => `${s.title} — ${s.desc}`) ?? []

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/creator/guides"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All guides
      </Link>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {industry?.category ?? "Business Type"} Guide
        </p>
        <h2 className="text-2xl font-bold tracking-tight mt-1">
          {guide?.title || industry?.name || slug}
        </h2>
        {(guide?.overview ?? industry?.description) && (
          <p className="text-muted-foreground mt-2">{guide?.overview ?? industry?.description}</p>
        )}
        {!guide && (
          <p className="mt-3 text-xs rounded-full bg-muted px-3 py-1 inline-block text-muted-foreground">
            Full creator guide in preparation — shown: public product information.
          </p>
        )}
      </div>

      <ListSection icon={AlertTriangle} title="Common problems this business faces" items={problems} />

      {howHelps && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-retail" /> How MartPoint helps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{howHelps}</p>
          </CardContent>
        </Card>
      )}

      <ListSection icon={Target} title="MartPoint features that matter here" items={features} />
      <ListSection icon={Clapperboard} title="Content angles" items={guide?.contentAngles ?? []} />
      <ListSection icon={Quote} title="Hooks — example opening lines" items={guide?.hooks ?? []} />
      <ListSection icon={BookOpen} title="Use cases" items={guide?.useCases ?? []} />
      <ListSection
        icon={Ban}
        title="Claims to avoid — do NOT say these"
        items={guide?.claimsToAvoid ?? []}
        tone="danger"
      />

      {guide?.recommendedCta && (
        <Card className="border-retail/30 bg-retail-soft/30">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4 text-retail" /> Recommended CTA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{guide.recommendedCta}</p>
          </CardContent>
        </Card>
      )}

      {guide && guide.relatedLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Related learning &amp; resources</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {guide.relatedLinks.map((l) => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-retail hover:underline"
                  >
                    <Link2 className="h-3.5 w-3.5" /> {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
