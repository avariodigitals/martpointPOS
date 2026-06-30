export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { manufacturers } from "@/lib/industries"

export const metadata: Metadata = {
  title: manufacturers.seo.title,
  description: manufacturers.seo.description,
}

export default function ManufacturersPage() {
  return <IndustryTemplate data={manufacturers} />
}
