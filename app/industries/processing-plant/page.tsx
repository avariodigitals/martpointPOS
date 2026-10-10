import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { processingPlant } from "@/lib/industries"

export const revalidate = 86400

export const metadata: Metadata = {
  title: processingPlant.seo.title,
  description: processingPlant.seo.description,
  alternates: { canonical: `/industries/${processingPlant.slug}` },
  openGraph: {
    title: processingPlant.seo.title,
    description: processingPlant.seo.description,
    url: `https://martpoint.com.ng/industries/${processingPlant.slug}`,
  },
}

export default function ProcessingPlantPage() {
  return <IndustryTemplate data={processingPlant} />
}
