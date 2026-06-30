export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { diagnosticCentres } from "@/lib/industries"

export const metadata: Metadata = {
  title: diagnosticCentres.seo.title,
  description: diagnosticCentres.seo.description,
}

export default function DiagnosticCentresPage() {
  return <IndustryTemplate data={diagnosticCentres} />
}
