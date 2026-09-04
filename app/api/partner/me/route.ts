import { NextResponse } from "next/server"
import {
  getPartnerSession,
  authorizePartner,
  getPartnerById,
  getPartnerUserById,
  getPartnerCapabilities,
} from "@/lib/partner-auth"

export async function GET() {
  const session = await getPartnerSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const auth = await authorizePartner({ session, permission: "partner:profile:view" })
  if (!auth.authorized) return auth.response!

  const [partner, user, capabilities] = await Promise.all([
    getPartnerById(session.partnerId),
    getPartnerUserById(session.partnerUserId),
    getPartnerCapabilities(session.partnerId),
  ])

  return NextResponse.json({
    partner,
    user,
    capabilities,
  })
}
