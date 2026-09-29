import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { getPartnerWorkOrder } from "@/lib/partner-work-orders"

/* ─── GET: work order detail (milestones + change orders) ─── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "workorders:view_own", capability: "IMPLEMENTATION" })
  if (!auth.authorized) return auth.response

  const { id } = await params
  const detail = await getPartnerWorkOrder(id, auth.partner!.id)
  if (!detail) return NextResponse.json({ error: "Work order not found" }, { status: 404 })
  return NextResponse.json(detail)
}
