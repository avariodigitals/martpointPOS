import { notFound } from "next/navigation"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getPublicSiteSettings } from "@/lib/settings"
import { formatMoney } from "@/lib/money-format"
import { InvoicePaymentActions } from "./payment-actions"

export const dynamic = "force-dynamic"

export default async function PublicInvoicePaymentPage({ params, searchParams }: { params: Promise<{ invoiceId: string }>; searchParams: Promise<{ reference?: string }> }) {
  const [{ invoiceId }, query] = await Promise.all([params, searchParams])
  if (!isSupabaseConfigured()) notFound()
  const { data: invoice } = await supabase.from("invoices").select("id,invoice_number,currency,total_amount,balance_due,status,bank_details,businesses:business_id(business_name)").eq("id", invoiceId).maybeSingle()
  if (!invoice) notFound()
  const business = Array.isArray(invoice.businesses) ? invoice.businesses[0] : invoice.businesses
  const settings = await getPublicSiteSettings()
  const bankDetails = String(settings.accountNumber.trim() || invoice.bank_details || "")
  const balance = Math.max(0, Number(invoice.balance_due) || 0)
  const payable = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(String(invoice.status)) && balance > 0
  return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
    <div className="mx-auto max-w-xl space-y-6">
      <header><p className="text-sm font-semibold text-blue-700">MartPoint</p><h1 className="mt-2 text-2xl font-bold">Invoice payment</h1><p className="mt-1 text-slate-600">{business?.business_name || "Customer"} · {invoice.invoice_number}</p></header>
      <section className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">Amount due</p><p className="mt-1 text-3xl font-bold">{formatMoney(balance, invoice.currency || "NGN")}</p><p className="mt-2 text-sm text-slate-600">Invoice total: {formatMoney(Number(invoice.total_amount) || 0, invoice.currency || "NGN")}</p><p className="mt-1 text-xs text-slate-500">Status: {payable ? "Payment due" : String(invoice.status).replaceAll("_", " ").toLowerCase()}</p></section>
      {payable ? <InvoicePaymentActions invoiceId={invoice.id} balanceDue={balance} reference={query.reference} bankDetails={bankDetails} /> : bankDetails ? <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Bank transfer details</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{bankDetails}</p></section> : null}
      <p className="text-xs text-slate-500">This payment is collected by MartPoint for the invoice shown above. For payment help, reply to your invoice email.</p>
    </div>
  </main>
}
