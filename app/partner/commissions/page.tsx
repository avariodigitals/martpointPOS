import { redirect } from "next/navigation"
import Link from "next/link"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download } from "lucide-react"

function fmtMoney(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount || 0)
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleDateString() } catch { return iso }
}

function statusClass(status: string) {
  if (status === "PAID") return "bg-green-100 text-green-700"
  if (status === "ELIGIBLE") return "bg-blue-100 text-blue-700"
  if (status === "APPROVED") return "bg-amber-100 text-amber-700"
  if (status === "SCHEDULED") return "bg-purple-100 text-purple-700"
  return "bg-gray-100 text-gray-700"
}

function toCsv(rows: any[]) {
  const header = ["Customer", "Type", "Applies To", "Basis", "Rate", "Commission", "Currency", "Status", "Earned/Paid Date"]
  const lines = [header]
  for (const r of rows) {
    const plan = (r.commission_plans as any) || {}
    const basis = plan.commission_basis || ""
    const rate = basis === "PERCENTAGE" ? `${plan.percentage ?? ""}%` : `${plan.fixed_amount ?? ""}`
    const date = (r.paid_at as string | null) || (r.earned_at as string | null) || ""
    const cells = [
      (r.businesses as { business_name?: string | null } | null)?.business_name || "",
      r.attribution_type as string,
      plan.applies_to || "",
      basis,
      rate,
      String(r.commission_amount as number),
      r.currency as string,
      r.status as string,
      date,
    ]
    lines.push(cells.map((c) => `"${String(c).replace(/"/g, "\"\"")}"`))
  }
  return lines.map((line) => line.join(",")).join("\n")
}

export default async function PartnerCommissionsPage() {
  const session = await getPartnerSession()
  if (!session) redirect("/partner/login")

  const auth = await authorizePartner({ session, permission: "commissions:view_own" })
  if (!auth.authorized) redirect("/partner")

  let rows: any[] = []
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from("partner_commissions")
      .select(
        "*, commission_plans:commission_plan_id (name, commission_basis, applies_to, percentage, fixed_amount), businesses:business_id (business_name)"
      )
      .eq("partner_id", session.partnerId)
      .order("created_at", { ascending: false })
    if (!error) rows = data || []
  }

  const counts = {
    ELIGIBLE: rows.filter((r) => r.status === "ELIGIBLE").length,
    APPROVED: rows.filter((r) => r.status === "APPROVED").length,
    SCHEDULED: rows.filter((r) => r.status === "SCHEDULED").length,
    PAID: rows.filter((r) => r.status === "PAID").length,
  }

  const csv = toCsv(rows)
  const csvDataUrl = `data:text/csv;base64,${Buffer.from(csv, "utf8").toString("base64")}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/partner" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Link>
          <h2 className="text-2xl font-bold tracking-tight mt-2">Commission Portal</h2>
          <p className="text-muted-foreground text-sm">Your commission earnings</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={csvDataUrl} download="commissions.csv">
            <Download className="w-4 h-4 mr-2" /> Download CSV
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{counts.ELIGIBLE}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Eligible</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{counts.APPROVED}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{counts.SCHEDULED}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{counts.PAID}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Paid</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Commissions</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commissions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Basis</th>
                    <th className="px-4 py-2">Commission</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Earned/Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const plan = (r.commission_plans as any) || {}
                    const rate =
                      plan.commission_basis === "PERCENTAGE" ? `${plan.percentage ?? ""}%` : `Fixed ${plan.fixed_amount ?? ""}`
                    const date = (r.paid_at as string | null) || (r.earned_at as string | null)
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-4 py-2 font-medium">
                          {r.businesses?.business_name || "—"}
                        </td>
                        <td className="px-4 py-2">{r.attribution_type}</td>
                        <td className="px-4 py-2">
                          {plan.commission_basis} {rate}
                        </td>
                        <td className="px-4 py-2">{fmtMoney(r.commission_amount, r.currency)}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs uppercase px-2 py-0.5 rounded-full font-medium ${statusClass(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">{fmtDate(date)}</td>
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
