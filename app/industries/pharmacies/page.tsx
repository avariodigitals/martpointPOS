import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Pharmacies - MartPoint Retail",
  description: "Track medicine inventory, monitor expiry dates and manage prescriptions.",
}

export default function PharmaciesPage() {
  return (
    <PlaceholderPage
      title="Pharmacies"
      headline="Pharmacies"
      description="Track medicine inventory, monitor expiry dates and manage prescriptions."
      subtext="MartPoint Retail helps pharmacies stay compliant with batch tracking, expiry alerts and accurate stock counts."
    />
  )
}
