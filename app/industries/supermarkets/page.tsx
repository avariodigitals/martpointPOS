import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Supermarkets - MartPoint Retail",
  description: "POS, inventory and multi-branch management for supermarkets and grocery stores.",
}

export default function SupermarketsPage() {
  return (
    <PlaceholderPage
      title="Supermarkets"
      headline="Supermarkets"
      description="POS, inventory and multi-branch management for supermarkets and grocery stores."
      subtext="MartPoint Retail gives supermarkets fast checkout, real-time stock tracking, expiry alerts and multi-branch visibility."
    />
  )
}
