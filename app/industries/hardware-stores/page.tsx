import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { hardwareStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: hardwareStores.seo.title,
  description: hardwareStores.seo.description,
}

export default function HardwareStoresPage() {
  return <IndustryTemplate data={hardwareStores} />
}
