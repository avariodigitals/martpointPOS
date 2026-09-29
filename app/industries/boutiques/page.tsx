export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { boutiques } from "@/lib/industries"

export const metadata: Metadata = {
  title: boutiques.seo.title,
  description: boutiques.seo.description,
  alternates: { canonical: "/industries/boutiques" },
}

export default function BoutiquesPage() {
  return <IndustryTemplate data={boutiques} />
}
