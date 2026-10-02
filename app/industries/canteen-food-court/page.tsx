export const revalidate = 86400
import type { Metadata } from "next"
import { canteenFoodCourt } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: canteenFoodCourt.seo.title,
  description: canteenFoodCourt.seo.description,
  alternates: {
    canonical: `/industries/${canteenFoodCourt.slug}`,
  },
  openGraph: {
    title: canteenFoodCourt.seo.ogTitle || canteenFoodCourt.seo.title,
    description: canteenFoodCourt.seo.ogDescription || canteenFoodCourt.seo.description,
    url: `https://martpoint.com.ng/industries/${canteenFoodCourt.slug}`,
  },
}

export default function CanteenFoodCourtIndustryPage() {
  return <IndustryPage industry={canteenFoodCourt} />
}
