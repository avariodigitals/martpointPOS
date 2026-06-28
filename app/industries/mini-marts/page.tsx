import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { miniMarts } from "@/lib/industries"

export const metadata: Metadata = {
  title: miniMarts.seo.title,
  description: miniMarts.seo.description,
}

export default function MiniMartsPage() {
  return <IndustryTemplate data={miniMarts} />
}
