export const revalidate = 86400
import type { Metadata } from "next"
import { furnitureStores } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: furnitureStores.seo.title,
  description: furnitureStores.seo.description,
  alternates: {
    canonical: `/industries/${furnitureStores.slug}`,
  },
  openGraph: {
    title: furnitureStores.seo.ogTitle || furnitureStores.seo.title,
    description: furnitureStores.seo.ogDescription || furnitureStores.seo.description,
    url: `https://martpoint.com.ng/industries/${furnitureStores.slug}`,
  },
}

export default function FurnitureStoresIndustryPage() {
  return <IndustryPage industry={furnitureStores} />
}
