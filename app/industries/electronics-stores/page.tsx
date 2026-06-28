import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { electronicsStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: electronicsStores.seo.title,
  description: electronicsStores.seo.description,
}

export default function ElectronicsStoresPage() {
  return <IndustryTemplate data={electronicsStores} />
}
