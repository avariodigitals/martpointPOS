import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { cosmeticsStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: cosmeticsStores.seo.title,
  description: cosmeticsStores.seo.description,
}

export default function CosmeticsStoresPage() {
  return <IndustryTemplate data={cosmeticsStores} />
}
