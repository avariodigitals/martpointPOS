import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Fashion Stores - MartPoint Retail",
  description: "Manage sizes, colours, seasons and styles with real-time sales visibility.",
}

export default function FashionStoresPage() {
  return (
    <PlaceholderPage
      title="Fashion Stores"
      headline="Fashion Stores"
      description="Manage sizes, colours, seasons and styles with real-time sales visibility."
      subtext="MartPoint Retail helps fashion retailers track variants, optimise stock mix and understand what sells by branch."
    />
  )
}
