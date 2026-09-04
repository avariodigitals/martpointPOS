import { PartnerDetail } from "./partner-detail"

export default async function AdminPartnerDetailPage({
  params,
}: {
  params: Promise<{ partnerId: string }>
}) {
  const { partnerId } = await params
  return <PartnerDetail partnerId={partnerId} />
}
