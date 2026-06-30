export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { convenienceStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: convenienceStores.seo.title,
  description: convenienceStores.seo.description,
}

export default function ConvenienceStoresPage() {
  return <IndustryTemplate data={convenienceStores} />
}
