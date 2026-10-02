export const revalidate = 86400
import type { Metadata } from "next"
import { beautySpa } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: beautySpa.seo.title,
  description: beautySpa.seo.description,
  alternates: {
    canonical: `/industries/${beautySpa.slug}`,
  },
  openGraph: {
    title: beautySpa.seo.ogTitle || beautySpa.seo.title,
    description: beautySpa.seo.ogDescription || beautySpa.seo.description,
    url: `https://martpoint.com.ng/industries/${beautySpa.slug}`,
  },
}

export default function BeautySpasIndustryPage() {
  return <IndustryPage industry={beautySpa} />
}
