import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Beauty & Salons - MartPoint Retail",
  description: "Appointment scheduling, product sales and inventory management for beauty businesses.",
}

export default function BeautyAndSalonsPage() {
  return (
    <PlaceholderPage
      title="Beauty & Salons"
      headline="Beauty & Salons"
      description="Appointment scheduling, product sales and inventory management for beauty businesses."
      subtext="MartPoint Retail helps salons and beauty stores manage appointments, retail product sales and stock in one place."
    />
  )
}
