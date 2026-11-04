import { requireAdminPage } from "@/lib/admin-auth"
import EmailCampaignList from "@/components/admin/email-campaign-list"
export default async function EmailCampaignsPage() {
  await requireAdminPage("marketing")
  return <EmailCampaignList />
}
