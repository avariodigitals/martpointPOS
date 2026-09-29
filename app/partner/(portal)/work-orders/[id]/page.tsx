import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { requirePartnerSession, authorizePartner } from "@/lib/partner-auth"
import { getPartnerWorkOrder, WORK_ORDER_STATUS_LABELS, type WorkOrderStatus } from "@/lib/partner-work-orders"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WorkOrderActionButton, EvidenceForm, ChangeOrderForm } from "../work-orders-client"

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

function milestoneClass(status: string) {
  switch (status) {
    case "ACCEPTED":
      return "bg-green-100 text-green-700"
    case "SUBMITTED":
      return "bg-blue-100 text-blue-700"
    case "REJECTED":
      return "bg-red-100 text-red-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

function fmtMoney(amount: unknown, currency: string) {
  if (amount == null) return "—"
  return `${Number(amount).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePartnerSession()

  const auth = await authorizePartner({ session, permission: "workorders:view_own", capability: "IMPLEMENTATION" })
  if (!auth.authorized) redirect("/partner/work-orders")

  const { id } = await params
  const detail = await getPartnerWorkOrder(id, session.partnerId)
  if (!detail) notFound()

  const { workOrder: wo, milestones, changeOrders } = detail
  const status = wo.status as WorkOrderStatus
  const canManage = session.role === "PARTNER_OWNER" || session.role === "PARTNER_MANAGER" || session.role === "PARTNER_IMPLEMENTATION"
  const canAccept = (session.role === "PARTNER_OWNER" || session.role === "PARTNER_MANAGER") && status === "ISSUED"
  const currency = (wo.currency as string) || "NGN"
  const business = wo.businesses as Record<string, unknown> | null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-mono">{(wo.work_order_ref as string) || "Work Order"}</h2>
          <p className="text-muted-foreground">{wo.title as string}</p>
        </div>
        <div className="flex items-center gap-2">
          {canAccept && <WorkOrderActionButton workOrderId={id} action="accept" label="Accept work order" />}
          {canManage && status === "ACCEPTED" && <WorkOrderActionButton workOrderId={id} action="start" label="Start work" />}
          <Link href="/partner/work-orders" className="text-sm text-muted-foreground hover:underline">← Back</Link>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><p className="text-muted-foreground">Status</p><p className="font-medium">{WORK_ORDER_STATUS_LABELS[status] || status}</p></div>
            <div><p className="text-muted-foreground">Customer</p><p className="font-medium">{(business?.business_name as string) || "—"}</p></div>
            <div><p className="text-muted-foreground">Fee total</p><p className="font-medium">{fmtMoney(wo.fee_total, currency)}</p></div>
            <div><p className="text-muted-foreground">Start</p><p className="font-medium">{fmtDate(wo.starts_at as string | null)}</p></div>
            <div><p className="text-muted-foreground">Due</p><p className="font-medium">{fmtDate(wo.due_at as string | null)}</p></div>
            <div><p className="text-muted-foreground">Accepted</p><p className="font-medium">{fmtDate(wo.partner_acknowledged_at as string | null)}</p></div>
          </div>
          <div className="mt-4 text-sm">
            <p className="text-muted-foreground mb-1">Scope</p>
            <p className="whitespace-pre-wrap">{wo.scope as string}</p>
            {!!wo.exclusions && (
              <>
                <p className="text-muted-foreground mt-3 mb-1">Exclusions</p>
                <p className="whitespace-pre-wrap">{wo.exclusions as string}</p>
              </>
            )}
            {!!wo.acceptance_criteria && (
              <>
                <p className="text-muted-foreground mt-3 mb-1">Acceptance criteria</p>
                <p className="whitespace-pre-wrap">{wo.acceptance_criteria as string}</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Milestones</CardTitle></CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones on this work order.</p>
          ) : (
            <div className="space-y-3">
              {milestones.map((m) => {
                const mStatus = m.status as string
                const canSubmit = canManage && ["ACCEPTED", "IN_PROGRESS"].includes(status) && ["PENDING", "REJECTED"].includes(mStatus)
                return (
                  <div key={m.id as string} className="p-4 rounded-xl border border-border bg-background">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{m.title as string}</p>
                        {!!m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description as string}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          Due {fmtDate(m.due_date as string | null)} · Fee {fmtMoney(m.fee_amount, (m.currency as string) || currency)}
                        </p>
                        {!!m.acceptance_criteria && (
                          <p className="text-xs text-muted-foreground mt-1">Acceptance: {m.acceptance_criteria as string}</p>
                        )}
                        {mStatus === "REJECTED" && !!m.review_notes && (
                          <p className="text-xs text-red-700 bg-red-50 rounded-md px-2 py-1 mt-2">
                            Rejected: {m.review_notes as string}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-medium ${milestoneClass(mStatus)}`}>
                        {mStatus}
                      </span>
                    </div>
                    {canSubmit && <EvidenceForm milestoneId={m.id as string} />}
                  </div>
                )
              })}
            </div>
          )}
          {canManage && ["ISSUED", "ACCEPTED", "IN_PROGRESS"].includes(status) && (
            <div className="mt-4">
              <ChangeOrderForm workOrderId={id} />
            </div>
          )}
        </CardContent>
      </Card>

      {changeOrders.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Change Requests</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {changeOrders.map((co) => (
                <div key={co.id as string} className="p-3 rounded-lg border border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm">{co.description as string}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requested {fmtDate(co.created_at as string)}
                        {!!co.impact_fee && ` · Fee impact ${fmtMoney(co.impact_fee, currency)}`}
                        {!!co.decision_reason && ` · ${co.decision_reason as string}`}
                      </p>
                    </div>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-medium ${milestoneClass(co.status as string)}`}>
                      {co.status as string}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
