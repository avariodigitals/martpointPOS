export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { hospitals } from "@/lib/industries"

export const metadata: Metadata = {
  title: hospitals.seo.title,
  description: hospitals.seo.description,
}

export default function HospitalsPage() {
  return <IndustryTemplate data={hospitals} />
}
