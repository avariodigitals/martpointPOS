import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { phoneShops } from "@/lib/industries"

export const metadata: Metadata = {
  title: phoneShops.seo.title,
  description: phoneShops.seo.description,
}

export default function PhoneShopsPage() {
  return <IndustryTemplate data={phoneShops} />
}
