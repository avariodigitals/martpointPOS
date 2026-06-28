import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Customer Stories - MartPoint",
  description: "See how businesses across Africa use MartPoint to grow.",
}

export default function CustomerStoriesPage() {
  return (
    <PlaceholderPage
      title="Customer Stories"
      headline="Customer Stories"
      description="See how businesses across Africa use MartPoint to grow."
      subtext="We're collecting success stories from our amazing customers. Check back soon."
    />
  )
}
