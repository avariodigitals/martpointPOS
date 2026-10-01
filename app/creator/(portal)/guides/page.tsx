import Link from "next/link"
import { requireCreatorSession } from "@/lib/creator-auth"
import { listGuides } from "@/lib/creator-resources"
import { allIndustries } from "@/lib/industries"
import { Card, CardContent } from "@/components/ui/card"
import { Map as MapIcon, ArrowRight } from "lucide-react"

export const dynamic = "force-dynamic"

const industryName = new Map(allIndustries.map((i) => [i.slug, i.name]))
const industryCategory = new Map(allIndustries.map((i) => [i.slug, i.category]))

export default async function CreatorGuidesPage() {
  await requireCreatorSession()
  const guides = await listGuides({ publishedOnly: true })

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Business Type Guides</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Creator-friendly guides for the businesses MartPoint serves — what they
          struggle with, how MartPoint helps, and safe content angles.
        </p>
      </div>

      {guides.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MapIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Guides coming soon</p>
            <p className="text-sm text-muted-foreground mt-1">
              The team is preparing creator guides for each business type.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {guides.map((g) => (
            <Link key={g.id} href={`/creator/guides/${g.industrySlug}`}>
              <Card className="h-full hover:border-retail/50 transition-colors">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">
                    {industryCategory.get(g.industrySlug) ?? "Business"}
                  </p>
                  <h3 className="font-semibold mt-1 flex items-center justify-between gap-2">
                    {g.title || industryName.get(g.industrySlug) || g.industrySlug}
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </h3>
                  {g.overview && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{g.overview}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
