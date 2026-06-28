import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "MartPoint Intelligence - AI-Powered Business Insights",
  description: "AI-powered insights, recommendations and business alerts from MartPoint.",
}

export default function MartPointIntelligencePage() {
  return (
    <PlaceholderPage
      title="MartPoint Intelligence"
      headline="MartPoint Intelligence"
      description="AI-powered insights, recommendations and business alerts. Coming soon."
      subtext="We're building smart analytics and AI recommendations to help African businesses make faster, better decisions."
    />
  )
}
