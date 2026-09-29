export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { plumbingStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: plumbingStores.seo.title,
  description: plumbingStores.seo.description,
  alternates: { canonical: "/industries/plumbing-stores" },
}

export default function PlumbingStoresPage() {
  return <IndustryTemplate data={plumbingStores} />
}
