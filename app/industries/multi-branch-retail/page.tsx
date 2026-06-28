import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { multiBranchRetail } from "@/lib/industries"

export const metadata: Metadata = {
  title: multiBranchRetail.seo.title,
  description: multiBranchRetail.seo.description,
}

export default function MultiBranchRetailPage() {
  return <IndustryTemplate data={multiBranchRetail} />
}
