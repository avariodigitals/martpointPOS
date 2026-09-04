import { redirect } from "next/navigation"
import { requirePartnerSession, authorizePartner, getPartnerUserById, type PartnerUserRole } from "@/lib/partner-auth"
import { listPartnerUsers, listPartnerInvitations } from "@/lib/partner-service"
import { PartnerTeamClient } from "./team-client"

export default async function PartnerTeamPage() {
  const session = await requirePartnerSession()

  const auth = await authorizePartner({ session, permission: "partner:users:view" })
  if (!auth.authorized) {
    redirect("/partner")
  }

  const [currentUser, users, invitations] = await Promise.all([
    getPartnerUserById(session.partnerUserId),
    listPartnerUsers(session.partnerId),
    listPartnerInvitations(session.partnerId),
  ])

  if (!currentUser) redirect("/partner")

  const typedUsers = users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    status: u.status,
    invitedAt: u.invitedAt,
    lastLoginAt: u.lastLoginAt,
  }))

  const typedInvitations = invitations.map((i) => ({
    id: i.id as string,
    email: i.email as string,
    role: i.role as PartnerUserRole,
    fullName: i.fullName as string | null,
    full_name: i.full_name as string | null,
    accepted_at: i.accepted_at as string | null,
    revoked_at: i.revoked_at as string | null,
    expires_at: i.expires_at as string,
  }))

  return (
    <PartnerTeamClient
      currentRole={currentUser.role}
      users={typedUsers}
      invitations={typedInvitations}
    />
  )
}
