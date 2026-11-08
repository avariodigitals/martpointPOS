import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { centralSignature } from "@/lib/central-billing-auth"
import crypto from "crypto"

type CreditProduct = { channel: "sms" | "email"; product_code: string; price_per_credit_kobo: number; minimum_topup_kobo: number; tax_bps: number; bundles: Array<{ id: number; name: string; amount_kobo: number; credit_units: number; enabled: boolean }>; enabled: boolean }
type AddonProduct = { product_code: string; addon_key: string; name: string; fulfillment_type: "AUTOMATION_PLAN"; billing_period: "monthly" | "annual"; price_kobo: number; tax_bps: number; details: Record<string, unknown>; enabled: boolean }

const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status })

async function currentCatalogue() {
  const [credits, addons, control] = await Promise.all([
    supabase.from("central_credit_products").select("*").order("channel"),
    supabase.from("central_addon_products").select("*").order("addon_key").order("billing_period"),
    supabase.from("central_billing_catalogue_control").select("*").eq("id", 1).single(),
  ])
  if (credits.error || addons.error || control.error) throw new Error("Central billing catalogue is unavailable")
  return { products: credits.data || [], addons: addons.data || [], control: control.data }
}

function validateCatalogue(products: CreditProduct[], addons: AddonProduct[]) {
  if (!Array.isArray(products) || products.length !== 2 || !Array.isArray(addons)) return "Provide both credit products and the supported Automation products."
  const channels = new Set<string>()
  let tax: number | null = null
  for (const p of products) {
    if (!(["sms", "email"] as string[]).includes(p.channel) || channels.has(p.channel) || p.product_code !== `martpoint-${p.channel}-credit` || !Number.isSafeInteger(p.price_per_credit_kobo) || p.price_per_credit_kobo < 1 || p.price_per_credit_kobo > 10000000 || !Number.isSafeInteger(p.minimum_topup_kobo) || p.minimum_topup_kobo < 500000 || p.minimum_topup_kobo > 50000000 || !Number.isSafeInteger(p.tax_bps) || p.tax_bps < 0 || p.tax_bps > 10000 || typeof p.enabled !== "boolean" || !Array.isArray(p.bundles)) return "Credit product values are invalid."
    channels.add(p.channel)
    if (tax !== null && tax !== p.tax_bps) return "Central currently has one tax rate for all credit and Automation products."
    tax = p.tax_bps
    const bundleIds = new Set<number>()
    for (const b of p.bundles) {
      if (!Number.isSafeInteger(b.id) || b.id < 1 || bundleIds.has(b.id) || !b.name.trim() || !Number.isSafeInteger(b.amount_kobo) || b.amount_kobo < 10000 || b.amount_kobo > 50000000 || !Number.isSafeInteger(b.credit_units) || b.credit_units < 1 || b.credit_units > 10000000 || typeof b.enabled !== "boolean") return "A credit bundle is invalid."
      bundleIds.add(b.id)
    }
  }
  const addonKeys = new Set<string>()
  for (const p of addons) {
    const key = `${p.addon_key}:${p.billing_period}`
    if (!/^automation-[a-z][a-z0-9_]{1,39}-(monthly|annual)$/.test(p.product_code) || p.product_code !== `automation-${p.addon_key}-${p.billing_period}` || addonKeys.has(key) || !/^[a-z][a-z0-9_]{1,39}$/.test(p.addon_key) || !["monthly", "annual"].includes(p.billing_period) || p.fulfillment_type !== "AUTOMATION_PLAN" || !p.name.trim() || !Number.isSafeInteger(p.price_kobo) || p.price_kobo < 0 || p.price_kobo > 50000000 || (p.enabled && (p.price_kobo === 0 || p.price_kobo + Math.round(p.price_kobo * p.tax_bps / 10000) > 50000000)) || p.tax_bps !== tax || typeof p.enabled !== "boolean" || !p.details || typeof p.details !== "object") return "An Automation product is invalid."
    addonKeys.add(key)
  }
  return null
}

