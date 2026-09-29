export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { tyreShops } from "@/lib/industries"

export const metadata: Metadata = {
  title: tyreShops.seo.title,
  description: tyreShops.seo.description,
  alternates: { canonical: "/industries/tyre-shops" },
}

export default function TyreShopsPage() {
  return <IndustryTemplate data={tyreShops} />
}
