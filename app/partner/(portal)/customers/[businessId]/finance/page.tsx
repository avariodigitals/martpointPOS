/* eslint-disable @typescript-eslint/no-explicit-any */

import { redirect, notFound } from "next/navigation"
import { Fragment } from "react"
import Link from "next/link"
import { getPartnerSession, authorizePartner, canPartnerAccessBusiness } from "@/lib/partner-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Info, Landmark, RefreshCw, Receipt } from "lucide-react"
import { enumLabel } from "@/lib/utils"
import { PaymentProofForm } from "./payment-proof-form"

function fmtMoney(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount || 0)
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleDateString() } catch { return iso }
}

function paymentStatusLabel(status: string) {
  if (status === "DRAFT") return "Invoice not issued"
  if (status === "ISSUED") return "Awaiting Payment"
  if (status === "PAID") return "Paid"
  if (status === "PARTIALLY_PAID") return "Partially Paid"
  if (status === "OVERDUE") return "Overdue"
  return "Awaiting Payment"
}

function paymentStatusClass(status: string) {
  if (status === "DRAFT") return "bg-slate-100 text-slate-700"
  if (status === "PAID") return "bg-green-100 text-green-700"
  if (status === "PARTIALLY_PAID") return "bg-amber-100 text-amber-700"
  if (status === "OVERDUE") return "bg-red-100 text-red-700"
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
  let payments: any[] = []
  let subscriptions: any[] = []
  let renewals: any[] = []

  if (isSupabaseConfigured()) {
    const [invoicesRes, paymentsRes, subscriptionsRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, due_date, total_amount, amount_paid, balance_due, status, currency, payment_terms, bank_details, notes_public")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("id, payment_reference, invoice_id, amount, currency, status, proof_document_path, rejection_reason, rejected_at, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("*, plans(name), subscription_addons(*, addons(name))")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
    ])

    invoices = invoicesRes.data || []
    payments = paymentsRes.data || []
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
  const proofAuth = await authorizePartner({ session, permission: "payments:submit_proof" })
  const canSubmitProof = proofAuth.authorized

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
                    <Fragment key={inv.id}>
                      <tr className="border-t border-border">
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
                      {inv.status === "DRAFT" && (
                        <tr className="border-t border-border">
                          <td colSpan={6} className="px-4 py-2 text-xs text-muted-foreground bg-muted/20">
                            This invoice has been created but has not been issued by MartPoint Finance yet. Payment proof upload will appear here after it is issued.
                          </td>
                        </tr>
                      )}
                      {inv.balance_due > 0 && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status) && (
                        <tr className="border-t border-border">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="rounded-md border border-blue-200 bg-blue-50/60 p-3 space-y-3">
                              <div className="flex items-start gap-2">
                                <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                                <div>
                                  <p className="text-sm font-semibold text-blue-950">Payment instructions</p>
                                  <p className="mt-1 text-xs text-blue-900">
                                    Pay the outstanding balance using the details below, then upload a clear transfer receipt or payment confirmation. Finance will verify the proof before marking the invoice as paid.
                                  </p>
                                </div>
                              </div>
                              {(inv.bank_details || inv.payment_terms || inv.notes_public) ? (
                                <div className="grid gap-2 text-xs md:grid-cols-3">
                                  {inv.bank_details && (
                                    <div className="rounded-md border border-blue-200 bg-background p-2">
                                      <p className="mb-1 font-semibold text-foreground">Bank / account details</p>
                                      <p className="whitespace-pre-line text-muted-foreground">{inv.bank_details}</p>
                                    </div>
                                  )}
                                  {inv.payment_terms && (
                                    <div className="rounded-md border border-blue-200 bg-background p-2">
                                      <p className="mb-1 font-semibold text-foreground">Payment terms</p>
                                      <p className="whitespace-pre-line text-muted-foreground">{inv.payment_terms}</p>
                                    </div>
                                  )}
                                  {inv.notes_public && (
                                    <div className="rounded-md border border-blue-200 bg-background p-2">
                                      <p className="mb-1 font-semibold text-foreground">Additional notes</p>
                                      <p className="whitespace-pre-line text-muted-foreground">{inv.notes_public}</p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                                  Payment instructions have not been configured yet. Contact MartPoint Finance before making the transfer.
                                </p>
                              )}
                              {canSubmitProof ? (
                                <PaymentProofForm businessId={businessId} invoiceId={inv.id} balance={Number(inv.balance_due)} currency={inv.currency || "NGN"} />
                              ) : (
                                <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                                  Your partner user role cannot submit payment proof. Ask the partner owner or manager to upload the transfer receipt, or update your partner role.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {payments.filter((payment: any) => payment.status === "PENDING").length > 0 && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-md p-3">
              Payment proof submitted. Finance must verify the transfer before the invoice status changes.
            </p>
          )}
          {payments.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment proof history</p>
              <div className="space-y-2">
                {payments.slice(0, 6).map((payment: any) => (
                  <div key={payment.id} className="rounded-md border border-border px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono">{payment.payment_reference}</span>
                      <span className={`rounded-full px-2 py-0.5 font-medium uppercase ${payment.status === "CONFIRMED" ? "bg-green-100 text-green-700" : payment.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {payment.status === "FAILED" ? "Rejected" : enumLabel(payment.status)}
                      </span>
                    </div>
                    {payment.status === "FAILED" && payment.rejection_reason && (
                      <p className="mt-1 text-red-700">Finance note: {payment.rejection_reason}</p>
                    )}
                  </div>
                ))}
              </div>
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
                    <span className="font-medium">{enumLabel(r.status)}</span>
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
