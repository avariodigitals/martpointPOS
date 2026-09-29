import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { listPartnerWorkOrders } from "@/lib/partner-work-orders"

/* ─── GET: partner's work orders ─── */
export async function GET() {
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "workorders:view_own", capability: "IMPLEMENTATION" })
  if (!auth.authorized) return auth.response!

  const workOrders = await listPartnerWorkOrders(auth.partner!.id)
  return NextResponse.json({ workOrders })
}
