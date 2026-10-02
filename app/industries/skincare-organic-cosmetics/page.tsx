export const revalidate = 86400
import type { Metadata } from "next"
import { skincareOrganic } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: skincareOrganic.seo.title,
  description: skincareOrganic.seo.description,
  alternates: {
    canonical: `/industries/${skincareOrganic.slug}`,
  },
  openGraph: {
    title: skincareOrganic.seo.ogTitle || skincareOrganic.seo.title,
    description: skincareOrganic.seo.ogDescription || skincareOrganic.seo.description,
    url: `https://martpoint.com.ng/industries/${skincareOrganic.slug}`,
  },
}

export default function SkincareOrganicIndustryPage() {
  return <IndustryPage industry={skincareOrganic} />
}
