export const revalidate = 86400
import type { Metadata } from "next"
import { bukkaMamaPut } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: bukkaMamaPut.seo.title,
  description: bukkaMamaPut.seo.description,
  alternates: {
    canonical: `/industries/${bukkaMamaPut.slug}`,
  },
  openGraph: {
    title: bukkaMamaPut.seo.ogTitle || bukkaMamaPut.seo.title,
    description: bukkaMamaPut.seo.ogDescription || bukkaMamaPut.seo.description,
    url: `https://martpoint.com.ng/industries/${bukkaMamaPut.slug}`,
  },
}

export default function BukkaMamaPutIndustryPage() {
  return <IndustryPage industry={bukkaMamaPut} />
}
