import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { listPartnerCustomers } from "@/lib/partner-customers"

export async function GET() {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "customers:view_assigned" })
  if (!auth.authorized) return auth.response!

  const customers = await listPartnerCustomers(session.partnerId)
  return NextResponse.json({ customers })
}
