import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCentralRequest } from "@/lib/central-billing-auth"
import { loadPaystackConfiguration } from "@/lib/paystack-settings"
import { normalizeAiAdsEntitlements } from "@/lib/ai-ads-entitlements"
import { getAiProviderCredentials } from "@/lib/ai-chat"
import { access } from "node:fs/promises"
import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import ffmpegStaticPath from "ffmpeg-static"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const runFile = promisify(execFile)

async function rendererReady() {
  const ffmpeg = ffmpegStaticPath || process.env.AI_ADS_FFMPEG_PATH || "ffmpeg"
  const font = path.join(process.cwd(), "assets/ai-ads/fonts/Roboto.ttf")
  try {
    await Promise.all([runFile(ffmpeg, ["-version"], { timeout: 3000, maxBuffer: 4096 }), access(font)])
    return true
  } catch { return false }
}

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
  const { data: ads, error: adsError } = await supabase.from("central_addon_products").select("product_code,addon_key,name,active,price_kobo,tax_bps,details").eq("fulfillment_type", "AI_ADS_SUBSCRIPTION")
  const products = ads || []
  const catalogueReady = !controlError && control?.price_owner === "NEXT" && control.sync_status === "SYNCED"
  const [imageProvider, videoProvider, renderer] = await Promise.all([getAiProviderCredentials("openai"), getAiProviderCredentials("gemini"), rendererReady()])
  const aiAdsImageProviderReady = !!imageProvider
  const aiAdsVideoProviderReady = !!videoProvider
  const creativeProvidersReady = aiAdsImageProviderReady && aiAdsVideoProviderReady && renderer
  // This release switch is deliberately separate from key presence: platform
  // operations enable it only after the deployed generation paths are proven.
  const creativeReleaseEnabled = process.env.AI_ADS_CREATIVE_ENABLED === "true"
  const checkoutReady = isSupabaseConfigured() && !adsError && process.env.CENTRAL_BILLING_ENABLED === "true" && catalogueReady && paystackReady && creativeProvidersReady && creativeReleaseEnabled
  const offerEntries = products.map((product) => {
    const productCode = String(product.product_code || "")
    const match = /^ai-ads(?:-[a-z][a-z0-9_]{1,31})?-(monthly|annual)$/.exec(productCode)
    if (!match) return [productCode, { enabled: false, product_code: productCode, plan_code: "", plan_name: "", billing_period: "", total_kobo: 0, tax_included: false, entitlements: normalizeAiAdsEntitlements(undefined) }] as const
    const period = match[1] as "monthly" | "annual"
    const netKobo = Math.max(0, Math.round(Number(product?.price_kobo || 0)))
    const taxBps = Math.max(0, Math.round(Number(product?.tax_bps || 0)))
    const taxKobo = Math.round(netKobo * taxBps / 10000)
    const totalKobo = netKobo + taxKobo
    const enabled = checkoutReady && !!product?.active && totalKobo >= 5000
    const details = product?.details && typeof product.details === "object" ? product.details as Record<string, unknown> : {}
    return [productCode, { enabled, product_code: productCode, plan_code: String(product?.addon_key || ""), plan_name: String(product?.name || "AI Ads"), billing_period: period, total_kobo: totalKobo, tax_included: taxKobo > 0, entitlements: normalizeAiAdsEntitlements(details.entitlements) }] as const
  })
  const offers = Object.fromEntries(offerEntries) as Record<string, { enabled: boolean; product_code: string; plan_code: string; plan_name: string; billing_period: string; total_kobo: number; tax_included: boolean; entitlements: ReturnType<typeof normalizeAiAdsEntitlements> }>
  const monthlyReady = Object.values(offers).some((offer) => offer.enabled && offer.billing_period === "monthly")
  const annualReady = Object.values(offers).some((offer) => offer.enabled && offer.billing_period === "annual")
  return NextResponse.json({ success: true, supabase_ready: isSupabaseConfigured() && !adsError, central_billing_enabled: process.env.CENTRAL_BILLING_ENABLED === "true", catalogue_ready: catalogueReady, ai_ads_monthly_ready: monthlyReady, ai_ads_annual_ready: annualReady, paystack_ready: paystackReady, ai_ads_image_provider_ready: aiAdsImageProviderReady, ai_ads_video_provider_ready: aiAdsVideoProviderReady, ai_ads_renderer_ready: renderer, ai_ads_creative_ready: creativeProvidersReady, ai_ads_creative_release_enabled: creativeReleaseEnabled, ai_ads_offers: offers }, { headers: { "cache-control": "no-store" } })
}
