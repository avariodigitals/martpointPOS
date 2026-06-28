import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { distributors } from "@/lib/industries"

export const metadata: Metadata = {
  title: distributors.seo.title,
  description: distributors.seo.description,
}

export default function DistributorsPage() {
  return <IndustryTemplate data={distributors} />
}
