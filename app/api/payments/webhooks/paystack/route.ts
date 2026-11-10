import { NextResponse } from "next/server"
import { processPaystackWebhook } from "@/lib/payment-gateways"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { centralSignature } from "@/lib/central-billing-auth"

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get("x-paystack-signature") || ""
    const result = await processPaystackWebhook(body, signature)
    if (!result.success) return NextResponse.json(result, { status: 400 })
    const event = JSON.parse(body) as { event?: string; data?: { reference?: string; subaccount_code?: string; subaccount?: { subaccount_code?: string }; split?: { formula?: { subaccounts?: { subaccount_code?: string }[] } } } }
    const reference = String(event.data?.reference || "")
    if (event.event === "charge.success" && reference && isSupabaseConfigured()) {
      const origin = new URL(request.url).origin
      const { data: intent } = await supabase.from("central_billing_intents").select("id").eq("provider_reference", reference).maybeSingle()
      if (intent) {
        const path = "/api/internal/central-billing/payments/verify"
        const wire = JSON.stringify({ intent_id: intent.id, provider_reference: reference })
        const timestamp = Math.floor(Date.now() / 1000).toString()
        const settled = await fetch(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-central-timestamp": timestamp, "x-central-signature": centralSignature(timestamp, wire, path) }, body: wire, cache: "no-store" })
        if (!settled.ok) return NextResponse.json({ success: false, message: "Central purchase verification will retry" }, { status: 503 })
      } else {
        const { data: payment } = await supabase.from("payments").select("invoice_id").eq("gateway_reference", reference).maybeSingle()
        if (payment?.invoice_id) {
          const path = `/api/public/invoices/${encodeURIComponent(payment.invoice_id)}/verify`
          const settled = await fetch(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }), cache: "no-store" })
          if (!settled.ok) return NextResponse.json({ success: false, message: "Invoice payment verification will retry" }, { status: 503 })
        }
      }
      const subaccountCodes = [...new Set([
        event.data?.subaccount?.subaccount_code,
        event.data?.subaccount_code,
        ...(event.data?.split?.formula?.subaccounts || []).map((subaccount) => subaccount.subaccount_code),
      ].filter((code): code is string => !!code && /^ACCT_[A-Za-z0-9]+$/.test(code)))]
      if (subaccountCodes.length) {
        const { data: routes, error } = await supabase.from("central_installation_mappings").select("install_url,paystack_subaccount_code").in("paystack_subaccount_code", subaccountCodes).eq("paystack_subaccount_enabled", true).eq("status", "ACTIVE")
        if (error || !routes?.length) return NextResponse.json({ success: false, message: "Merchant payout webhook route is not registered" }, { status: 503 })
        for (const route of routes) {
          const installUrl = String(route.install_url || "").replace(/\/$/, "")
          if (!/^https:\/\//.test(installUrl)) return NextResponse.json({ success: false, message: "Merchant webhook destination is invalid" }, { status: 503 })
          const forwarded = await fetch(`${installUrl}/paystack/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-paystack-signature": signature }, body, cache: "no-store", signal: AbortSignal.timeout(12000) }).catch(() => null)
          if (!forwarded?.ok) return NextResponse.json({ success: false, message: "Merchant payment webhook forwarding will retry" }, { status: 503 })
        }
      }
    }
    return NextResponse.json(result, { status: 200 })
  } catch (e) {
    console.error("[paystack webhook]", e)
    return NextResponse.json({ success: false, message: "Webhook processing failed" }, { status: 500 })
  }
}
