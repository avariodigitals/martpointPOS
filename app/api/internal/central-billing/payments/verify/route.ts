import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCentralRequest } from "@/lib/central-billing-auth"
import { recordPayment, confirmPayment, createReceipt } from "@/lib/finance-commercial"
import { postPaymentJournal, postInvoiceJournal } from "@/lib/finance-ledger"
import { syncInvoiceFinanceTransaction } from "@/lib/finance-commercial"
import { centralSignature } from "@/lib/central-billing-auth"
import { verifyPaystackTransaction } from "@/lib/payment-gateways"
import { queueCentralCreditFulfillment } from "@/lib/central-billing-fulfillment"

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", raw, request.headers.get("x-central-signature") || "", new URL(request.url).pathname)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Finance service unavailable" }, { status: 503 })
  try {
    const body = JSON.parse(raw) as { intent_id: string; provider_reference: string }
    const { data: intent, error: readError } = await supabase.from("central_billing_intents").select("*").eq("id", body.intent_id).single()
    if (readError || !intent || !body.provider_reference) return NextResponse.json({ error: "Purchase not found" }, { status: 404 })
    const { data: invoice } = await supabase.from("invoices").select("total_amount").eq("id", intent.invoice_id).maybeSingle()
    if (!invoice) return NextResponse.json({ error: "Purchase invoice not found" }, { status: 404 })
    if (intent.provider_reference && intent.provider_reference !== body.provider_reference) return NextResponse.json({ error: "Payment reference conflict" }, { status: 409 })
    if (!intent.provider_reference) {
      const { data: claimed, error: claimError } = await supabase.from("central_billing_intents").update({ provider_reference: body.provider_reference, updated_at: new Date().toISOString() }).eq("id", intent.id).is("provider_reference", null).select("id").maybeSingle()
      if (claimError) return NextResponse.json({ error: "Payment reference already belongs to another purchase" }, { status: 409 })
      if (!claimed) {
        const { data: current } = await supabase.from("central_billing_intents").select("provider_reference").eq("id", intent.id).single()
        if (current?.provider_reference !== body.provider_reference) return NextResponse.json({ error: "Payment reference conflict" }, { status: 409 })
      }
    }
    const { data: mapping } = await supabase.from("central_installation_mappings").select("id,business_id,fleet_install_id,store_id").eq("id", intent.mapping_id).eq("business_id", intent.business_id).maybeSingle()
    if (!mapping || Number(mapping.fleet_install_id) !== Number(intent.fleet_install_id) || Number(mapping.store_id) !== Number(intent.store_id)) return NextResponse.json({ error: "Installation mapping unavailable" }, { status: 409 })
    const expected = Number(invoice.total_amount)

    if (!intent.payment_id) {
      const verification = await verifyPaystackTransaction(body.provider_reference)
      if (!verification.status || verification.paymentStatus !== "success" || verification.reference !== body.provider_reference || verification.currency !== "NGN") return NextResponse.json({ error: "Payment is not confirmed" }, { status: 409 })
      if (!Number.isSafeInteger(verification.amountKobo) || verification.amountKobo !== Math.round(expected * 100)) return NextResponse.json({ error: "Verified payment amount does not match invoice" }, { status: 409 })
      let paymentId: string
      const { data: prior } = await supabase.from("payments").select("id").eq("central_billing_intent_id", intent.id).maybeSingle()
      if (prior) paymentId = prior.id
      else {
        const payment = await recordPayment({ business_id: intent.business_id, invoice_id: intent.invoice_id, amount: expected, currency: "NGN", payment_method: "PAYSTACK", gateway_reference: body.provider_reference, central_billing_intent_id: intent.id, notes: `Central credit invoice ${intent.invoice_id}` })
        paymentId = payment.id
      }
      const { error: linkError } = await supabase.from("central_billing_intents").update({ payment_id: paymentId, provider_reference: body.provider_reference, updated_at: new Date().toISOString() }).eq("id", intent.id).is("payment_id", null)
      if (linkError) throw linkError
    }
    const { data: linked } = await supabase.from("payments").select("id,status").eq("central_billing_intent_id", intent.id).maybeSingle()
    if (!linked) throw new Error("Payment record recovery required")
    await confirmPayment(linked.id, "Central Paystack verification", undefined)
    await createReceipt(linked.id, "Central Paystack verification")
    await syncInvoiceFinanceTransaction(intent.invoice_id)
    await postInvoiceJournal(intent.invoice_id)
    await postPaymentJournal(linked.id)

    await queueCentralCreditFulfillment(intent.id)
    const { data: savedOutbox } = await supabase.from("central_billing_fulfillment_outbox").select("payload").eq("intent_id", intent.id).single()
    const fulfillmentPayload = savedOutbox?.payload
    if (!fulfillmentPayload) throw new Error("Central fulfilment outbox could not be read")
    await supabase.from("central_billing_intents").update({ payment_status: "CONFIRMED", allocation_status: "ALLOCATED", accounting_status: "PENDING", updated_at: new Date().toISOString() }).eq("id", intent.id)
    let fulfillment = "queued"
    const centralUrl = (process.env.CENTRAL_BILLING_CENTRAL_URL || "").startsWith("https://") ? process.env.CENTRAL_BILLING_CENTRAL_URL || "" : ""
    if (centralUrl) {
      const wire = JSON.stringify(fulfillmentPayload)
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const result = await fetch(`${centralUrl.replace(/\/$/, "")}/messaging_api/fulfill_credit_purchase`, { method: "POST", headers: { "content-type": "application/json", "x-central-timestamp": timestamp, "x-central-signature": centralSignature(timestamp, wire, "/messaging_api/fulfill_credit_purchase") }, body: wire, cache: "no-store" }).catch(() => null)
      if (result?.ok) {
        const { error: ackError } = await supabase.from("central_billing_fulfillment_outbox").update({ status: "ACKNOWLEDGED", acknowledged_at: new Date().toISOString(), attempts: 1 }).eq("intent_id", intent.id)
        if (!ackError) {
          await supabase.from("central_billing_intents").update({ fulfillment_status: "ACKNOWLEDGED", updated_at: new Date().toISOString() }).eq("id", intent.id)
          fulfillment = "acknowledged"
        }
      }
    }
    return NextResponse.json({ success: true, payment_id: linked.id, fulfillment })
  } catch (error) {
    console.error("[central payment verify]", error)
    return NextResponse.json({ error: "Payment was verified or recorded incompletely; recovery will retry" }, { status: 503 })
  }
}
