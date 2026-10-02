export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { nylonPolythene } from "@/lib/industries"

export const metadata: Metadata = {
  title: nylonPolythene.seo.title,
  description: nylonPolythene.seo.description,
  alternates: { canonical: `/industries/${nylonPolythene.slug}` },
}

export default function NylonPolythenePage() {
  return <IndustryTemplate data={nylonPolythene} />
}
