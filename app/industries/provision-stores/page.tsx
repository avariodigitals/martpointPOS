import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { provisionStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: provisionStores.seo.title,
  description: provisionStores.seo.description,
}

export default function ProvisionStoresPage() {
  return <IndustryTemplate data={provisionStores} />
}
