export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { feedStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: feedStores.seo.title,
  description: feedStores.seo.description,
  alternates: { canonical: "/industries/feed-stores" },
}

export default function FeedStoresPage() {
  return <IndustryTemplate data={feedStores} />
}
