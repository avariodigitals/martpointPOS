export const revalidate = 86400
import type { Metadata } from "next"
import { serviceBusiness } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: serviceBusiness.seo.title,
  description: serviceBusiness.seo.description,
  alternates: {
    canonical: `/industries/${serviceBusiness.slug}`,
  },
  openGraph: {
    title: serviceBusiness.seo.ogTitle || serviceBusiness.seo.title,
    description: serviceBusiness.seo.ogDescription || serviceBusiness.seo.description,
    url: `https://martpoint.com.ng/industries/${serviceBusiness.slug}`,
  },
}

export default function ServiceBusinessIndustryPage() {
  return <IndustryPage industry={serviceBusiness} />
}
