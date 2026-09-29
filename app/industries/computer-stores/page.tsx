export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { computerStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: computerStores.seo.title,
  description: computerStores.seo.description,
  alternates: { canonical: "/industries/computer-stores" },
}

export default function ComputerStoresPage() {
  return <IndustryTemplate data={computerStores} />
}
