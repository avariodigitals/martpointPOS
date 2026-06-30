export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { tailoring } from "@/lib/industries"

export const metadata: Metadata = {
  title: tailoring.seo.title,
  description: tailoring.seo.description,
}

export default function TailoringPage() {
  return <IndustryTemplate data={tailoring} />
}
