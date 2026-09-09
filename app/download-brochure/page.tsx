import type { Metadata } from "next"
import { getActiveBrochure } from "@/lib/brochure"
import { BrochureDownloadForm } from "@/components/shared/brochure-download-form"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Download Brochure - MartPoint",
  description: "Download the MartPoint product brochure.",
  alternates: {
    canonical: "/download-brochure",
  },
}

export default async function DownloadBrochurePage() {
  const brochure = await getActiveBrochure()

  return (
    <main className="min-h-screen py-16 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <BrochureDownloadForm brochure={brochure} />
      </div>
    </main>
  )
}
