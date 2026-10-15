/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"

const ok = (data: unknown) => NextResponse.json({ success: true, data })
const err = (message: string, status = 400) => NextResponse.json({ success: false, error: message }, { status })

type CatalogType = "products" | "plans" | "services" | "addons"

const SERVICE_CATEGORIES = ["implementation", "training", "consulting", "support", "custom-development", "logistics", "other"]
const ADDON_PRICING_TYPES = ["FIXED", "PER_UNIT", "CUSTOM"]

function now() {
  return new Date().toISOString()
}

function isCatalogType(t: string): t is CatalogType {
  return ["products", "plans", "services", "addons"].includes(t)
}

function toProductStatus(active?: boolean) {
  if (active === undefined) return "ACTIVE"
  return active ? "ACTIVE" : "INACTIVE"
}

async function listCatalog(type?: CatalogType | "all", activeOnly = false) {
  const result: Record<string, unknown[]> = {}

  if (!type || type === "all" || type === "products") {
    let q = supabase.from("commercial_products").select("*").order("name")
    if (activeOnly) q = q.eq("status", "ACTIVE")
    const { data, error } = await q
    if (error) throw new Error(error.message)
    result.products = (data || []).map((p: any) => ({
      ...p,
      active: p.status === "ACTIVE",
    }))
  }

  if (!type || type === "all" || type === "plans") {
    let q = supabase.from("plans").select("*, commercial_products(id, name)").order("name")
    if (activeOnly) q = q.eq("active", true)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    result.plans = data || []
  }

  if (!type || type === "all" || type === "services") {
    let q = supabase.from("services").select("*").order("name")
    if (activeOnly) q = q.eq("active", true)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    result.services = data || []
  }

  if (!type || type === "all" || type === "addons") {
    let q = supabase.from("addons").select("*").order("name")
    if (activeOnly) q = q.eq("active", true)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    result.addons = data || []
  }

  return result
}

