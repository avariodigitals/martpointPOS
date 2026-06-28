import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Download Brochure - MartPoint",
  description: "Download the MartPoint product brochure.",
}

export default function DownloadBrochurePage() {
  return (
    <PlaceholderPage
      title="Download Brochure"
      headline="Download Brochure"
      description="Download the MartPoint product brochure."
      subtext="Our brochure is being updated with the latest features. Contact our sales team for a personalised walkthrough."
    />
  )
}
