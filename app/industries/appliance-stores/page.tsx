export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { applianceStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: applianceStores.seo.title,
  description: applianceStores.seo.description,
  alternates: { canonical: "/industries/appliance-stores" },
}

export default function ApplianceStoresPage() {
  return <IndustryTemplate data={applianceStores} />
}
