import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { plumbingStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: plumbingStores.seo.title,
  description: plumbingStores.seo.description,
}

export default function PlumbingStoresPage() {
  return <IndustryTemplate data={plumbingStores} />
}
