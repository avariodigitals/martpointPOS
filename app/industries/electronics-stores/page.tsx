import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Electronics Stores - MartPoint Retail",
  description: "Track serial numbers, warranties and high-value stock across showroom and warehouse.",
}

export default function ElectronicsStoresPage() {
  return (
    <PlaceholderPage
      title="Electronics Stores"
      headline="Electronics Stores"
      description="Track serial numbers, warranties and high-value stock across showroom and warehouse."
      subtext="MartPoint Retail gives electronics retailers full visibility into every unit, from purchase to sale with warranty records."
    />
  )
}
