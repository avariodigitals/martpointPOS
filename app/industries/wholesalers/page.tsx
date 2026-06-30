export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { wholesalers } from "@/lib/industries"

export const metadata: Metadata = {
  title: wholesalers.seo.title,
  description: wholesalers.seo.description,
}

export default function WholesalersPage() {
  return <IndustryTemplate data={wholesalers} />
}
