import { redirect } from "next/navigation"
import { requirePartnerSession, getPartnerById, authorizePartner } from "@/lib/partner-auth"
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

  if (!partner) {
    redirect("/partner")
  }

  return <PartnerProfileForm partner={partner} pendingRequests={pendingRequests} />
}
