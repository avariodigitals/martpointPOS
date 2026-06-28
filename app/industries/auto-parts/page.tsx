import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { autoParts } from "@/lib/industries"

export const metadata: Metadata = {
  title: autoParts.seo.title,
  description: autoParts.seo.description,
}

export default function AutoPartsPage() {
  return <IndustryTemplate data={autoParts} />
}
