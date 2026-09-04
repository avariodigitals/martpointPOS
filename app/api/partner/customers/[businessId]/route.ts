import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { auditContextFromPartnerSession } from "@/lib/audit"
import { getPartnerCustomerDetail } from "@/lib/partner-customers"

export async function GET(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "customers:view_assigned" })
  if (!auth.authorized) return auth.response!

  const ctx = auditContextFromPartnerSession(session, request)
  const result = await getPartnerCustomerDetail(
    session.partnerId,
    businessId,
    auth.user!,
    undefined,
    ctx
  )

  if (!result.ok) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  return NextResponse.json({ customer: result.detail })
}
