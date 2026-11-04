import { requireAdminPage } from "@/lib/admin-auth"
import EmailCampaignComposer from "@/components/admin/email-campaign-composer"
export default async function NewEmailCampaignPage({ searchParams }: { searchParams: Promise<{ duplicate?: string; edit?: string }> }) {
  await requireAdminPage("marketing")
  const { duplicate, edit } = await searchParams
  return <EmailCampaignComposer duplicateId={duplicate} editId={edit} />
}