async function publishCatalogue(sourceVersion: string) {
  const centralUrl = process.env.CENTRAL_BILLING_CENTRAL_URL || ""
  if (!centralUrl.startsWith("https://")) throw new Error("Central HTTPS endpoint is not configured")
  const snapshot = await currentCatalogue()
  const products: CreditProduct[] = snapshot.products.map((p) => ({ channel: p.channel, product_code: p.product_code, price_per_credit_kobo: Number(p.price_per_credit_kobo), minimum_topup_kobo: Number(p.minimum_topup_kobo), tax_bps: Number(p.tax_bps), bundles: p.bundles, enabled: !!p.active }))
  const addons: AddonProduct[] = snapshot.addons.map((p) => ({ product_code: p.product_code, addon_key: p.addon_key, name: p.name, fulfillment_type: p.fulfillment_type, billing_period: p.billing_period, price_kobo: Number(p.price_kobo), tax_bps: Number(p.tax_bps), details: p.details || {}, enabled: !!p.active }))
  const invalid = validateCatalogue(products, addons)
  if (invalid) throw new Error(invalid)
  const body = JSON.stringify({ source_version: sourceVersion, products, addons })
  const path = "/messaging_api/sync_billing_catalogue"
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const response = await fetch(`${centralUrl.replace(/\/$/, "")}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-central-timestamp": timestamp, "x-central-signature": centralSignature(timestamp, body, path) }, body, cache: "no-store", signal: AbortSignal.timeout(20000) })
  const result = await response.json().catch(() => null) as { success?: boolean; source_hash?: string; message?: string; reference?: string } | null
  if (!response.ok) throw new Error(`Central returned HTTP ${response.status}: ${result?.message || "Catalogue synchronization was not confirmed."}${result?.reference ? ` (reference ${result.reference})` : ""}`)
  if (!result?.success) throw new Error(result?.message || "Central catalogue synchronization was not confirmed")
  return result.source_hash || crypto.createHash("sha256").update(body).digest("hex")
}

export async function GET() {
  const auth = await authorizeAdmin("finance", "view")
  if (auth.denied) return auth.denied
  try { return NextResponse.json({ success: true, ...(await currentCatalogue()) }) }
  catch (error) { return fail(error instanceof Error ? error.message : "Catalogue load failed", 503) }
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin("finance", "manage")
  if (auth.denied) return auth.denied
  let sourceVersion = ""
  try {
    const body = await request.json() as { action: "take_ownership" | "save" | "publish"; products?: CreditProduct[]; addons?: AddonProduct[] }
    const snapshot = await currentCatalogue()
    if (body.action === "take_ownership") {
      if (snapshot.products.length !== 2) return fail("Import the current Central catalogue before taking ownership", 409)
      const { error } = await supabase.from("central_billing_catalogue_control").update({ price_owner: "NEXT", sync_status: "PENDING", updated_at: new Date().toISOString() }).eq("id", 1)
      if (error) throw error
    } else if (body.action === "save") {
      if (snapshot.control.price_owner !== "NEXT") return fail("Next Admin must take catalogue ownership before editing prices", 409)
      const invalid = validateCatalogue(body.products || [], body.addons || [])
      if (invalid) return fail(invalid)
      const now = new Date().toISOString()
      sourceVersion = `next-${Date.now()}`
      const oldSnapshot = { products: snapshot.products, addons: snapshot.addons }
      for (const p of body.products || []) {
        const row = { channel: p.channel, product_code: p.product_code, price_per_credit_kobo: p.price_per_credit_kobo, minimum_topup_kobo: p.minimum_topup_kobo, tax_bps: p.tax_bps, bundles: p.bundles, source_version: sourceVersion, active: p.enabled, source_hash: crypto.createHash("sha256").update(JSON.stringify(p)).digest("hex"), imported_at: now }
        const { error } = await supabase.from("central_credit_products").upsert(row, { onConflict: "channel" })
        if (error) throw error
      }
      for (const p of body.addons || []) {
        const row = { ...p, source_version: sourceVersion, active: p.enabled, source_hash: crypto.createHash("sha256").update(JSON.stringify(p)).digest("hex"), imported_at: now }
        delete (row as Partial<AddonProduct>).enabled
        const { error } = await supabase.from("central_addon_products").upsert(row, { onConflict: "product_code" })
        if (error) throw error
      }
      const after = await currentCatalogue()
      const sourceHash = crypto.createHash("sha256").update(JSON.stringify({ products: after.products, addons: after.addons })).digest("hex")
      const { error: auditInsertError } = await supabase.from("central_billing_catalogue_audit").insert({ actor_user_id: auth.session?.userId || null, source_version: sourceVersion, source_hash: sourceHash, before_snapshot: oldSnapshot, after_snapshot: { products: after.products, addons: after.addons }, central_sync_status: "PENDING" })
      if (auditInsertError) throw auditInsertError
      const { error: pendingError } = await supabase.from("central_billing_catalogue_control").update({ source_version: sourceVersion, source_hash: sourceHash, sync_status: "PENDING", updated_at: now }).eq("id", 1)
      if (pendingError) throw pendingError
    } else if (body.action !== "publish") return fail("Unknown catalogue action")

    if (!sourceVersion) sourceVersion = snapshot.control.source_version || `next-${Date.now()}`
    const hash = await publishCatalogue(sourceVersion)
    const syncedAt = new Date().toISOString()
    const { data: savedControl, error: controlError } = await supabase.from("central_billing_catalogue_control").update({ price_owner: "NEXT", source_version: sourceVersion, source_hash: hash, sync_status: "SYNCED", synced_at: syncedAt, updated_at: syncedAt }).eq("id", 1).select("price_owner,source_version,source_hash,sync_status").maybeSingle()
    if (controlError || savedControl?.sync_status !== "SYNCED" || savedControl.source_version !== sourceVersion || savedControl.source_hash !== hash) {
      throw new Error("Central accepted the catalogue, but Next Admin could not confirm the saved sync status. Retry synchronization.")
    }
    const { error: auditError } = await supabase.from("central_billing_catalogue_audit").update({ central_sync_status: "SYNCED" }).eq("source_version", sourceVersion)
    if (auditError) throw new Error("Catalogue synced to Central, but the Next Admin audit status could not be updated. Retry synchronization.")
    return NextResponse.json({ success: true, price_owner: "NEXT", source_version: sourceVersion, synced_at: syncedAt })
  } catch (error) {
    console.error("[central billing catalogue sync]", error)
    const { error: statusError } = await supabase.from("central_billing_catalogue_control").update({ sync_status: "FAILED", updated_at: new Date().toISOString() }).eq("id", 1)
    if (statusError) console.error("[central billing catalogue status update failed]", statusError)
    return fail(error instanceof Error ? error.message : "Catalogue save or sync failed", 503)
  }
}
