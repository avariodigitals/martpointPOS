import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { acknowledgeWorkOrder, startWorkOrder, requestChangeOrder } from "@/lib/partner-work-orders"

/* ─── POST: work order actions ───
 * accept          — partner principal accepts an ISSUED work order
 * start           — marks delivery started (ACCEPTED → IN_PROGRESS)
 * request-change  — partner requests a change order
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "workorders:manage_own", capability: "IMPLEMENTATION" })
  if (!auth.authorized) return auth.response

  // Accepting a work order is a principal-level act.
  const body = await request.json().catch(() => ({}))
  const action = typeof body?.action === "string" ? body.action : ""

  const { id } = await params
  const partnerId = auth.partner!.id
  const user = { id: auth.user!.id, name: auth.user!.fullName }

  if (action === "accept" || action === "start") {
    if (auth.user!.role !== "PARTNER_OWNER" && auth.user!.role !== "PARTNER_MANAGER") {
      return NextResponse.json({ error: "Only a partner owner or manager can accept work orders" }, { status: 403 })
    }
  }

  let result: { ok: boolean; error?: string }
  switch (action) {
    case "accept":
      result = await acknowledgeWorkOrder(id, partnerId, user)
      break
    case "start":
      result = await startWorkOrder(id, partnerId, user)
      break
    case "request-change":
      result = await requestChangeOrder(id, partnerId, user, {
        description: String(body?.description || ""),
        reason: body?.reason ? String(body.reason) : undefined,
        impactScope: body?.impactScope ? String(body.impactScope) : undefined,
        impactFee: body?.impactFee != null ? Number(body.impactFee) : null,
        impactSchedule: body?.impactSchedule ? String(body.impactSchedule) : undefined,
      })
      break
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
