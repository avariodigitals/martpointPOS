export const revalidate = 86400
import type { Metadata } from "next"
import { makeupStudio } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: makeupStudio.seo.title,
  description: makeupStudio.seo.description,
  alternates: {
    canonical: `/industries/${makeupStudio.slug}`,
  },
  openGraph: {
    title: makeupStudio.seo.ogTitle || makeupStudio.seo.title,
    description: makeupStudio.seo.ogDescription || makeupStudio.seo.description,
    url: `https://martpoint.com.ng/industries/${makeupStudio.slug}`,
  },
}

export default function MakeupStudiosIndustryPage() {
  return <IndustryPage industry={makeupStudio} />
}
