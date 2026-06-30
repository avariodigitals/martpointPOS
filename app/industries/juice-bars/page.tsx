export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { juiceBars } from "@/lib/industries"

export const metadata: Metadata = {
  title: juiceBars.seo.title,
  description: juiceBars.seo.description,
}

export default function JuiceBarsPage() {
  return <IndustryTemplate data={juiceBars} />
}
