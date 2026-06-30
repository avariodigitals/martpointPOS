export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { agroDealers } from "@/lib/industries"

export const metadata: Metadata = {
  title: agroDealers.seo.title,
  description: agroDealers.seo.description,
}

export default function AgroDealersPage() {
  return <IndustryTemplate data={agroDealers} />
}
