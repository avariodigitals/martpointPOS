export const revalidate = 86400
import type { Metadata } from "next"
import { automobile } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: automobile.seo.title,
  description: automobile.seo.description,
  alternates: {
    canonical: `/industries/${automobile.slug}`,
  },
  openGraph: {
    title: automobile.seo.ogTitle || automobile.seo.title,
    description: automobile.seo.ogDescription || automobile.seo.description,
    url: `https://martpoint.com.ng/industries/${automobile.slug}`,
  },
}

export default function AutomobileIndustryPage() {
  return <IndustryPage industry={automobile} />
}
