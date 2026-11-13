import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { centralSignature } from "@/lib/central-billing-auth"
import { confirmPayment, createReceipt, syncInvoiceFinanceTransaction } from "@/lib/finance-commercial"
import { postInvoiceJournal, postPaymentJournal } from "@/lib/finance-ledger"
import { queueCentralCreditFulfillment } from "@/lib/central-billing-fulfillment"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let paymentChecks = 0, paymentsConfirmed = 0, financeRetried = 0, fulfillmentRetried = 0
  try {
    // Browser returns and Paystack webhooks are fast paths. This server-side
    // poll is the durable fallback when either callback is missed: verify old
    // pending references with Paystack and run the exact same settlement path.
    const pendingCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { data: pendingIntents, error: pendingError } = await supabase.from("central_billing_intents")
      .select("id,provider_reference")
      .eq("payment_status", "PENDING")
      .not("provider_reference", "is", null)
      .lt("updated_at", pendingCutoff)
      .order("updated_at", { ascending: true })
      .limit(25)
    if (pendingError) throw pendingError
    const origin = new URL(request.url).origin
    const verifyPath = "/api/internal/central-billing/payments/verify"
    for (const intent of pendingIntents || []) {
      if (!intent.provider_reference) continue
      const wire = JSON.stringify({ intent_id: intent.id, provider_reference: intent.provider_reference })
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const response = await fetch(`${origin}${verifyPath}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-central-timestamp": timestamp, "x-central-signature": centralSignature(timestamp, wire, verifyPath) },
        body: wire,
        cache: "no-store",
      }).catch(() => null)
      paymentChecks++
      if (response?.ok) paymentsConfirmed++
      else {
        // updated_at doubles as a poll lease so an unpaid checkout is not
        // queried on every cron tick. A later retry can still confirm it.
        await supabase.from("central_billing_intents").update({ updated_at: new Date().toISOString() })
          .eq("id", intent.id).eq("payment_status", "PENDING").eq("provider_reference", intent.provider_reference)
      }
    }

    const { data: initialIntents, error } = await supabase.from("central_billing_intents").select("id,invoice_id,payment_id").eq("payment_status", "CONFIRMED").or("accounting_status.neq.POSTED,fulfillment_status.neq.ACKNOWLEDGED").limit(50)
    if (error) throw error
    const { data: confirmedCentralPayments } = await supabase.from("payments").select("central_billing_intent_id").eq("status", "CONFIRMED").not("central_billing_intent_id", "is", null).limit(100)
    const candidateIds = new Set([...(initialIntents || []).map((i) => i.id), ...(confirmedCentralPayments || []).map((p) => p.central_billing_intent_id).filter((id): id is string => !!id)])
    for (const candidateId of candidateIds) {
      const { data: intent } = await supabase.from("central_billing_intents").select("id,invoice_id,payment_id,payment_status").eq("id", candidateId).maybeSingle()
      if (!intent) continue
      let paymentId = intent.payment_id
      if (!paymentId) {
        const { data: linkedPayment } = await supabase.from("payments").select("id,status").eq("central_billing_intent_id", intent.id).maybeSingle()
        if (linkedPayment?.status === "CONFIRMED") paymentId = linkedPayment.id
      }
      if (paymentId) {
        try {
          const { data: payment } = await supabase.from("payments").select("status").eq("id", paymentId).maybeSingle()
          if (payment?.status !== "CONFIRMED") continue
          // Re-run the idempotent confirmation path so missing allocations and
          // stale invoice amount_paid/balance_due values are repaired as well.
          await confirmPayment(paymentId, "Central billing recovery")
          await createReceipt(paymentId, "Central billing recovery")
          await supabase.from("central_billing_intents").update({ payment_id: paymentId, payment_status: "CONFIRMED", updated_at: new Date().toISOString() }).eq("id", intent.id)
          await queueCentralCreditFulfillment(intent.id)
          await syncInvoiceFinanceTransaction(intent.invoice_id)
          await postInvoiceJournal(intent.invoice_id)
          await postPaymentJournal(paymentId)
          const { data: posted } = await supabase.from("journal_entries").select("source_type").in("source_id", [intent.invoice_id, paymentId]).in("source_type", ["INVOICE", "PAYMENT"]).eq("status", "POSTED")
          const types = new Set((posted || []).map((row) => row.source_type))
          const accountingStatus = types.has("INVOICE") && types.has("PAYMENT") ? "POSTED" : "FAILED"
          await supabase.from("central_billing_intents").update({ accounting_status: accountingStatus, last_error: accountingStatus === "POSTED" ? null : "Finance journal is not posted; verify payment and accounting configuration.", updated_at: new Date().toISOString() }).eq("id", intent.id)
          financeRetried++
        } catch (err) {
          await supabase.from("central_billing_intents").update({ accounting_status: "FAILED", last_error: err instanceof Error ? err.message.slice(0, 500) : "Finance recovery failed", updated_at: new Date().toISOString() }).eq("id", intent.id)
        }
      }
      const retryTime = new Date().toISOString()
      const { data: event } = await supabase.from("central_billing_fulfillment_outbox").select("id,payload,attempts").eq("intent_id", intent.id).neq("status", "ACKNOWLEDGED").or(`retry_at.is.null,retry_at.lte.${retryTime}`).maybeSingle()
      const centralUrl = (process.env.CENTRAL_BILLING_CENTRAL_URL || "").startsWith("https://") ? process.env.CENTRAL_BILLING_CENTRAL_URL || "" : ""
      if (event && centralUrl) {
        const wire = JSON.stringify(event.payload), timestamp = Math.floor(Date.now() / 1000).toString()
        const response = await fetch(`${centralUrl.replace(/\/$/, "")}/messaging_api/fulfill_credit_purchase`, { method: "POST", headers: { "content-type": "application/json", "x-central-timestamp": timestamp, "x-central-signature": centralSignature(timestamp, wire, "/messaging_api/fulfill_credit_purchase") }, body: wire, cache: "no-store" }).catch(() => null)
        const attempts = Number(event.attempts || 0) + 1
        if (response?.ok) {
          await supabase.from("central_billing_fulfillment_outbox").update({ status: "ACKNOWLEDGED", acknowledged_at: new Date().toISOString(), attempts, retry_at: null, last_error: null }).eq("id", event.id)
          await supabase.from("central_billing_intents").update({ fulfillment_status: "ACKNOWLEDGED", updated_at: new Date().toISOString() }).eq("id", intent.id)
        } else {
          const delay = Math.min(3600, 30 * (2 ** Math.min(attempts, 7)))
          await supabase.from("central_billing_fulfillment_outbox").update({ status: "PENDING", attempts, retry_at: new Date(Date.now() + delay * 1000).toISOString(), last_error: "Central fulfilment endpoint is unavailable" }).eq("id", event.id)
          await supabase.from("central_billing_intents").update({ fulfillment_status: "FAILED", last_error: "Central fulfilment endpoint is unavailable", updated_at: new Date().toISOString() }).eq("id", intent.id)
        }
        fulfillmentRetried++
      }
    }
    return NextResponse.json({ success: true, paymentChecks, paymentsConfirmed, financeRetried, fulfillmentRetried })
  } catch (error) {
    console.error("[central billing recovery]", error)
    return NextResponse.json({ error: "Central billing recovery failed" }, { status: 503 })
  }
}
