import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Why MartPoint - Built for African Businesses",
  description: "Discover why businesses choose MartPoint for retail and enterprise management.",
}

export default function WhyMartPointPage() {
  return (
    <PlaceholderPage
      title="Why MartPoint"
      headline="Why MartPoint"
      description="Discover why businesses choose MartPoint for retail and enterprise management."
      subtext="From offline-first design to multi-currency support, MartPoint is built for how African businesses actually operate."
    />
  )
}
