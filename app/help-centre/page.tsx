import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Help Centre - MartPoint",
  description: "Get help with MartPoint products and services.",
}

export default function HelpCentrePage() {
  return (
    <PlaceholderPage
      title="Help Centre"
      headline="Help Centre"
      description="Get help with MartPoint products and services."
      subtext="Our knowledge base and support docs are being prepared. In the meantime, reach out to our team directly."
    />
  )
}
