export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { gadgetStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: gadgetStores.seo.title,
  description: gadgetStores.seo.description,
}

export default function GadgetStoresPage() {
  return <IndustryTemplate data={gadgetStores} />
}
