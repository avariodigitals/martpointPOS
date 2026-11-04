import { requireAdminPage } from "@/lib/admin-auth"
import MarketingSuppressionsPage from "@/app/admin/(protected)/marketing/suppressions/page"

export default async function EmailSuppressionsPage() {
  await requireAdminPage("marketing")
  return <MarketingSuppressionsPage />
}
