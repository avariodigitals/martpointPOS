export const revalidate = 86400
import type { Metadata } from "next"
import { frozenFoods } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: frozenFoods.seo.title,
  description: frozenFoods.seo.description,
  alternates: {
    canonical: `/industries/${frozenFoods.slug}`,
  },
  openGraph: {
    title: frozenFoods.seo.ogTitle || frozenFoods.seo.title,
    description: frozenFoods.seo.ogDescription || frozenFoods.seo.description,
    url: `https://martpoint.com.ng/industries/${frozenFoods.slug}`,
  },
}

export default function FrozenFoodsIndustryPage() {
  return <IndustryPage industry={frozenFoods} />
}
