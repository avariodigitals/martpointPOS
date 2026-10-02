export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { scientificLabSupplies } from "@/lib/industries"

export const metadata: Metadata = {
  title: scientificLabSupplies.seo.title,
  description: scientificLabSupplies.seo.description,
  alternates: { canonical: `/industries/${scientificLabSupplies.slug}` },
}

export default function ScientificLabSuppliesPage() {
  return <IndustryTemplate data={scientificLabSupplies} />
}
