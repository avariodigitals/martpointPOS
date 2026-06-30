export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { cafes } from "@/lib/industries"

export const metadata: Metadata = {
  title: cafes.seo.title,
  description: cafes.seo.description,
}

export default function CafesPage() {
  return <IndustryTemplate data={cafes} />
}
