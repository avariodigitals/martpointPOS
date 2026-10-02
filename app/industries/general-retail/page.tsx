export const revalidate = 86400
import type { Metadata } from "next"
import { generalRetail } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: generalRetail.seo.title,
  description: generalRetail.seo.description,
  alternates: {
    canonical: `/industries/${generalRetail.slug}`,
  },
  openGraph: {
    title: generalRetail.seo.ogTitle || generalRetail.seo.title,
    description: generalRetail.seo.ogDescription || generalRetail.seo.description,
    url: `https://martpoint.com.ng/industries/${generalRetail.slug}`,
  },
}

export default function GeneralRetailIndustryPage() {
  return <IndustryPage industry={generalRetail} />
}
