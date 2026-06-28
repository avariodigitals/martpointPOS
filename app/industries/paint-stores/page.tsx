import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { paintStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: paintStores.seo.title,
  description: paintStores.seo.description,
}

export default function PaintStoresPage() {
  return <IndustryTemplate data={paintStores} />
}
