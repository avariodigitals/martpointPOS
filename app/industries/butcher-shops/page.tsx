export const revalidate = 86400
import type { Metadata } from "next"
import { butcherShop } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: butcherShop.seo.title,
  description: butcherShop.seo.description,
  alternates: {
    canonical: `/industries/${butcherShop.slug}`,
  },
  openGraph: {
    title: butcherShop.seo.ogTitle || butcherShop.seo.title,
    description: butcherShop.seo.ogDescription || butcherShop.seo.description,
    url: `https://martpoint.com.ng/industries/${butcherShop.slug}`,
  },
}

export default function ButcherShopsIndustryPage() {
  return <IndustryPage industry={butcherShop} />
}
