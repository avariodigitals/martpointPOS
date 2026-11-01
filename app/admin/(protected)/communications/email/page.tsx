import { requireAdminPage } from "@/lib/admin-auth"
import AdminMarketingPage from "@/app/admin/(protected)/marketing/page"

export default async function EmailCampaignsPage() {
  await requireAdminPage("marketing")
  return <AdminMarketingPage />
}
