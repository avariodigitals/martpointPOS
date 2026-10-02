export const revalidate = 86400
import type { Metadata } from "next"
import { onlineStore } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: onlineStore.seo.title,
  description: onlineStore.seo.description,
  alternates: {
    canonical: `/industries/${onlineStore.slug}`,
  },
  openGraph: {
    title: onlineStore.seo.ogTitle || onlineStore.seo.title,
    description: onlineStore.seo.ogDescription || onlineStore.seo.description,
    url: `https://martpoint.com.ng/industries/${onlineStore.slug}`,
  },
}

export default function OnlineStoresIndustryPage() {
  return <IndustryPage industry={onlineStore} />
}
