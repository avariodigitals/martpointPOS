import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyPaystackTransaction } from "@/lib/payment-gateways"
import { confirmPayment, createReceipt, fulfillPaidInvoiceEntitlements, syncInvoiceFinanceTransaction } from "@/lib/finance-commercial"
import { postInvoiceJournal, postPaymentJournal } from "@/lib/finance-ledger"

export async function POST(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Payments are unavailable" }, { status: 503 })
  const { invoiceId } = await params
  const body = await request.json().catch(() => ({})) as { reference?: string }
  const reference = String(body.reference || "")
  if (!/^MPINV_[a-zA-Z0-9_-]{1,120}$/.test(reference)) return NextResponse.json({ error: "Invalid payment reference" }, { status: 400 })
  const { data: payment } = await supabase.from("payments").select("id,invoice_id,business_id,amount,currency,status,gateway_reference").eq("gateway_reference", reference).eq("invoice_id", invoiceId).maybeSingle()
  if (!payment) return NextResponse.json({ error: "Payment attempt not found for this invoice" }, { status: 404 })
  if (payment.status === "CONFIRMED") {
    try {
      await createReceipt(payment.id, "Paystack invoice verification")
      await syncInvoiceFinanceTransaction(invoiceId)
      await postInvoiceJournal(invoiceId)
      await postPaymentJournal(payment.id)
      await fulfillPaidInvoiceEntitlements(invoiceId)
      return NextResponse.json({ success: true, message: "Payment is already confirmed" })
    } catch (error) {
      console.error("[invoice verify] confirmed payment recovery required", error)
      return NextResponse.json({ error: "Payment is confirmed; invoice accounting is being reconciled" }, { status: 503 })
    }
  }
  const verified = await verifyPaystackTransaction(reference)
  if (!verified.status || verified.paymentStatus !== "success" || verified.reference !== reference || verified.currency !== "NGN") return NextResponse.json({ error: "Paystack has not confirmed this payment" }, { status: 409 })
  if (!Number.isSafeInteger(verified.amountKobo) || verified.amountKobo !== Math.round(Number(payment.amount) * 100)) return NextResponse.json({ error: "The verified amount does not match the payment attempt" }, { status: 409 })
  const { data: currentInvoice } = await supabase.from("invoices").select("balance_due").eq("id", invoiceId).maybeSingle()
  if (!currentInvoice || Number(payment.amount) > Number(currentInvoice.balance_due) + 0.01) return NextResponse.json({ error: "Payment is confirmed by Paystack but exceeds the remaining invoice balance; contact MartPoint for reconciliation" }, { status: 409 })
  try {
    await confirmPayment(payment.id, "Paystack invoice verification")
    await createReceipt(payment.id, "Paystack invoice verification")
    await syncInvoiceFinanceTransaction(invoiceId)
    await postInvoiceJournal(invoiceId)
    await postPaymentJournal(payment.id)
    await fulfillPaidInvoiceEntitlements(invoiceId)
    return NextResponse.json({ success: true, message: "Payment confirmed" })
  } catch (error) {
    console.error("[invoice verify] confirmed payment accounting recovery required", error)
    return NextResponse.json({ error: "Payment is confirmed; invoice accounting is being reconciled" }, { status: 503 })
  }
}
