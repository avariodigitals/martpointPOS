export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { shoeStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: shoeStores.seo.title,
  description: shoeStores.seo.description,
}

export default function ShoeStoresPage() {
  return <IndustryTemplate data={shoeStores} />
}
