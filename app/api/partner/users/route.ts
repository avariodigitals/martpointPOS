import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner, partnerHasCapability, type PartnerUserRole, type PartnerOrgCapability } from "@/lib/partner-auth"
import { createPartnerInvitation, listPartnerUsers } from "@/lib/partner-service"

const ROLE_REQUIRED_CAPABILITY: Partial<Record<PartnerUserRole, string>> = {
  PARTNER_SALES: "SALES",
  PARTNER_IMPLEMENTATION: "IMPLEMENTATION",
  PARTNER_SUPPORT: "FIRST_LINE_SUPPORT",
}

export async function GET() {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:users:view" })
  if (!auth.authorized) return auth.response!

  const users = await listPartnerUsers(session.partnerId)
  return NextResponse.json({ users })
}

export async function POST(request: Request) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:users:invite" })
  if (!auth.authorized) return auth.response!

  try {
    const body = await request.json()
    const { fullName, email, role } = body

    if (!fullName || !email || !role) {
      return NextResponse.json({ error: "Full name, email and role are required" }, { status: 400 })
    }

    const requiredCap = ROLE_REQUIRED_CAPABILITY[role as PartnerUserRole]
    if (requiredCap && !(await partnerHasCapability(session.partnerId, requiredCap as PartnerOrgCapability))) {
      return NextResponse.json(
        { error: "Your organisation is not approved for this role" },
        { status: 403 }
      )
    }

    const result = await createPartnerInvitation({
      partnerId: session.partnerId,
      fullName,
      email,
      role: role as PartnerUserRole,
      invitedBy: session.partnerUserId,
      actorType: "PARTNER",
    })

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({ success: true, user: result.user })
  } catch {
    return NextResponse.json({ error: "Failed to invite user" }, { status: 500 })
  }
}
