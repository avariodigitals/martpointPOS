export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { perfumeShops } from "@/lib/industries"

export const metadata: Metadata = {
  title: perfumeShops.seo.title,
  description: perfumeShops.seo.description,
}

export default function PerfumeShopsPage() {
  return <IndustryTemplate data={perfumeShops} />
}
