import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Product Updates - MartPoint",
  description: "Latest updates and new features from MartPoint.",
}

export default function ProductUpdatesPage() {
  return (
    <PlaceholderPage
      title="Product Updates"
      headline="Product Updates"
      description="Latest updates and new features from MartPoint."
      subtext="Stay tuned for announcements on new features, improvements and what's coming next."
    />
  )
}
