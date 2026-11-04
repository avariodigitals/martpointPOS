import { requireAdminPage } from "@/lib/admin-auth"
import EmailCampaignReport from "@/components/admin/email-campaign-report"
export default async function EmailCampaignReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("marketing")
  const { id } = await params
  return <EmailCampaignReport id={id} />
}
