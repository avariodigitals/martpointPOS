import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCentralRequest, centralSignature } from "@/lib/central-billing-auth"
import { recordPayment, confirmPayment, createReceipt, syncInvoiceFinanceTransaction } from "@/lib/finance-commercial"
import { postPaymentJournal, postInvoiceJournal } from "@/lib/finance-ledger"
import { queueCentralCreditFulfillment } from "@/lib/central-billing-fulfillment"

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", raw, request.headers.get("x-central-signature") || "", new URL(request.url).pathname)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Finance service unavailable" }, { status: 503 })
  try {
    const body = JSON.parse(raw) as { intent_id: string; manual_payment_key: string; proof_sha256: string; note: string; confirmed_by: string }
    if (!body.intent_id || !/^central-manual:[0-9]+$/.test(body.manual_payment_key) || !/^[a-f0-9]{64}$/.test(body.proof_sha256) || body.note.trim().length < 5 || !body.confirmed_by) return NextResponse.json({ error: "Manual payment evidence is incomplete" }, { status: 400 })
    const { data: intent } = await supabase.from("central_billing_intents").select("*").eq("id", body.intent_id).single()
    const { data: invoice } = intent?.invoice_id ? await supabase.from("invoices").select("total_amount").eq("id", intent.invoice_id).maybeSingle() : { data: null }
    if (!intent?.invoice_id || !invoice) return NextResponse.json({ error: "Purchase invoice not found" }, { status: 404 })
    if (intent.manual_payment_key && intent.manual_payment_key !== body.manual_payment_key) return NextResponse.json({ error: "Manual payment key conflict" }, { status: 409 })
    await supabase.from("central_billing_intents").update({ manual_payment_key: body.manual_payment_key, updated_at: new Date().toISOString() }).eq("id", intent.id).is("manual_payment_key", null)
    const { data: existing } = await supabase.from("payments").select("id").eq("central_billing_intent_id", intent.id).maybeSingle()
    const payment = existing ? existing : await recordPayment({ business_id: intent.business_id, invoice_id: intent.invoice_id, amount: Number(invoice.total_amount), currency: "NGN", payment_method: "BANK_TRANSFER", central_billing_intent_id: intent.id, notes: `Central manual payment ${body.manual_payment_key}; evidence SHA-256 ${body.proof_sha256}; ${body.note.trim()}` })
    await confirmPayment(payment.id, body.confirmed_by)
    await createReceipt(payment.id, body.confirmed_by)
    await syncInvoiceFinanceTransaction(intent.invoice_id)
    await postInvoiceJournal(intent.invoice_id)
    await postPaymentJournal(payment.id)
    await queueCentralCreditFulfillment(intent.id)
    const { data: savedOutbox } = await supabase.from("central_billing_fulfillment_outbox").select("payload").eq("intent_id", intent.id).single()
    const fulfillmentPayload = savedOutbox?.payload
    if (!fulfillmentPayload) throw new Error("Central fulfilment outbox could not be read")
    await supabase.from("central_billing_intents").update({ payment_status: "CONFIRMED", allocation_status: "ALLOCATED", accounting_status: "PENDING", updated_at: new Date().toISOString() }).eq("id", intent.id)
    let fulfillment = "queued"
    const centralUrl = (process.env.CENTRAL_BILLING_CENTRAL_URL || "").startsWith("https://") ? process.env.CENTRAL_BILLING_CENTRAL_URL || "" : ""
    if (centralUrl) {
      const wire = JSON.stringify(fulfillmentPayload), timestamp = Math.floor(Date.now() / 1000).toString()
      const response = await fetch(`${centralUrl.replace(/\/$/, "")}/messaging_api/fulfill_credit_purchase`, { method: "POST", headers: { "content-type": "application/json", "x-central-timestamp": timestamp, "x-central-signature": centralSignature(timestamp, wire, "/messaging_api/fulfill_credit_purchase") }, body: wire, cache: "no-store" }).catch(() => null)
      if (response?.ok) {
        await supabase.from("central_billing_fulfillment_outbox").update({ status: "ACKNOWLEDGED", acknowledged_at: new Date().toISOString(), attempts: 1 }).eq("intent_id", intent.id)
        await supabase.from("central_billing_intents").update({ fulfillment_status: "ACKNOWLEDGED", updated_at: new Date().toISOString() }).eq("id", intent.id)
        fulfillment = "acknowledged"
      }
    }
    return NextResponse.json({ success: true, payment_id: payment.id, fulfillment })
  } catch (error) {
    console.error("[central manual payment]", error)
    return NextResponse.json({ error: "Manual payment is pending recovery" }, { status: 503 })
  }
}
