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

async function rendererStatus() {
  const ffmpeg = ffmpegStaticPath || process.env.AI_ADS_FFMPEG_PATH || "ffmpeg"
  const font = path.join(process.cwd(), "assets/ai-ads/fonts/Roboto.ttf")
  try { await access(font) }
  catch { return { ready: false, reason: "Overlay font is missing from the deployed Next app." } }
  try {
    await runFile(ffmpeg, ["-version"], { timeout: 3000, maxBuffer: 4096 })
    return { ready: true, reason: "FFmpeg and the overlay font are available." }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      if (ffmpeg === "ffmpeg") return { ready: false, reason: "No FFmpeg binary is bundled and no system FFmpeg is installed." }
      return { ready: false, reason: "The bundled FFmpeg binary is missing from the deployed Next app." }
    }
    return { ready: false, reason: "The FFmpeg binary is present but could not start in this deployment." }
  }
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
  const [imageProvider, videoProvider, renderer] = await Promise.all([getAiProviderCredentials("openai"), getAiProviderCredentials("gemini"), rendererStatus()])
  const aiAdsImageProviderReady = !!imageProvider
  const aiAdsVideoProviderReady = !!videoProvider
  const creativeProvidersReady = aiAdsImageProviderReady && aiAdsVideoProviderReady && renderer.ready
  // This release switch is deliberately separate from key presence: platform
  // operations enable it only after the deployed generation paths are proven.
  const creativeReleaseEnabled = process.env.AI_ADS_CREATIVE_ENABLED === "true"
  const checkoutReady = isSupabaseConfigured() && !adsError && process.env.CENTRAL_BILLING_ENABLED === "true" && catalogueReady && paystackReady && creativeProvidersReady && creativeReleaseEnabled
  const offerEntries = products.map((product) => {
    const productCode = String(product.product_code || "")
    const match = /^ai-ads(?:-[a-z][a-z0-9_]{1,31})?-(monthly|annual)$/.exec(productCode)
    if (!match) return [productCode, { enabled: false, catalogue_active: !!product?.active, blockers: ["Unsupported AI Ads offer code"], product_code: productCode, plan_code: "", plan_name: "", billing_period: "", total_kobo: 0, tax_included: false, entitlements: normalizeAiAdsEntitlements(undefined) }] as const
    const period = match[1] as "monthly" | "annual"
    const netKobo = Math.max(0, Math.round(Number(product?.price_kobo || 0)))
    const taxBps = Math.max(0, Math.round(Number(product?.tax_bps || 0)))
    const taxKobo = Math.round(netKobo * taxBps / 10000)
    const totalKobo = netKobo + taxKobo
    const blockers: string[] = []
    if (!isSupabaseConfigured() || !!adsError) blockers.push("Next billing database unavailable")
    if (process.env.CENTRAL_BILLING_ENABLED !== "true") blockers.push("Central billing is turned off")
    if (!catalogueReady) blockers.push("Catalogue is not synchronized")
    if (!paystackReady) blockers.push("Paystack is not ready")
    if (!aiAdsImageProviderReady) blockers.push("OpenAI image provider is not configured")
    if (!aiAdsVideoProviderReady) blockers.push("Gemini video provider is not configured")
    if (!renderer.ready) blockers.push(renderer.reason)
    if (!creativeReleaseEnabled) blockers.push("Creative features are not released")
    if (!product?.active) blockers.push("Plan is disabled in the Next catalogue")
    if (totalKobo < 5000) blockers.push("Plan price is below the minimum")
    const enabled = checkoutReady && blockers.length === 0
    const details = product?.details && typeof product.details === "object" ? product.details as Record<string, unknown> : {}
    return [productCode, { enabled, catalogue_active: !!product?.active, blockers, product_code: productCode, plan_code: String(product?.addon_key || ""), plan_name: String(product?.name || "AI Ads"), billing_period: period, total_kobo: totalKobo, tax_included: taxKobo > 0, entitlements: normalizeAiAdsEntitlements(details.entitlements) }] as const
  })
  const offers = Object.fromEntries(offerEntries) as Record<string, { enabled: boolean; catalogue_active: boolean; blockers: string[]; product_code: string; plan_code: string; plan_name: string; billing_period: string; total_kobo: number; tax_included: boolean; entitlements: ReturnType<typeof normalizeAiAdsEntitlements> }>
  const monthlyReady = Object.values(offers).some((offer) => offer.enabled && offer.billing_period === "monthly")
  const annualReady = Object.values(offers).some((offer) => offer.enabled && offer.billing_period === "annual")
  return NextResponse.json({ success: true, supabase_ready: isSupabaseConfigured() && !adsError, central_billing_enabled: process.env.CENTRAL_BILLING_ENABLED === "true", catalogue_ready: catalogueReady, ai_ads_monthly_ready: monthlyReady, ai_ads_annual_ready: annualReady, paystack_ready: paystackReady, ai_ads_image_provider_ready: aiAdsImageProviderReady, ai_ads_video_provider_ready: aiAdsVideoProviderReady, ai_ads_renderer_ready: renderer.ready, ai_ads_renderer_reason: renderer.reason, ai_ads_creative_ready: creativeProvidersReady, ai_ads_creative_release_enabled: creativeReleaseEnabled, ai_ads_offers: offers }, { headers: { "cache-control": "no-store" } })
}
