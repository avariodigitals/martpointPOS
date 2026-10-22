import { redirect } from "next/navigation"
import { requirePartnerSession, authorizePartner } from "@/lib/partner-auth"
import { PartnerGuideIndex } from "@/components/partner/partner-guide-library"

export default async function PartnerGuideLibraryPage() {
  const session = await requirePartnerSession()
  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) redirect("/partner")
  return <PartnerGuideIndex />
}
