import { requireAdminPage } from "@/lib/admin-auth"
import EmailCampaignComposer from "@/components/admin/email-campaign-composer"
export default async function NewEmailCampaignPage({ searchParams }: { searchParams: Promise<{ duplicate?: string }> }) {
  await requireAdminPage("marketing")
  const { duplicate } = await searchParams
  return <EmailCampaignComposer duplicateId={duplicate} />
}
