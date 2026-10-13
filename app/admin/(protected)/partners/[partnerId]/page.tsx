import { redirect } from "next/navigation"
import { getSession } from "@/lib/admin-auth"
import { PartnerDetail } from "./partner-detail"

export default async function AdminPartnerDetailPage({
  params,
}: {
  params: Promise<{ partnerId: string }>
}) {
  const { partnerId } = await params
  const session = await getSession()
  if (!session) redirect("/admin/login?expired=1")
  return <PartnerDetail partnerId={partnerId} role={session.role} />
}
