import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Multi-Branch Retail - MartPoint Retail",
  description: "Centralised management for retail chains and franchise operations.",
}

export default function MultiBranchRetailPage() {
  return (
    <PlaceholderPage
      title="Multi-Branch Retail"
      headline="Multi-Branch Retail"
      description="Centralised management for retail chains and franchise operations."
      subtext="MartPoint Retail lets you compare sales across locations, transfer stock between branches and manage centrally from one dashboard."
    />
  )
}
