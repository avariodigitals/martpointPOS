import { redirect } from "next/navigation"
import { requirePartnerSession, authorizePartner } from "@/lib/partner-auth"
import { PartnerPortalGuide } from "@/components/partner/partner-guides"

export default async function PartnerPortalGuidePage() {
  const session = await requirePartnerSession()
  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) redirect("/partner")
  return <PartnerPortalGuide />
}
