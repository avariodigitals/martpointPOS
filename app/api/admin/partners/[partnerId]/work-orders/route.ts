import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import {
  listWorkOrdersForPartnerAdmin,
  createWorkOrder,
  issueWorkOrder,
  closeWorkOrder,
  reviewMilestone,
  decideChangeOrder,
  type WorkOrderMilestoneInput,
} from "@/lib/partner-work-orders"

/* ─── GET: partner's work orders (admin) ─── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { partnerId } = await params
  const workOrders = await listWorkOrdersForPartnerAdmin(partnerId)
  return NextResponse.json({ workOrders })
}

/* ─── POST: create / issue / close work orders; review milestones; decide change orders ───
 * Body: { action: "create" | "issue" | "close" | "review-milestone" | "decide-change", ... }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { partnerId } = await params
  const body = await request.json().catch(() => ({}))
  const action = typeof body?.action === "string" ? body.action : ""

  let result: { ok: boolean; error?: string; workOrder?: Record<string, unknown> }
  switch (action) {
    case "create": {
      if (!body?.title || !body?.scope) {
        return NextResponse.json({ error: "Title and scope are required" }, { status: 400 })
      }
      const milestones: WorkOrderMilestoneInput[] = Array.isArray(body?.milestones)
        ? body.milestones.map((m: Record<string, unknown>, i: number) => ({
            title: String(m.title || ""),
            description: m.description ? String(m.description) : undefined,
            orderIndex: i,
            dueDate: m.dueDate ? String(m.dueDate) : null,
            feeAmount: m.feeAmount != null && m.feeAmount !== "" ? Number(m.feeAmount) : null,
            currency: m.currency ? String(m.currency) : undefined,
            acceptanceCriteria: m.acceptanceCriteria ? String(m.acceptanceCriteria) : undefined,
          }))
        : []
      result = await createWorkOrder(
        {
          partnerId,
          assignmentId: body?.assignmentId ? String(body.assignmentId) : null,
          businessId: body?.businessId ? String(body.businessId) : null,
          title: String(body.title),
          scope: String(body.scope),
          exclusions: body?.exclusions ? String(body.exclusions) : undefined,
          acceptanceCriteria: body?.acceptanceCriteria ? String(body.acceptanceCriteria) : undefined,
          customerDuties: body?.customerDuties ? String(body.customerDuties) : undefined,
          accessNotes: body?.accessNotes ? String(body.accessNotes) : undefined,
          feeTotal: body?.feeTotal != null && body.feeTotal !== "" ? Number(body.feeTotal) : null,
          currency: body?.currency ? String(body.currency) : undefined,
          startsAt: body?.startsAt ? String(body.startsAt) : null,
          dueAt: body?.dueAt ? String(body.dueAt) : null,
          milestones,
        },
        session.userId
      )
      break
    }
    case "issue":
      if (!body?.workOrderId) return NextResponse.json({ error: "Work order is required" }, { status: 400 })
      result = await issueWorkOrder(String(body.workOrderId), session.userId)
      break
    case "close":
      if (!body?.workOrderId) return NextResponse.json({ error: "Work order is required" }, { status: 400 })
      result = await closeWorkOrder(String(body.workOrderId), session.userId)
      break
    case "review-milestone": {
      if (!body?.milestoneId || !body?.decision) {
        return NextResponse.json({ error: "Milestone and decision are required" }, { status: 400 })
      }
      const decision = String(body.decision)
      if (decision !== "ACCEPTED" && decision !== "REJECTED") {
        return NextResponse.json({ error: "Decision must be ACCEPTED or REJECTED" }, { status: 400 })
      }
      result = await reviewMilestone(String(body.milestoneId), decision, body?.notes ? String(body.notes) : null, session.userId)
      break
    }
    case "decide-change": {
      if (!body?.changeOrderId || !body?.decision) {
        return NextResponse.json({ error: "Change order and decision are required" }, { status: 400 })
      }
      const decision = String(body.decision)
      if (!["APPROVED", "REJECTED", "DEFERRED"].includes(decision)) {
        return NextResponse.json({ error: "Decision must be APPROVED, REJECTED or DEFERRED" }, { status: 400 })
      }
      result = await decideChangeOrder(
        String(body.changeOrderId),
        decision as "APPROVED" | "REJECTED" | "DEFERRED",
        body?.reason ? String(body.reason) : null,
        session.userId
      )
      break
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true, workOrder: result.workOrder })
}
