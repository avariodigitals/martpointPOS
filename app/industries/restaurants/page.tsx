import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Restaurants - MartPoint Retail",
  description: "Order management, kitchen tickets, table tracking and ingredient inventory.",
}

export default function RestaurantsPage() {
  return (
    <PlaceholderPage
      title="Restaurants"
      headline="Restaurants"
      description="Order management, kitchen tickets, table tracking and ingredient inventory."
      subtext="MartPoint Retail streamlines restaurant operations from order-taking to kitchen to daily sales reports."
    />
  )
}
