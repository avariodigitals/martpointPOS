import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordPayment } from "@/lib/finance-commercial"

/** Start a MartPoint receivable checkout. The invoice UUID is the unguessable public link key. */
export async function POST(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Payments are unavailable" }, { status: 503 })
  const { invoiceId } = await params
  const { data: invoice } = await supabase.from("invoices").select("id,invoice_number,business_id,currency,total_amount,balance_due,status,businesses:business_id(primary_email,business_name)").eq("id", invoiceId).maybeSingle()
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(String(invoice.status))) return NextResponse.json({ error: "This invoice cannot be paid online" }, { status: 409 })
  if (String(invoice.currency || "NGN").toUpperCase() !== "NGN") return NextResponse.json({ error: "Online card payment is currently available for NGN invoices" }, { status: 409 })
  const amount = Math.round(Number(invoice.balance_due) * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0) return NextResponse.json({ error: "This invoice has no balance due" }, { status: 409 })
  const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY
  if (!secret) return NextResponse.json({ error: "Online payments are not configured" }, { status: 503 })
  const business = Array.isArray(invoice.businesses) ? invoice.businesses[0] : invoice.businesses
  const email = String(business?.primary_email || "").trim()
  if (!email) return NextResponse.json({ error: "Ask MartPoint to add a billing email to this invoice" }, { status: 409 })
  const { data: pending } = await supabase.from("payments").select("gateway_reference,checkout_url").eq("invoice_id", invoice.id).eq("payment_method", "PAYSTACK").eq("status", "PENDING").order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (pending) return pending.checkout_url
    ? NextResponse.json({ success: true, authorization_url: pending.checkout_url, reference: pending.gateway_reference })
    : NextResponse.json({ error: "A Paystack checkout is already being prepared. Refresh this page shortly." }, { status: 409 })
  const reference = `MPINV_${String(invoice.invoice_number).replace(/[^a-zA-Z0-9_-]/g, "_")}_${randomUUID().replace(/-/g, "")}`
  let paymentId = ""
  try {
    const payment = await recordPayment({ business_id: invoice.business_id, invoice_id: invoice.id, amount: amount / 100, currency: "NGN", payment_method: "PAYSTACK", gateway_reference: reference, notes: `Paystack checkout for ${invoice.invoice_number}` })
    paymentId = payment.id
  } catch (error) {
    console.error("[invoice checkout] payment intent record failed", error)
    return NextResponse.json({ error: "Could not prepare this invoice payment" }, { status: 503 })
  }
  const origin = (process.env.NEXT_PUBLIC_BASE_URL || new URL(_request.url).origin).replace(/\/$/, "")
  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, amount, currency: "NGN", reference, callback_url: `${origin}/pay/invoice/${invoiceId}`, metadata: { purpose: "martpoint_invoice", invoice_id: invoice.id, invoice_number: invoice.invoice_number, business_id: invoice.business_id } }),
      cache: "no-store",
    })
    const result = await response.json().catch(() => null) as { status?: boolean; data?: { authorization_url?: string } } | null
    const checkoutUrl = result?.data?.authorization_url || ""
    if (!response.ok || !result?.status || !checkoutUrl.startsWith("https://")) {
      await supabase.from("payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", paymentId).eq("status", "PENDING")
      return NextResponse.json({ error: "Paystack could not start checkout" }, { status: 502 })
    }
    const { error: saveError } = await supabase.from("payments").update({ checkout_url: checkoutUrl, updated_at: new Date().toISOString() }).eq("id", paymentId).eq("status", "PENDING")
    if (saveError) {
      await supabase.from("payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", paymentId).eq("status", "PENDING")
      return NextResponse.json({ error: "Checkout could not be linked. Refresh the invoice before retrying." }, { status: 503 })
    }
    return NextResponse.json({ success: true, authorization_url: checkoutUrl, reference })
  } catch (error) {
    console.error("[invoice checkout] Paystack initialization failed", error)
    await supabase.from("payments").update({ status: "FAILED", updated_at: new Date().toISOString() }).eq("id", paymentId).eq("status", "PENDING")
    return NextResponse.json({ error: "Paystack checkout could not be confirmed. Refresh the invoice before retrying." }, { status: 502 })
  }
}
