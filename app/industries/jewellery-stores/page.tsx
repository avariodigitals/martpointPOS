export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { jewelleryStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: jewelleryStores.seo.title,
  description: jewelleryStores.seo.description,
}

export default function JewelleryStoresPage() {
  return <IndustryTemplate data={jewelleryStores} />
}
