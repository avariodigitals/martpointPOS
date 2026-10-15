export const revalidate = 86400
import type { Metadata } from "next"
import { sportsShops } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: sportsShops.seo.title,
  description: sportsShops.seo.description,
  alternates: {
    canonical: `/industries/${sportsShops.slug}`,
  },
  openGraph: {
    title: sportsShops.seo.ogTitle || `${sportsShops.seo.title} — MartPoint`,
    description: sportsShops.seo.ogDescription || sportsShops.seo.description,
    url: `https://martpoint.com.ng/industries/${sportsShops.slug}`,
  },
}

export default function SportsShopsIndustryPage() {
  return <IndustryPage industry={sportsShops} />
}
