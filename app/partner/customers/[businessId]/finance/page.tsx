import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { getPartnerSession, authorizePartner, canPartnerAccessBusiness } from "@/lib/partner-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, RefreshCw, Receipt } from "lucide-react"

function fmtMoney(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount || 0)
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleDateString() } catch { return iso }
}

function paymentStatusLabel(status: string) {
  if (status === "PAID") return "Paid"
  if (status === "PARTIALLY_PAID") return "Partially Paid"
  return "Awaiting Payment"
}

function paymentStatusClass(status: string) {
  if (status === "PAID") return "bg-green-100 text-green-700"
  if (status === "PARTIALLY_PAID") return "bg-amber-100 text-amber-700"
  return "bg-blue-100 text-blue-700"
}

function subscriptionStatusClass(status: string) {
  if (status === "ACTIVE") return "bg-green-100 text-green-700"
  if (status === "PAST_DUE") return "bg-amber-100 text-amber-700"
  if (status === "SUSPENDED" || status === "CANCELLED" || status === "EXPIRED") return "bg-red-100 text-red-700"
  return "bg-blue-100 text-blue-700"
}

export default async function CustomerFinancePage({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params

  const session = await getPartnerSession()
  if (!session) redirect("/partner/login")

  const auth = await authorizePartner({ session, permission: "customers:view_assigned" })
  if (!auth.authorized) redirect("/partner/customers")

  const access = await canPartnerAccessBusiness(session.partnerId, businessId, {
    partnerUserId: auth.user!.id,
    userPermission: "customers:view_assigned",
  })
  if (!access.allowed) notFound()

  let invoices: any[] = []
  let subscriptions: any[] = []
  let renewals: any[] = []

  if (isSupabaseConfigured()) {
    const [invoicesRes, subscriptionsRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, due_date, total_amount, amount_paid, balance_due, status, currency")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("*, plans(name), subscription_addons(*, addons(name))")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
    ])

    invoices = invoicesRes.data || []
    subscriptions = subscriptionsRes.data || []

    const subscriptionIds = subscriptions.map((s: any) => s.id as string)
    if (subscriptionIds.length) {
      const { data: renewalsData } = await supabase
        .from("subscription_renewals")
        .select("*")
        .in("subscription_id", subscriptionIds)
        .order("renewal_due_date", { ascending: true })
      renewals = renewalsData || []
    }
  }

  const activeSubscription = subscriptions.find((s: any) => s.status === "ACTIVE") || subscriptions[0]
  const activeAddons = activeSubscription?.subscription_addons || []
  const nextRenewal = renewals[0]

  // Only surface invoices that are not voided/cancelled, grouped into three payment buckets.
  const visibleInvoices = invoices.filter((inv: any) => inv.status !== "VOID" && inv.status !== "CANCELLED")

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/partner/customers/${businessId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Customer
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2">Finance</h2>
        <p className="text-muted-foreground text-sm">Safe commercial status for this customer</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Invoice Payment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visibleInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices to display.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-2">Invoice</th>
                    <th className="px-4 py-2">Total</th>
                    <th className="px-4 py-2">Paid</th>
                    <th className="px-4 py-2">Balance</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInvoices.map((inv: any) => (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{inv.invoice_number}</td>
                      <td className="px-4 py-2">{fmtMoney(inv.total_amount, inv.currency)}</td>
                      <td className="px-4 py-2">{fmtMoney(inv.amount_paid, inv.currency)}</td>
                      <td className="px-4 py-2">{fmtMoney(inv.balance_due, inv.currency)}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs uppercase px-2 py-0.5 rounded-full font-medium ${paymentStatusClass(inv.status)}`}>
                          {paymentStatusLabel(inv.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2">{fmtDate(inv.due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Subscription & Renewal Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeSubscription ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{activeSubscription.plans?.name || activeSubscription.plan_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subscription status</span>
                <span className={`text-xs uppercase px-2 py-0.5 rounded-full font-medium ${subscriptionStatusClass(activeSubscription.status)}`}>
                  {activeSubscription.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Billing interval</span>
                <span className="font-medium">{activeSubscription.billing_interval}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current period</span>
                <span className="font-medium">{fmtDate(activeSubscription.current_period_start)} – {fmtDate(activeSubscription.current_period_end)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Renewal due</span>
                <span className="font-medium">{fmtDate(nextRenewal?.renewal_due_date || activeSubscription.renewal_date)}</span>
              </div>
              {activeAddons.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Add-ons</p>
                  <div className="flex flex-wrap gap-2">
                    {activeAddons.map((a: any, i: number) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">
                        {a.addons?.name || a.addon_id} × {a.quantity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No subscription found.</p>
          )}

          {renewals.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Upcoming renewals</p>
              <div className="space-y-2">
                {renewals.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span>{fmtDate(r.renewal_due_date)}</span>
                    <span className="font-medium">{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
