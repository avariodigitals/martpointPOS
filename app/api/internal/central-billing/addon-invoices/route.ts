import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCentralRequest } from "@/lib/central-billing-auth"
import crypto from "crypto"

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", raw, request.headers.get("x-central-signature") || "", new URL(request.url).pathname)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured() || process.env.CENTRAL_BILLING_ENABLED !== "true") return NextResponse.json({ error: "Central billing service unavailable" }, { status: 503 })
  const { data: catalogueControl } = await supabase.from("central_billing_catalogue_control").select("price_owner,sync_status").eq("id", 1).maybeSingle()
  if (catalogueControl?.price_owner !== "NEXT" || catalogueControl.sync_status !== "SYNCED") return NextResponse.json({ error: "Next-owned Central catalogue is not synchronized" }, { status: 503 })
  try {
    const p = JSON.parse(raw) as { idempotency_key: string; fleet_install_id: number; store_id: number; install_url: string; product_code: string; amount_kobo: number; tax_kobo: number }
    if (!/^[a-zA-Z0-9:_-]{16,160}$/.test(p.idempotency_key) || !Number.isSafeInteger(p.fleet_install_id) || !Number.isSafeInteger(p.store_id) || !/^https:\/\//.test(p.install_url) || !/^automation-[a-z][a-z0-9_]{1,39}-(monthly|annual)$/.test(p.product_code) || !Number.isSafeInteger(p.amount_kobo) || !Number.isSafeInteger(p.tax_kobo)) return NextResponse.json({ error: "Invalid add-on invoice request" }, { status: 400 })
    const { data: product, error: productError } = await supabase.from("central_addon_products").select("*").eq("product_code", p.product_code).eq("active", true).maybeSingle()
    if (productError || !product || product.fulfillment_type !== "AUTOMATION_PLAN") return NextResponse.json({ error: "Imported paid add-on is unavailable" }, { status: 409 })
    if (p.amount_kobo - p.tax_kobo !== Number(product.price_kobo) || Math.round(Number(product.price_kobo) * Number(product.tax_bps) / 10000) !== p.tax_kobo) return NextResponse.json({ error: "Add-on price or tax does not match the imported catalogue" }, { status: 409 })
    const hash = crypto.createHash("sha256").update(JSON.stringify(p)).digest("hex")
    const { data, error } = await supabase.rpc("central_create_addon_invoice", { p_idempotency_key: p.idempotency_key, p_payload_hash: hash, p_fleet_install_id: p.fleet_install_id, p_store_id: p.store_id, p_install_url: p.install_url, p_product_code: p.product_code, p_amount_kobo: p.amount_kobo, p_tax_kobo: p.tax_kobo })
    if (error) throw error
    const invoice = Array.isArray(data) ? data[0] : data
    return NextResponse.json({ success: true, ...invoice, product_type: "ADDON", product_code: p.product_code, tax_bps: product.tax_bps, name: product.name, details: product.details })
  } catch (error) {
    console.error("[central add-on invoice create]", error)
    return NextResponse.json({ error: "Add-on invoice could not be created or verified" }, { status: 409 })
  }
}
