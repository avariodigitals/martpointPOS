import type { Metadata } from "next"
import { PlaceholderPage } from "@/components/shared/placeholder-page"

export const metadata: Metadata = {
  title: "Careers - MartPoint",
  description: "Join the MartPoint team and help build the future of African business software.",
}

export default function CareersPage() {
  return (
    <PlaceholderPage
      title="Careers"
      headline="Careers at MartPoint"
      description="Join the MartPoint team and help build the future of African business software."
      subtext="We're always looking for passionate people. Check back soon for open roles or send us your details."
    />
  )
}
