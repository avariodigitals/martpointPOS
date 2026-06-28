import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Partners - MartPoint",
  description: "Partner with MartPoint to bring modern business tools to more African companies.",
}

export default function PartnersPage() {
  return (
    <PlaceholderPage
      title="Partners"
      headline="Partners"
      description="Partner with MartPoint to bring modern business tools to more African companies."
      subtext="We're building a network of resellers, consultants and technology partners. Get in touch to explore collaboration."
    />
  )
}
