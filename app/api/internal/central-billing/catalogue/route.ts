import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCentralRequest } from "@/lib/central-billing-auth"
import crypto from "crypto"

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", raw, request.headers.get("x-central-signature") || "", new URL(request.url).pathname)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Finance service unavailable" }, { status: 503 })
  try {
    const { data: control, error: controlError } = await supabase.from("central_billing_catalogue_control").select("price_owner").eq("id", 1).single()
    if (controlError) throw controlError
    if (control?.price_owner === "NEXT") return NextResponse.json({ error: "Next Admin owns this catalogue; Central cannot replace prices" }, { status: 409 })
    const body = JSON.parse(raw) as { source_version: string; confirm_replace?: boolean; products: Array<{ channel: string; product_code: string; price_per_credit_kobo: number; minimum_topup_kobo: number; tax_bps: number; bundles: unknown[]; enabled: boolean }>; addons?: Array<{ product_code: string; addon_key: string; name: string; fulfillment_type: "AUTOMATION_PLAN"; billing_period: "monthly" | "annual"; price_kobo: number; tax_bps: number; details: Record<string, unknown>; enabled: boolean }> }
    if (!body.source_version || !Array.isArray(body.products) || body.products.length !== 2) return NextResponse.json({ error: "Invalid catalogue snapshot" }, { status: 400 })
    for (const p of body.products) {
      if (!(["sms", "email"].includes(p.channel)) || !Number.isSafeInteger(p.price_per_credit_kobo) || p.price_per_credit_kobo <= 0 || !Number.isSafeInteger(p.minimum_topup_kobo) || !Number.isSafeInteger(p.tax_bps) || p.tax_bps < 0 || p.tax_bps > 10000 || !Array.isArray(p.bundles) || typeof p.enabled !== "boolean") return NextResponse.json({ error: "Invalid product snapshot" }, { status: 400 })
      const { enabled, ...productData } = p
      const hash = crypto.createHash("sha256").update(JSON.stringify({ ...p, source_version: body.source_version })).digest("hex")
      const { data: old, error: readError } = await supabase.from("central_credit_products").select("source_hash").eq("channel", p.channel).maybeSingle()
      if (readError) throw readError
      if (old && old.source_hash !== hash && !body.confirm_replace) return NextResponse.json({ error: `Catalogue changed for ${p.channel}; review it and explicitly confirm replacement` }, { status: 409 })
      if (!old) {
        const { error } = await supabase.from("central_credit_products").insert({ ...productData, active: enabled, bundles: p.bundles, source_version: body.source_version, source_hash: hash })
        if (error) throw error
      } else if (old.source_hash !== hash) {
        const { error } = await supabase.from("central_credit_products").update({ ...productData, active: enabled, bundles: p.bundles, source_version: body.source_version, source_hash: hash, imported_at: new Date().toISOString() }).eq("channel", p.channel)
        if (error) throw error
      }
    }
    for (const addon of body.addons || []) {
      if (!/^[a-z][a-z0-9_-]{1,79}$/.test(addon.product_code) || !/^[a-z][a-z0-9_]{1,39}$/.test(addon.addon_key) || !addon.name.trim() || addon.fulfillment_type !== "AUTOMATION_PLAN" || !["monthly", "annual"].includes(addon.billing_period) || !Number.isSafeInteger(addon.price_kobo) || addon.price_kobo < 0 || (addon.enabled && addon.price_kobo === 0) || !Number.isSafeInteger(addon.tax_bps) || addon.tax_bps < 0 || addon.tax_bps > 10000 || typeof addon.enabled !== "boolean" || !addon.details || typeof addon.details !== "object") return NextResponse.json({ error: "Invalid add-on catalogue snapshot" }, { status: 400 })
      const hash = crypto.createHash("sha256").update(JSON.stringify({ ...addon, source_version: body.source_version })).digest("hex")
      const { data: old, error: readError } = await supabase.from("central_addon_products").select("source_hash").eq("product_code", addon.product_code).maybeSingle()
      if (readError) throw readError
      if (old && old.source_hash !== hash && !body.confirm_replace) return NextResponse.json({ error: `Add-on changed for ${addon.product_code}; review it and explicitly confirm replacement` }, { status: 409 })
      const { enabled, ...productData } = addon
      if (!old) {
        const { error } = await supabase.from("central_addon_products").insert({ ...productData, active: enabled, source_version: body.source_version, source_hash: hash })
        if (error) throw error
      } else if (old.source_hash !== hash) {
        const { error } = await supabase.from("central_addon_products").update({ ...productData, active: enabled, source_version: body.source_version, source_hash: hash, imported_at: new Date().toISOString() }).eq("product_code", addon.product_code)
        if (error) throw error
      }
    }
    return NextResponse.json({ success: true, imported: true })
  } catch (error) {
    console.error("[central catalogue import]", error)
    return NextResponse.json({ error: "Catalogue import failed" }, { status: 503 })
  }
}
