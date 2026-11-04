import { requireAdminPage } from "@/lib/admin-auth"
import MarketingAudiencesPage from "@/app/admin/(protected)/marketing/audiences/page"
export default async function EmailAudiencesPage() {
  await requireAdminPage("marketing")
  return <MarketingAudiencesPage />
}