export async function GET(request: Request) {
  const auth = await authorizeAdmin("finance")
  if (auth.denied) return auth.denied

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"
    const activeOnly = searchParams.get("activeOnly") === "true"

    if (type !== "all" && !isCatalogType(type)) return err("Invalid catalog type")

    const data = await listCatalog(type as CatalogType, activeOnly)
    return ok(data)
  } catch (e) {
    return err(String(e), 500)
  }
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin("finance")
  if (auth.denied) return auth.denied

  try {
    const body = await request.json()
    const { type, data } = body as { type: CatalogType; data: Record<string, unknown> }
    if (!isCatalogType(type)) return err("Invalid catalog type")

    if (type === "products") {
      if (!data.code || !data.name) return err("Code and name are required")
      const { data: p, error } = await supabase
        .from("commercial_products")
        .insert({
          code: String(data.code),
          name: String(data.name),
          description: data.description ? String(data.description) : null,
          product_family: data.product_family ? String(data.product_family) : "RETAIL",
          status: toProductStatus(data.active as boolean | undefined),
          default_price: Number(data.default_price) || 0,
          currency: String(data.currency || "NGN"),
          created_at: now(),
          updated_at: now(),
        })
        .select()
        .single()
      if (error) return err(error.message, 500)
      return ok({ ...p, active: (p as any).status === "ACTIVE" })
    }

    if (type === "plans") {
      if (!data.code || !data.name || !data.product_id) return err("Code, name and product are required")
      const { data: plan, error } = await supabase
        .from("plans")
        .insert({
          product_id: String(data.product_id),
          code: String(data.code),
          name: String(data.name),
          description: data.description ? String(data.description) : null,
          billing_type: (data.billing_type as any) || "RECURRING",
          billing_interval: (data.billing_interval as any) || "MONTHLY",
          currency: String(data.currency || "NGN"),
          base_price: Number(data.base_price) || 0,
          included_branches: Number(data.included_branches) || 1,
          included_users: Number(data.included_users) || 1,
          online_store_included: data.online_store_included === true,
          active: data.active !== false,
          effective_from: String(data.effective_from || new Date().toISOString().split("T")[0]),
          created_at: now(),
          updated_at: now(),
        })
        .select()
        .single()
      if (error) return err(error.message, 500)
      return ok(plan)
    }

    if (type === "services") {
      if (!data.code || !data.name) return err("Code and name are required")
      const category = String(data.category || "other")
      if (!SERVICE_CATEGORIES.includes(category)) return err(`Invalid service category. Expected one of: ${SERVICE_CATEGORIES.join(", ")}`)
      const { data: s, error } = await supabase
        .from("services")
        .insert({
          code: String(data.code),
          name: String(data.name),
          description: data.description ? String(data.description) : null,
          default_price: Number(data.default_price) || 0,
          currency: String(data.currency || "NGN"),
          category,
          active: data.active !== false,
          created_at: now(),
          updated_at: now(),
        })
        .select()
        .single()
      if (error) return err(error.message, 500)
      return ok(s)
    }

    if (type === "addons") {
      if (!data.code || !data.name) return err("Code and name are required")
      const pricingType = String(data.pricing_type || "FIXED")
      if (!ADDON_PRICING_TYPES.includes(pricingType)) return err(`Invalid pricing type. Expected one of: ${ADDON_PRICING_TYPES.join(", ")}`)
      const billingInterval = data.billing_interval ? String(data.billing_interval) : null
      if (billingInterval !== null && !["MONTHLY", "QUARTERLY", "ANNUAL", "NONE"].includes(billingInterval)) return err("Invalid billing interval")
      const { data: a, error } = await supabase
        .from("addons")
        .insert({
          code: String(data.code),
          name: String(data.name),
          description: data.description ? String(data.description) : null,
          pricing_type: pricingType,
          unit_name: data.unit_name ? String(data.unit_name) : null,
          default_price: Number(data.default_price) || 0,
          currency: String(data.currency || "NGN"),
          recurring: data.recurring === true,
          billing_interval: billingInterval,
          active: data.active !== false,
          created_at: now(),
          updated_at: now(),
        })
        .select()
        .single()
      if (error) return err(error.message, 500)
      return ok(a)
    }

    return err("Unknown type")
  } catch (e) {
    return err(String(e), 500)
  }
}

