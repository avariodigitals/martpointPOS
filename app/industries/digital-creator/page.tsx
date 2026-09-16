export const revalidate = 86400
import type { Metadata } from "next"
import { digitalCreator } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: digitalCreator.seo.title,
  description: digitalCreator.seo.description,
  alternates: {
    canonical: `/industries/${digitalCreator.slug}`,
  },
  openGraph: {
    title: digitalCreator.seo.ogTitle || digitalCreator.seo.title,
    description: digitalCreator.seo.ogDescription || digitalCreator.seo.description,
    url: `https://martpoint.com.ng/industries/${digitalCreator.slug}`,
  },
}

export default function DigitalCreatorIndustryPage() {
  return <IndustryPage industry={digitalCreator} />
}
