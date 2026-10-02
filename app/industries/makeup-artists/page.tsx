export const revalidate = 86400
import type { Metadata } from "next"
import { makeupArtist } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: makeupArtist.seo.title,
  description: makeupArtist.seo.description,
  alternates: {
    canonical: `/industries/${makeupArtist.slug}`,
  },
  openGraph: {
    title: makeupArtist.seo.ogTitle || makeupArtist.seo.title,
    description: makeupArtist.seo.ogDescription || makeupArtist.seo.description,
    url: `https://martpoint.com.ng/industries/${makeupArtist.slug}`,
  },
}

export default function MakeupArtistsIndustryPage() {
  return <IndustryPage industry={makeupArtist} />
}
