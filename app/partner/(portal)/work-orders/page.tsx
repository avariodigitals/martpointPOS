import { redirect } from "next/navigation"
import Link from "next/link"
import { requirePartnerSession, authorizePartner } from "@/lib/partner-auth"
import { listPartnerWorkOrders, WORK_ORDER_STATUS_LABELS, type WorkOrderStatus } from "@/lib/partner-work-orders"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardList } from "lucide-react"

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

function statusClass(status: string) {
  switch (status) {
    case "COMPLETED":
    case "ACCEPTED":
      return "bg-green-100 text-green-700"
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-700"
    case "ISSUED":
      return "bg-amber-100 text-amber-700"
    case "CANCELLED":
      return "bg-red-100 text-red-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

export default async function PartnerWorkOrdersPage() {
  const session = await requirePartnerSession()

  const auth = await authorizePartner({ session, permission: "workorders:view_own", capability: "IMPLEMENTATION" })
  if (!auth.authorized) redirect("/partner")

  const workOrders = await listPartnerWorkOrders(session.partnerId)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Work Orders</h2>
        <p className="text-muted-foreground">
          Approved implementation work issued by MartPoint. Accept a work order before starting billable work.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Implementation Work Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No work orders yet. MartPoint issues one when implementation work is approved.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Reference</th>
                    <th className="px-4 py-2 text-left">Title</th>
                    <th className="px-4 py-2 text-left">Customer</th>
                    <th className="px-4 py-2 text-left">Due</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map((wo) => {
                    const business = wo.businesses as Record<string, unknown> | null
                    return (
                      <tr key={wo.id as string} className="border-t border-border">
                        <td className="px-4 py-2 font-mono text-xs">
                          <Link href={`/partner/work-orders/${wo.id}`} className="font-medium hover:underline">
                            {(wo.work_order_ref as string) || "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-2">{wo.title as string}</td>
                        <td className="px-4 py-2">{(business?.business_name as string) || "—"}</td>
                        <td className="px-4 py-2">{fmtDate(wo.due_at as string | null)}</td>
                        <td className="px-4 py-2">
                          <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-medium ${statusClass(wo.status as string)}`}>
                            {WORK_ORDER_STATUS_LABELS[wo.status as WorkOrderStatus] || (wo.status as string)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
