import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCentralRequest } from "@/lib/central-billing-auth"
import crypto from "crypto"

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", raw, request.headers.get("x-central-signature") || "", new URL(request.url).pathname)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Finance service unavailable" }, { status: 503 })
  if (process.env.CENTRAL_BILLING_ENABLED !== "true") return NextResponse.json({ error: "Central credit billing is disabled" }, { status: 503 })
  const { data: catalogueControl } = await supabase.from("central_billing_catalogue_control").select("price_owner,sync_status").eq("id", 1).maybeSingle()
  if (catalogueControl?.price_owner !== "NEXT" || catalogueControl.sync_status !== "SYNCED") return NextResponse.json({ error: "Next-owned Central catalogue is not synchronized" }, { status: 503 })
  try {
    const p = JSON.parse(raw) as { idempotency_key: string; fleet_install_id: number; store_id: number; install_url: string; channel: "sms" | "email"; credit_units: number; amount_kobo: number; tax_kobo: number; package_id?: number }
    if (!/^[a-zA-Z0-9:_-]{16,160}$/.test(p.idempotency_key) || !Number.isSafeInteger(p.fleet_install_id) || !Number.isSafeInteger(p.store_id) || !/^https:\/\//.test(p.install_url) || !["sms", "email"].includes(p.channel) || !Number.isSafeInteger(p.credit_units) || p.credit_units < 1 || !Number.isSafeInteger(p.amount_kobo) || !Number.isSafeInteger(p.tax_kobo)) return NextResponse.json({ error: "Invalid invoice request" }, { status: 400 })
    const payloadHash = crypto.createHash("sha256").update(JSON.stringify(p)).digest("hex")
    const { data: product, error: productError } = await supabase.from("central_credit_products").select("*").eq("channel", p.channel).eq("active", true).maybeSingle()
    if (productError || !product) return NextResponse.json({ error: "Imported Central catalogue is not available" }, { status: 409 })
    const netKobo = p.amount_kobo - p.tax_kobo
    if (Math.round(netKobo * Number(product.tax_bps) / 10000) !== p.tax_kobo) return NextResponse.json({ error: "Tax snapshot does not match imported Central settings" }, { status: 409 })
    if (p.package_id) {
      const bundle = (product.bundles as Array<{ id: number; amount_kobo: number; credit_units: number; enabled?: boolean }>).find((b) => Number(b.id) === p.package_id && b.enabled !== false)
      if (!bundle || Number(bundle.amount_kobo) !== netKobo || Number(bundle.credit_units) !== p.credit_units) return NextResponse.json({ error: "Bundle does not match imported Central catalogue" }, { status: 409 })
    } else if (p.credit_units !== Math.floor(netKobo / Number(product.price_per_credit_kobo)) || netKobo < Number(product.minimum_topup_kobo)) {
      return NextResponse.json({ error: "Credit price or minimum does not match imported Central catalogue" }, { status: 409 })
    }
    const { data, error } = await supabase.rpc("central_create_credit_invoice", {
      p_idempotency_key: p.idempotency_key, p_payload_hash: payloadHash,
      p_fleet_install_id: p.fleet_install_id, p_store_id: p.store_id,
      p_install_url: p.install_url, p_channel: p.channel, p_credit_units: p.credit_units,
      p_package_id: p.package_id || 0, p_amount_kobo: p.amount_kobo, p_tax_kobo: p.tax_kobo,
    })
    if (error) throw error
    const invoice = Array.isArray(data) ? data[0] : data
    return NextResponse.json({ success: true, ...invoice })
  } catch (error) {
    console.error("[central invoice create]", error)
    return NextResponse.json({ error: "Invoice could not be created or verified" }, { status: 409 })
  }
}
