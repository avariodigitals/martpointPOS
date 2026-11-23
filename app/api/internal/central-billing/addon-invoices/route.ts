import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCentralRequest } from "@/lib/central-billing-auth"
import { normalizeCentralInstallUrl } from "@/lib/central-billing-installation"
import crypto from "crypto"
import { isAiAdsOffer } from "@/lib/ai-ads-entitlements"

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", raw, request.headers.get("x-central-signature") || "", new URL(request.url).pathname)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured() || process.env.CENTRAL_BILLING_ENABLED !== "true") return NextResponse.json({ error: "Central billing service unavailable" }, { status: 503 })
  const { data: catalogueControl } = await supabase.from("central_billing_catalogue_control").select("price_owner,sync_status").eq("id", 1).maybeSingle()
  if (catalogueControl?.price_owner !== "NEXT" || catalogueControl.sync_status !== "SYNCED") return NextResponse.json({ error: "Next-owned Central catalogue is not synchronized" }, { status: 503 })
  try {
    const p = JSON.parse(raw) as { idempotency_key: string; fleet_install_id: number; store_id: number; install_url: string; product_code: string; amount_kobo?: number; tax_kobo?: number }
    const requestInstallUrl = normalizeCentralInstallUrl(p.install_url)
    const aiAdsCode = /^ai-ads-(?:[a-z][a-z0-9_]{1,31}-)?(?:monthly|annual)$/.test(p.product_code)
    if (!/^[a-zA-Z0-9:_-]{16,160}$/.test(p.idempotency_key) || !Number.isSafeInteger(p.fleet_install_id) || p.fleet_install_id < 1 || !Number.isSafeInteger(p.store_id) || p.store_id < 1 || !requestInstallUrl || !(/^(automation-[a-z][a-z0-9_]{1,39}|ai-ads(?:-[a-z][a-z0-9_]{1,31})?)-(monthly|annual)$/.test(p.product_code)) || (!aiAdsCode && (!Number.isSafeInteger(p.amount_kobo) || Number(p.amount_kobo) < 1 || !Number.isSafeInteger(p.tax_kobo) || Number(p.tax_kobo) < 0))) return NextResponse.json({ error: "Invalid add-on invoice request" }, { status: 400 })
    const { data: mapping, error: mappingError } = await supabase.from("central_installation_mappings").select("install_url").eq("fleet_install_id", p.fleet_install_id).eq("store_id", p.store_id).eq("status", "ACTIVE").maybeSingle()
    if (mappingError) {
      console.error("[central add-on invoice mapping lookup]", mappingError)
      return NextResponse.json({ error: "Installation mapping could not be checked" }, { status: 503 })
    }
    if (!mapping || normalizeCentralInstallUrl(mapping.install_url) !== requestInstallUrl) return NextResponse.json({ error: "Active installation mapping not found for this fleet, store and URL" }, { status: 404 })
    p.install_url = mapping.install_url
    const { data: product, error: productError } = await supabase.from("central_addon_products").select("*").eq("product_code", p.product_code).eq("active", true).maybeSingle()
    if (productError || !product || !["AUTOMATION_PLAN", "AI_ADS_SUBSCRIPTION"].includes(product.fulfillment_type) || (product.fulfillment_type === "AI_ADS_SUBSCRIPTION" && !isAiAdsOffer(product.addon_key, p.product_code, product.billing_period))) return NextResponse.json({ error: "Imported paid add-on is unavailable" }, { status: 409 })
    const amountKobo = aiAdsCode ? Number(product.price_kobo) + Math.round(Number(product.price_kobo) * Number(product.tax_bps) / 10000) : Number(p.amount_kobo)
    const taxKobo = aiAdsCode ? Math.round(Number(product.price_kobo) * Number(product.tax_bps) / 10000) : Number(p.tax_kobo)
    if (aiAdsCode && amountKobo < 5000) return NextResponse.json({ error: "AI Ads invoice total is below Paystack's ₦50 NGN minimum" }, { status: 409 })
    if (amountKobo - taxKobo !== Number(product.price_kobo) || Math.round(Number(product.price_kobo) * Number(product.tax_bps) / 10000) !== taxKobo) return NextResponse.json({ error: "Add-on price or tax does not match the imported catalogue" }, { status: 409 })
    const hash = crypto.createHash("sha256").update(JSON.stringify(p)).digest("hex")
    const { data, error } = await supabase.rpc("central_create_addon_invoice", { p_idempotency_key: p.idempotency_key, p_payload_hash: hash, p_fleet_install_id: p.fleet_install_id, p_store_id: p.store_id, p_install_url: p.install_url, p_product_code: p.product_code, p_amount_kobo: amountKobo, p_tax_kobo: taxKobo })
    if (error) throw error
    const invoice = Array.isArray(data) ? data[0] : data
    return NextResponse.json({ success: true, ...invoice, product_type: "ADDON", fulfillment_type: product.fulfillment_type, addon_key: product.addon_key, billing_period: product.billing_period, product_code: p.product_code, tax_bps: product.tax_bps, name: product.name, details: product.details })
  } catch (error) {
    const diagnosticId = crypto.randomUUID()
    const record = error && typeof error === "object" ? error as Record<string, unknown> : {}
    const code = typeof record.code === "string" ? record.code.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) : ""
    const message = error instanceof Error ? error.message : typeof record.message === "string" ? record.message : "Unknown invoice database error"
    const safeMessage = message.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").slice(0, 240)
    console.error(`[central add-on invoice create:${diagnosticId}]`, { code, message: safeMessage })
    // This is a signed Central-to-Next endpoint. Include the database diagnostic
    // so Central's server log identifies the real failure; Fleet UI still gets
    // only its generic no-payment-taken message.
    return NextResponse.json({ error: `Add-on invoice failed${code ? ` (${code})` : ""}: ${safeMessage}`, diagnostic_id: diagnosticId }, { status: 500 })
  }
}
