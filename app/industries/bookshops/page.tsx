export const revalidate = 86400
import type { Metadata } from "next"
import { bookshop } from "@/lib/industries"
import { IndustryPage } from "@/components/industries/industry-page"

export const metadata: Metadata = {
  title: bookshop.seo.title,
  description: bookshop.seo.description,
  alternates: {
    canonical: `/industries/${bookshop.slug}`,
  },
  openGraph: {
    title: bookshop.seo.ogTitle || bookshop.seo.title,
    description: bookshop.seo.ogDescription || bookshop.seo.description,
    url: `https://martpoint.com.ng/industries/${bookshop.slug}`,
  },
}

export default function BookshopsIndustryPage() {
  return <IndustryPage industry={bookshop} />
}