export async function PUT(request: Request) {
  const auth = await authorizeAdmin("finance")
  if (auth.denied) return auth.denied

  try {
    const body = await request.json()
    const { type, id, data } = body as { type: CatalogType; id: string; data: Record<string, unknown> }
    if (!isCatalogType(type)) return err("Invalid catalog type")
    if (!id) return err("ID required")

    if (type === "products") {
      const updates: Record<string, unknown> = { updated_at: now() }
      if (data.code !== undefined) updates.code = String(data.code)
      if (data.name !== undefined) updates.name = String(data.name)
      if (data.description !== undefined) updates.description = data.description ? String(data.description) : null
      if (data.product_family !== undefined) updates.product_family = String(data.product_family)
      if (data.default_price !== undefined) updates.default_price = Number(data.default_price) || 0
      if (data.currency !== undefined) updates.currency = String(data.currency)
      if (data.active !== undefined) updates.status = toProductStatus(data.active as boolean)

      const { data: p, error } = await supabase.from("commercial_products").update(updates).eq("id", id).select().single()
      if (error) return err(error.message, 500)
      return ok({ ...p, active: (p as any).status === "ACTIVE" })
    }

    if (type === "plans") {
      const updates: Record<string, unknown> = { updated_at: now() }
      if (data.product_id !== undefined) updates.product_id = String(data.product_id)
      if (data.code !== undefined) updates.code = String(data.code)
      if (data.name !== undefined) updates.name = String(data.name)
      if (data.description !== undefined) updates.description = data.description ? String(data.description) : null
      if (data.billing_type !== undefined) updates.billing_type = data.billing_type
      if (data.billing_interval !== undefined) updates.billing_interval = data.billing_interval
      if (data.currency !== undefined) updates.currency = String(data.currency)
      if (data.base_price !== undefined) updates.base_price = Number(data.base_price) || 0
      if (data.included_branches !== undefined) updates.included_branches = Number(data.included_branches) || 0
      if (data.included_users !== undefined) updates.included_users = Number(data.included_users) || 0
      if (data.online_store_included !== undefined) updates.online_store_included = data.online_store_included === true
      if (data.active !== undefined) updates.active = data.active === true
      if (data.effective_from !== undefined) updates.effective_from = String(data.effective_from)

      const { data: p, error } = await supabase.from("plans").update(updates).eq("id", id).select().single()
      if (error) return err(error.message, 500)
      return ok(p)
    }

    if (type === "services") {
      const updates: Record<string, unknown> = { updated_at: now() }
      if (data.code !== undefined) updates.code = String(data.code)
      if (data.name !== undefined) updates.name = String(data.name)
      if (data.description !== undefined) updates.description = data.description ? String(data.description) : null
      if (data.default_price !== undefined) updates.default_price = Number(data.default_price) || 0
      if (data.currency !== undefined) updates.currency = String(data.currency)
      if (data.category !== undefined) {
        const category = String(data.category)
        if (!SERVICE_CATEGORIES.includes(category)) return err(`Invalid service category. Expected one of: ${SERVICE_CATEGORIES.join(", ")}`)
        updates.category = category
      }
      if (data.active !== undefined) updates.active = data.active === true

      const { data: s, error } = await supabase.from("services").update(updates).eq("id", id).select().single()
      if (error) return err(error.message, 500)
      return ok(s)
    }

    if (type === "addons") {
      const updates: Record<string, unknown> = { updated_at: now() }
      if (data.code !== undefined) updates.code = String(data.code)
      if (data.name !== undefined) updates.name = String(data.name)
      if (data.description !== undefined) updates.description = data.description ? String(data.description) : null
      if (data.pricing_type !== undefined) {
        const pricingType = String(data.pricing_type)
        if (!ADDON_PRICING_TYPES.includes(pricingType)) return err(`Invalid pricing type. Expected one of: ${ADDON_PRICING_TYPES.join(", ")}`)
        updates.pricing_type = pricingType
      }
      if (data.unit_name !== undefined) updates.unit_name = data.unit_name ? String(data.unit_name) : null
      if (data.default_price !== undefined) updates.default_price = Number(data.default_price) || 0
      if (data.currency !== undefined) updates.currency = String(data.currency)
      if (data.recurring !== undefined) updates.recurring = data.recurring === true
      if (data.billing_interval !== undefined) {
        const billingInterval = data.billing_interval ? String(data.billing_interval) : null
        if (billingInterval !== null && !["MONTHLY", "QUARTERLY", "ANNUAL", "NONE"].includes(billingInterval)) return err("Invalid billing interval")
        updates.billing_interval = billingInterval
      }
      if (data.active !== undefined) updates.active = data.active === true

      const { data: a, error } = await supabase.from("addons").update(updates).eq("id", id).select().single()
      if (error) return err(error.message, 500)
      return ok(a)
    }

    return err("Unknown type")
  } catch (e) {
    return err(String(e), 500)
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeAdmin("finance")
  if (auth.denied) return auth.denied

  try {
    const body = await request.json()
    const { type, id } = body as { type: CatalogType; id: string }
    if (!isCatalogType(type)) return err("Invalid catalog type")
    if (!id) return err("ID required")

    const table = type === "products" ? "commercial_products" : type === "plans" ? "plans" : type === "addons" ? "addons" : "services"
    const { error } = await supabase.from(table).delete().eq("id", id)
    if (error) return err(error.message, 500)
    return ok({ deleted: id })
  } catch (e) {
    return err(String(e), 500)
  }
}
