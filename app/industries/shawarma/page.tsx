export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { shawarma } from "@/lib/industries"

export const metadata: Metadata = {
  title: shawarma.seo.title,
  description: shawarma.seo.description,
}

export default function ShawarmaPage() {
  return <IndustryTemplate data={shawarma} />
}
