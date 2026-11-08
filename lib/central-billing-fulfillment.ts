import crypto from "crypto"
import { supabase } from "@/lib/supabase"

/** Create one durable unit-credit event for any existing Admin payment-confirmation path. */
export async function queueCentralCreditFulfillment(intentId: string) {
  const { data: intent, error } = await supabase.from("central_billing_intents").select("*").eq("id", intentId).single()
  if (error || !intent || !intent.invoice_id || !intent.invoice_item_id) throw new Error("Central credit purchase intent is incomplete")
  const { data: invoice } = await supabase.from("invoices").select("total_amount").eq("id", intent.invoice_id).single()
  if (!invoice) throw new Error("Central credit invoice is unavailable")
  const payload = { event_id: crypto.randomUUID(), intent_id: intent.id, invoice_id: intent.invoice_id, invoice_item_id: intent.invoice_item_id, business_id: intent.business_id, fleet_install_id: intent.fleet_install_id, store_id: intent.store_id, product_type: intent.product_type || "CREDIT", ...(intent.product_type === "ADDON" ? { fulfillment_type: "AUTOMATION_PLAN", addon_key: intent.addon_key, billing_period: intent.billing_period, product_details: intent.product_details } : { channel: intent.channel, credit_units: intent.credit_units }), amount: Number(invoice.total_amount) }
  const { error: outboxError } = await supabase.from("central_billing_fulfillment_outbox").upsert({ intent_id: intent.id, payload, status: "PENDING", retry_at: new Date().toISOString() }, { onConflict: "intent_id", ignoreDuplicates: true })
  if (outboxError) throw outboxError
  const { data: outbox } = await supabase.from("central_billing_fulfillment_outbox").select("status").eq("intent_id", intent.id).single()
  await supabase.from("central_billing_intents").update({ payment_status: "CONFIRMED", allocation_status: "ALLOCATED", fulfillment_status: outbox?.status === "ACKNOWLEDGED" ? "ACKNOWLEDGED" : "PENDING", updated_at: new Date().toISOString() }).eq("id", intent.id)
}
