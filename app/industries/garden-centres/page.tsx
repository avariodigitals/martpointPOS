export const revalidate = 86400
import type { Metadata } from "next"
import { gardenCentres } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: gardenCentres.seo.title,
  description: gardenCentres.seo.description,
  keywords: [
    "garden centre management software", "garden centre POS software Nigeria",
    "plant shop POS", "nursery inventory management software",
    "landscaping business management software", "landscaping quotation software",
    "plant nursery online store", "garden maintenance billing software",
    "horticulture software Nigeria", "MartPoint Retail",
  ],
  alternates: {
    canonical: `/industries/${gardenCentres.slug}`,
  },
  openGraph: {
    title: gardenCentres.seo.ogTitle || `${gardenCentres.seo.title} — MartPoint`,
    description: gardenCentres.seo.ogDescription || gardenCentres.seo.description,
    url: `https://martpoint.com.ng/industries/${gardenCentres.slug}`,
  },
}

export default function GardenCentresIndustryPage() {
  return <IndustryPage industry={gardenCentres} />
}
