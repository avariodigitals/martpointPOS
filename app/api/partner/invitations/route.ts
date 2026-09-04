import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { listPartnerInvitations } from "@/lib/partner-service"

export async function GET() {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:users:view" })
  if (!auth.authorized) return auth.response!

  const invitations = await listPartnerInvitations(session.partnerId)
  return NextResponse.json({ invitations })
}
