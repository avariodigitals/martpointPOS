import { redirect } from "next/navigation"
import { requirePartnerSession, getPartnerById, getPartnerUserById, authorizePartner } from "@/lib/partner-auth"
import { listPartnerProfileUpdateRequests } from "@/lib/partner-service"
import { PartnerProfileForm } from "./profile-form"

export default async function PartnerProfilePage() {
  const session = await requirePartnerSession()

  const auth = await authorizePartner({ session, permission: "partner:profile:view" })
  if (!auth.authorized) {
    redirect("/partner")
  }

  const [partner, pendingRequests] = await Promise.all([
    getPartnerById(session.partnerId),
    listPartnerProfileUpdateRequests(session.partnerId, "PENDING"),
  ])
  const user = await getPartnerUserById(session.partnerUserId)

  if (!partner || !user) {
    redirect("/partner")
  }

  return <PartnerProfileForm partner={partner} userEmail={user.email} pendingRequests={pendingRequests} />
}
