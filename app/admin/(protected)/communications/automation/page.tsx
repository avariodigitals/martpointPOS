import { requireAdminPage } from "@/lib/admin-auth"
import CommunicationsWorkspace from "@/components/admin/communications-workspace"

export default async function AutomationPage() {
  await requireAdminPage("marketing")
  await requireAdminPage("leads")
  return <CommunicationsWorkspace view="automation" />
}
