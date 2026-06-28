import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { medicalStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: medicalStores.seo.title,
  description: medicalStores.seo.description,
}

export default function MedicalStoresPage() {
  return <IndustryTemplate data={medicalStores} />
}
