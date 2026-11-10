import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCentralRequest } from "@/lib/central-billing-auth"

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", raw, request.headers.get("x-central-signature") || "", new URL(request.url).pathname)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured() || process.env.CENTRAL_BILLING_ENABLED !== "true") return NextResponse.json({ error: "Central billing is unavailable" }, { status: 503 })
  const paymentMode = process.env.CENTRAL_BILLING_TEST_MODE === "true" ? "test" : "live"
  const secret = paymentMode === "test" ? process.env.PAYSTACK_TEST_SECRET_KEY : process.env.PAYSTACK_SECRET_KEY
  if (!secret) return NextResponse.json({ error: "Central Paystack checkout is not configured" }, { status: 503 })
  if ((paymentMode === "test" && !secret.startsWith("sk_test_")) || (paymentMode === "live" && !secret.startsWith("sk_live_"))) return NextResponse.json({ error: `Central Paystack ${paymentMode} key is invalid` }, { status: 503 })
  try {
    const body = JSON.parse(raw) as { intent_id: string; provider_reference: string }
    if (!/^[0-9a-f-]{36}$/i.test(body.intent_id || "") || !/^MPMSG_[a-f0-9]{40}$/i.test(body.provider_reference || "")) return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 })
    const { data: intent } = await supabase.from("central_billing_intents").select("id,invoice_id,business_id,mapping_id,payment_status,provider_reference,checkout_url").eq("id", body.intent_id).maybeSingle()
    if (!intent || !intent.invoice_id) return NextResponse.json({ error: "Central invoice not found" }, { status: 404 })
    if (intent.payment_status !== "PENDING") return NextResponse.json({ error: "This purchase is no longer payable" }, { status: 409 })
    if (intent.provider_reference && intent.provider_reference !== body.provider_reference) return NextResponse.json({ error: "Payment reference conflict" }, { status: 409 })
    if (intent.checkout_url && intent.provider_reference === body.provider_reference) return NextResponse.json({ success: true, checkout_url: intent.checkout_url, reference: body.provider_reference })
    const { data: mapping } = await supabase.from("central_installation_mappings").select("install_url,fleet_install_id,store_id,status").eq("id", intent.mapping_id).eq("business_id", intent.business_id).maybeSingle()
    const { data: invoice } = await supabase.from("invoices").select("invoice_number,total_amount,currency,businesses:business_id(primary_email)").eq("id", intent.invoice_id).maybeSingle()
    if (!mapping || mapping.status !== "ACTIVE" || !invoice || invoice.currency !== "NGN") return NextResponse.json({ error: "Central billing records are not ready" }, { status: 409 })
    if (paymentMode === "test") {
      const allowedTestFleets = (process.env.CENTRAL_BILLING_TEST_FLEET_IDS || "").split(",").map((id) => id.trim()).filter(Boolean)
      if (!allowedTestFleets.includes(String(mapping.fleet_install_id))) return NextResponse.json({ error: "This fleet is not enabled for Central test payments" }, { status: 403 })
    }
    const business = Array.isArray(invoice.businesses) ? invoice.businesses[0] : invoice.businesses
    const email = String(business?.primary_email || "")
    if (!email) return NextResponse.json({ error: "A billing email is required" }, { status: 409 })
    const amount = Math.round(Number(invoice.total_amount) * 100)
    if (!Number.isSafeInteger(amount) || amount < 1) return NextResponse.json({ error: "Invoice amount is invalid" }, { status: 409 })
    const installUrl = String(mapping.install_url).replace(/\/$/, "")
    if (!/^https:\/\//.test(installUrl)) return NextResponse.json({ error: "Fleet return URL is not secure" }, { status: 409 })
    const callback = `${installUrl}/messaging_api/payment_return/paystack/${encodeURIComponent(body.provider_reference)}`
    const response = await fetch("https://api.paystack.co/transaction/initialize", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, amount, currency: "NGN", reference: body.provider_reference, callback_url: callback, metadata: { purpose: "central_messaging_purchase", intent_id: intent.id, invoice_id: intent.invoice_id, fleet_install_id: mapping.fleet_install_id, store_id: mapping.store_id } }), cache: "no-store" })
    const result = await response.json().catch(() => null) as { status?: boolean; message?: string; data?: { authorization_url?: string } } | null
    const checkoutUrl = result?.data?.authorization_url || ""
    if (!response.ok || !result?.status || !checkoutUrl.startsWith("https://")) return NextResponse.json({ error: "Paystack could not start Central checkout" }, { status: 502 })
    const { data: saved, error: saveError } = await supabase.from("central_billing_intents").update({ provider_reference: body.provider_reference, checkout_url: checkoutUrl, payment_mode: paymentMode, updated_at: new Date().toISOString() }).eq("id", intent.id).or(`provider_reference.is.null,provider_reference.eq.${body.provider_reference}`).select("id").maybeSingle()
    if (saveError) throw saveError
    if (!saved) return NextResponse.json({ error: "A different checkout is already linked to this purchase" }, { status: 409 })
    return NextResponse.json({ success: true, checkout_url: checkoutUrl, reference: body.provider_reference })
  } catch (error) {
    console.error("[central checkout initialize]", error)
    return NextResponse.json({ error: "Central checkout could not be created" }, { status: 503 })
  }
}
