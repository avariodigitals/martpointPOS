export const revalidate = 86400
import type { Metadata } from "next"
import { physiotherapy } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: physiotherapy.seo.title,
  description: physiotherapy.seo.description,
  alternates: {
    canonical: `/industries/${physiotherapy.slug}`,
  },
  openGraph: {
    title: physiotherapy.seo.ogTitle || physiotherapy.seo.title,
    description: physiotherapy.seo.ogDescription || physiotherapy.seo.description,
    url: `https://martpoint.com.ng/industries/${physiotherapy.slug}`,
  },
}

export default function PhysiotherapyIndustryPage() {
  return <IndustryPage industry={physiotherapy} />
}
