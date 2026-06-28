import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { printing } from "@/lib/industries"

export const metadata: Metadata = {
  title: printing.seo.title,
  description: printing.seo.description,
}

export default function PrintingPage() {
  return <IndustryTemplate data={printing} />
}
