export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { barbershops } from "@/lib/industries"

export const metadata: Metadata = {
  title: barbershops.seo.title,
  description: barbershops.seo.description,
}

export default function BarbershopsPage() {
  return <IndustryTemplate data={barbershops} />
}
