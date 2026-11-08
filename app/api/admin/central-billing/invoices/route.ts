import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { z } from "zod"
import crypto from "crypto"
import { centralSignature } from "@/lib/central-billing-auth"

const schema = z.object({ idempotencyKey: z.string().min(16).max(100).regex(/^[a-zA-Z0-9:_-]+$/), mappingId: z.string().uuid(), channel: z.enum(["sms", "email"]), creditUnits: z.number().int().positive(), amountKobo: z.number().int().positive(), taxKobo: z.number().int().nonnegative(), packageId: z.number().int().nonnegative().optional(), contactEmail: z.string().email().optional() })

/** Admin-created Central credit invoice; later payments use existing finance approval and recovery. */
export async function POST(request: Request) {
  const auth = await authorizeAdmin("finance", "manage")
  if (auth.denied) return auth.denied
  if (process.env.CENTRAL_BILLING_ENABLED !== "true") return NextResponse.json({ error: "Central credit billing is disabled" }, { status: 503 })
  const { data: catalogueControl } = await supabase.from("central_billing_catalogue_control").select("price_owner,sync_status").eq("id", 1).maybeSingle()
  if (catalogueControl?.price_owner !== "NEXT" || catalogueControl.sync_status !== "SYNCED") return NextResponse.json({ error: "Next-owned Central catalogue is not synchronized" }, { status: 503 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid credit invoice request" }, { status: 400 })
  const { data: mapping } = await supabase.from("central_installation_mappings").select("*").eq("id", parsed.data.mappingId).eq("status", "ACTIVE").maybeSingle()
  if (!mapping) return NextResponse.json({ error: "Active Central installation mapping not found" }, { status: 404 })
  const { data: product } = await supabase.from("central_credit_products").select("*").eq("channel", parsed.data.channel).eq("active", true).maybeSingle()
  if (!product) return NextResponse.json({ error: "Imported Central credit catalogue is unavailable" }, { status: 409 })
  const net = parsed.data.amountKobo - parsed.data.taxKobo
  if (Math.round(net * Number(product.tax_bps) / 10000) !== parsed.data.taxKobo) return NextResponse.json({ error: "Tax does not match the imported catalogue" }, { status: 409 })
  if (parsed.data.packageId) {
    const bundle = (product.bundles as Array<{ id: number; amount_kobo: number; credit_units: number; enabled?: boolean }>).find((b) => Number(b.id) === parsed.data.packageId && b.enabled !== false)
    if (!bundle || Number(bundle.amount_kobo) !== net || Number(bundle.credit_units) !== parsed.data.creditUnits) return NextResponse.json({ error: "Bundle does not match the imported catalogue" }, { status: 409 })
  } else if (parsed.data.creditUnits !== Math.floor(net / Number(product.price_per_credit_kobo)) || net < Number(product.minimum_topup_kobo)) return NextResponse.json({ error: "Price, units or minimum does not match the imported catalogue" }, { status: 409 })
  const payload = { idempotency_key: parsed.data.idempotencyKey, fleet_install_id: Number(mapping.fleet_install_id), store_id: Number(mapping.store_id), install_url: mapping.install_url, channel: parsed.data.channel, credit_units: parsed.data.creditUnits, amount_kobo: parsed.data.amountKobo, tax_kobo: parsed.data.taxKobo, package_id: parsed.data.packageId || 0 }
  const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")
  const { data, error } = await supabase.rpc("central_create_credit_invoice", { p_idempotency_key: payload.idempotency_key, p_payload_hash: hash, p_fleet_install_id: payload.fleet_install_id, p_store_id: payload.store_id, p_install_url: payload.install_url, p_channel: payload.channel, p_credit_units: payload.credit_units, p_package_id: payload.package_id, p_amount_kobo: payload.amount_kobo, p_tax_kobo: payload.tax_kobo })
  if (error) return NextResponse.json({ error: "Invoice creation failed; verify imported catalogue and mapping" }, { status: 409 })
  const invoice = Array.isArray(data) ? data[0] : data
  const centralUrl = (process.env.CENTRAL_BILLING_CENTRAL_URL || "").startsWith("https://") ? process.env.CENTRAL_BILLING_CENTRAL_URL || "" : ""
  if (!centralUrl) return NextResponse.json({ error: "Central registration is unavailable", invoice }, { status: 503 })
  const registration = { request_key: parsed.data.idempotencyKey, intent_id: invoice.intent_id, invoice_id: invoice.invoice_id, invoice_item_id: invoice.invoice_item_id, invoice_number: invoice.invoice_number, business_id: invoice.business_id, fleet_install_id: payload.fleet_install_id, store_id: payload.store_id, channel: payload.channel, credit_units: payload.credit_units, amount_kobo: payload.amount_kobo, tax_kobo: payload.tax_kobo, tax_bps: Number(product.tax_bps), contact_email: parsed.data.contactEmail || "" }
  const wire = JSON.stringify(registration), timestamp = Math.floor(Date.now() / 1000).toString(), path = "/messaging_api/register_credit_invoice"
  const centralResponse = await fetch(`${centralUrl.replace(/\/$/, "")}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-central-timestamp": timestamp, "x-central-signature": centralSignature(timestamp, wire, path) }, body: wire, cache: "no-store" }).catch(() => null)
  if (!centralResponse?.ok) return NextResponse.json({ error: "Invoice exists but Central registration is pending; retry with the same idempotency key", invoice }, { status: 503 })
  return NextResponse.json({ invoice, central_registration: "registered" })
}
