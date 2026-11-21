import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCentralRequest } from "@/lib/central-billing-auth"
import { loadPaystackConfiguration } from "@/lib/paystack-settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const raw = await request.text()
  const path = new URL(request.url).pathname
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", raw, request.headers.get("x-central-signature") || "", path)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let paystackReady = false
  try {
    const settings = await loadPaystackConfiguration()
    paystackReady = !!(settings.activeMode === "test" ? settings.testSecret?.startsWith("sk_test_") : settings.liveSecret?.startsWith("sk_live_"))
  } catch { paystackReady = false }
  const { data: control, error: controlError } = await supabase.from("central_billing_catalogue_control").select("price_owner,sync_status").eq("id", 1).maybeSingle()
  const { data: ads, error: adsError } = await supabase.from("central_addon_products").select("product_code,active,price_kobo").eq("fulfillment_type", "AI_ADS_SUBSCRIPTION")
  const products = ads || []
  const catalogueReady = !controlError && control?.price_owner === "NEXT" && control.sync_status === "SYNCED"
  const monthlyReady = products.some((p) => p.product_code === "ai-ads-monthly" && p.active && Number(p.price_kobo) > 0)
  const annualReady = products.some((p) => p.product_code === "ai-ads-annual" && p.active && Number(p.price_kobo) > 0)
  return NextResponse.json({ success: true, supabase_ready: isSupabaseConfigured() && !adsError, central_billing_enabled: process.env.CENTRAL_BILLING_ENABLED === "true", catalogue_ready: catalogueReady, ai_ads_monthly_ready: monthlyReady, ai_ads_annual_ready: annualReady, paystack_ready: paystackReady }, { headers: { "cache-control": "no-store" } })
}
