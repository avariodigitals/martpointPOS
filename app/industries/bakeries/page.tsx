export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { bakeries } from "@/lib/industries"

export const metadata: Metadata = {
  title: bakeries.seo.title,
  description: bakeries.seo.description,
}

export default function BakeriesPage() {
  return <IndustryTemplate data={bakeries} />
}
