import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { clinics } from "@/lib/industries"

export const metadata: Metadata = {
  title: clinics.seo.title,
  description: clinics.seo.description,
}

export default function ClinicsPage() {
  return <IndustryTemplate data={clinics} />
}
