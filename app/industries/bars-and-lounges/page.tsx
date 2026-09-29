export const revalidate = 86400
import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { barsAndLounges } from "@/lib/industries"

export const metadata: Metadata = {
  title: barsAndLounges.seo.title,
  description: barsAndLounges.seo.description,
  alternates: { canonical: "/industries/bars-and-lounges" },
}

export default function BarsAndLoungesPage() {
  return <IndustryTemplate data={barsAndLounges} />
}
