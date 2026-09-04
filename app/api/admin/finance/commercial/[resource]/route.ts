import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { hasFinanceAction, type FinanceAction } from "@/lib/finance-permissions"
import {
  supabase,
  isSupabaseConfigured,
} from "@/lib/supabase"
import {
  logFinanceAudit,
  nextInvoiceNumber,
  nextQuoteNumber,
  recalculateInvoice,
  recalculateQuote,
  recordPayment,
  confirmPayment,
  allocatePayment,
  createReceipt,
  activateSubscription,
  syncEntitlementsFromSubscription,
  evaluateCommissionsForPayment,
  createCommissionPayout,
  refreshRenewalStatus,
  toKobo,
  fromKobo,
  money,
} from "@/lib/finance-commercial"

type Action = string

const resourceActionMap: Record<string, Record<string, FinanceAction | null | undefined>> = {
  products: { list: "finance:view", get: "finance:view", create: null, update: null, delete: null, set_active: null, set_inactive: null, issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  plans: { list: "finance:view", get: "finance:view", create: "finance:subscriptions:manage", update: "finance:subscriptions:manage", delete: null, set_active: "finance:subscriptions:manage", set_inactive: "finance:subscriptions:manage", issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  addons: { list: "finance:view", get: "finance:view", create: "finance:subscriptions:manage", update: "finance:subscriptions:manage", delete: null, set_active: "finance:subscriptions:manage", set_inactive: "finance:subscriptions:manage", issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  quotes: { list: "finance:view", get: "finance:view", create: "finance:quotes:create", update: "finance:quotes:create", delete: "finance:quotes:create", add_item: "finance:quotes:create", remove_item: "finance:quotes:create", send: "finance:quotes:create", accept: "finance:quotes:approve", decline: "finance:quotes:approve", expire: "finance:quotes:approve", convert: "finance:invoices:create", set_active: null, set_inactive: null, issue: null, void: null, cancel: null, activate: null, suspend: null, renew: null, cancel_subscription: null, confirm: null, reverse: null, allocate: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  invoices: { list: "finance:view", get: "finance:view", create: "finance:invoices:create", update: "finance:invoices:create", delete: "finance:invoices:create", add_item: "finance:invoices:create", remove_item: "finance:invoices:create", issue: "finance:invoices:issue", void: "finance:invoices:void", cancel: "finance:invoices:void", set_active: null, set_inactive: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  payments: { list: "finance:view", get: "finance:payments:view", create: "finance:payments:record", confirm: "finance:payments:confirm", reverse: "finance:payments:reverse", allocate: "finance:payments:record", update: "finance:payments:record", delete: "finance:payments:record", receipt: "finance:payments:record", set_active: null, set_inactive: null, issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, refresh: null },
  subscriptions: { list: "finance:view", get: "finance:subscriptions:view", create: "finance:subscriptions:manage", update: "finance:subscriptions:manage", delete: "finance:subscriptions:manage", activate: "finance:subscriptions:manage", suspend: "finance:subscriptions:manage", cancel_subscription: "finance:subscriptions:manage", renew: "finance:renewals:manage", add_addon: "finance:subscriptions:manage", remove_addon: "finance:subscriptions:manage", set_active: null, set_inactive: null, issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  renewals: { list: "finance:view", get: "finance:view", create: "finance:renewals:manage", update: "finance:renewals:manage", delete: "finance:renewals:manage", link_invoice: "finance:renewals:manage", refresh: "finance:renewals:manage", set_active: null, set_inactive: null, issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, evaluate: null, receipt: null },
  commission_plans: { list: "finance:view", get: "finance:view", create: "finance:commissions:approve", update: "finance:commissions:approve", delete: "finance:commissions:approve", set_active: "finance:commissions:approve", set_inactive: "finance:commissions:approve", issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  commissions: { list: "finance:commissions:view", get: "finance:commissions:view", approve: "finance:commissions:approve", cancel: "finance:commissions:approve", reverse: "finance:commissions:approve", schedule: "finance:commissions:payout", evaluate: "finance:commissions:approve", set_active: null, set_inactive: null, issue: null, void: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, create: null, update: null, delete: null, mark_paid: null, link_invoice: null, receipt: null, refresh: null },
  payouts: { list: "finance:commissions:view", get: "finance:commissions:view", create: "finance:commissions:payout", approve: "finance:commissions:payout", mark_paid: "finance:commissions:payout", update: "finance:commissions:payout", delete: "finance:commissions:payout", set_active: null, set_inactive: null, issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  receipts: { list: "finance:view", get: "finance:view", create: "finance:payments:record", update: null, delete: null, set_active: null, set_inactive: null, issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
}

function requireActionPerm(resource: string, action: Action, role: string | undefined): boolean {
  if (role === "Admin") return true
  const map = resourceActionMap[resource]
  if (!map) return false
  const permission = map[action]
  if (permission === null || permission === undefined) return false
  return hasFinanceAction(role as any, permission)
}

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

async function getActor() {
  const session = await getSession()
  if (!session) return null
  return { id: session.userId, role: session.role, name: session.name }
}

function now() {
  return new Date().toISOString()
}

/* ─────────────────────────────────────────────────────────────────────────────
   GET — list / single
   ───────────────────────────────────────────────────────────────────────────── */
export async function GET(request: Request, props: { params: Promise<{ resource: string }> }) {
  const actor = await getActor()
  if (!actor) return err("Unauthorized", 401)
  const { resource } = await props.params
  if (!requireActionPerm(resource, "list", actor.role)) return err("Forbidden", 403)

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const businessId = searchParams.get("businessId")
    const partnerId = searchParams.get("partnerId")
    const invoiceId = searchParams.get("invoiceId")
    const status = searchParams.get("status")

    if (resource === "products") {
      const { data, error } = id ? await supabase.from("commercial_products").select("*").eq("id", id).single() : await supabase.from("commercial_products").select("*").order("name")
      if (error) return err(error.message, 500)
      return ok(data)
    }

    if (resource === "plans") {
      const { data, error } = id ? await supabase.from("plans").select("*, commercial_products(*)").eq("id", id).single() : await supabase.from("plans").select("*, commercial_products(*)").order("name")
      if (error) return err(error.message, 500)
      return ok(data)
    }

    if (resource === "addons") {
      const { data, error } = id ? await supabase.from("addons").select("*").eq("id", id).single() : await supabase.from("addons").select("*").order("name")
      if (error) return err(error.message, 500)
      return ok(data)
    }

    if (resource === "quotes") {
      let q = supabase.from("quotes").select("*, quote_items(*), businesses:business_id (business_name, originating_partner_id)")
      if (businessId) q = q.eq("business_id", businessId)
      const { data, error } = id ? await q.eq("id", id).single() : await q.order("created_at", { ascending: false })
      if (error) return err(error.message, 500)
      return ok(data)
    }

    if (resource === "invoices") {
      let q = supabase.from("invoices").select("*, invoice_items(*), businesses:business_id (business_name)")
      if (businessId) q = q.eq("business_id", businessId)
      if (status) q = q.eq("status", status)
      const { data, error } = id ? await q.eq("id", id).single() : await q.order("created_at", { ascending: false })
      if (error) return err(error.message, 500)
      return ok(data)
    }

    if (resource === "payments") {
      let q = supabase.from("payments").select("*, payment_allocations(*), businesses:business_id (business_name)")
      if (businessId) q = q.eq("business_id", businessId)
      if (invoiceId) q = q.eq("invoice_id", invoiceId)
      if (status) q = q.eq("status", status)
      const { data, error } = id ? await q.eq("id", id).single() : await q.order("created_at", { ascending: false })
      if (error) return err(error.message, 500)
      return ok(data)
    }

    if (resource === "subscriptions") {
      let q = supabase.from("subscriptions").select("*, plans(*), subscription_addons(*, addons(*)), businesses:business_id (business_name)")
      if (businessId) q = q.eq("business_id", businessId)
      if (status) q = q.eq("status", status)
      const { data, error } = id ? await q.eq("id", id).single() : await q.order("created_at", { ascending: false })
      if (error) return err(error.message, 500)
      return ok(data)
    }

    if (resource === "renewals") {
      const q = supabase.from("subscription_renewals").select("*, subscriptions(*, businesses:business_id (business_name))").order("renewal_due_date")
      const { data, error } = id ? await q.eq("id", id).single() : await q
      if (error) return err(error.message, 500)
      return ok(data)
    }

    if (resource === "commission_plans") {
      const { data, error } = id ? await supabase.from("commission_plans").select("*").eq("id", id).single() : await supabase.from("commission_plans").select("*").order("name")
      if (error) return err(error.message, 500)
      return ok(data)
    }

    if (resource === "commissions") {
      let q = supabase.from("partner_commissions").select("*, partners:partner_id (display_name), businesses:business_id (business_name)")
      if (partnerId) q = q.eq("partner_id", partnerId)
      if (businessId) q = q.eq("business_id", businessId)
      if (status) q = q.eq("status", status)
      const { data, error } = id ? await q.eq("id", id).single() : await q.order("created_at", { ascending: false })
      if (error) return err(error.message, 500)
      return ok(data)
    }

    if (resource === "payouts") {
      let q = supabase.from("commission_payouts").select("*, partners:partner_id (display_name), commission_payout_items(*, partner_commissions(*))")
      if (partnerId) q = q.eq("partner_id", partnerId)
      if (status) q = q.eq("status", status)
      const { data, error } = id ? await q.eq("id", id).single() : await q.order("created_at", { ascending: false })
      if (error) return err(error.message, 500)
      return ok(data)
    }

    if (resource === "receipts") {
      let q = supabase.from("receipts").select("*, payments(*), businesses:business_id (business_name)")
      if (businessId) q = q.eq("business_id", businessId)
      const { data, error } = id ? await q.eq("id", id).single() : await q.order("issued_at", { ascending: false })
      if (error) return err(error.message, 500)
      return ok(data)
    }

    return err("Unknown resource", 404)
  } catch (e) {
    return err(String(e), 500)
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   POST — create / action
   ───────────────────────────────────────────────────────────────────────────── */
export async function POST(request: Request, props: { params: Promise<{ resource: string }> }) {
  const actor = await getActor()
  if (!actor) return err("Unauthorized", 401)
  const { resource } = await props.params

  try {
    const body = await request.json()
    const { action, data } = body as { action: Action; data: any }
    if (!action) return err("Missing action")
    if (!requireActionPerm(resource, action, actor.role)) return err("Forbidden", 403)

    if (resource === "products") {
      if (action === "create") {
        const { data: p, error } = await supabase.from("commercial_products").insert({ ...data, created_at: now(), updated_at: now() }).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "BUSINESS_LICENCE_CREATED", "COMMERCIAL_PRODUCT", p.id)
        return ok(p)
      }
      if (action === "update") {
        const { data: p, error } = await supabase.from("commercial_products").update({ ...data, updated_at: now() }).eq("id", data.id).select().single()
        if (error) return err(error.message, 500)
        return ok(p)
      }
    }

    if (resource === "plans") {
      if (action === "create") {
        const { data: p, error } = await supabase.from("plans").insert({ ...data, created_at: now(), updated_at: now() }).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "BUSINESS_LICENCE_CREATED", "PLAN", p.id)
        return ok(p)
      }
      if (action === "update") {
        const { data: p, error } = await supabase.from("plans").update({ ...data, updated_at: now() }).eq("id", data.id).select().single()
        if (error) return err(error.message, 500)
        return ok(p)
      }
      if (action === "set_active" || action === "set_inactive") {
        const { data: p, error } = await supabase.from("plans").update({ active: action === "set_active", updated_at: now() }).eq("id", data.id).select().single()
        if (error) return err(error.message, 500)
        return ok(p)
      }
    }

    if (resource === "addons") {
      if (action === "create") {
        const { data: a, error } = await supabase.from("addons").insert({ ...data, created_at: now(), updated_at: now() }).select().single()
        if (error) return err(error.message, 500)
        return ok(a)
      }
      if (action === "update") {
        const { data: a, error } = await supabase.from("addons").update({ ...data, updated_at: now() }).eq("id", data.id).select().single()
        if (error) return err(error.message, 500)
        return ok(a)
      }
      if (action === "set_active" || action === "set_inactive") {
        const { data: a, error } = await supabase.from("addons").update({ active: action === "set_active", updated_at: now() }).eq("id", data.id).select().single()
        if (error) return err(error.message, 500)
        return ok(a)
      }
    }

    if (resource === "quotes") {
      if (action === "create") {
        const quoteNumber = await nextQuoteNumber()
        const { items, ...fields } = data
        const { data: q, error } = await supabase.from("quotes").insert({ ...fields, quote_number: quoteNumber, status: "DRAFT", created_by: actor.id, created_at: now(), updated_at: now() }).select().single()
        if (error) return err(error.message, 500)
        if (items?.length) {
          await supabase.from("quote_items").insert(items.map((it: any) => ({ ...it, quote_id: q.id, line_total: money((it.quantity || 0) * (it.unit_price || 0) - (it.discount || 0) + (it.tax || 0)) })))
        }
        await recalculateQuote(q.id)
        await logFinanceAudit("ADMIN", actor.id, "QUOTE_CREATED", "QUOTE", q.id)
        return ok(q)
      }
      if (action === "add_item") {
        const { quote_id, ...it } = data
        await supabase.from("quote_items").insert({ ...it, quote_id, line_total: money((it.quantity || 0) * (it.unit_price || 0) - (it.discount || 0) + (it.tax || 0)) })
        await recalculateQuote(quote_id)
        return ok({ success: true })
      }
      if (action === "remove_item") {
        const { quote_id, item_id } = data
        await supabase.from("quote_items").delete().eq("id", item_id)
        await recalculateQuote(quote_id)
        return ok({ success: true })
      }
      if (action === "send") {
        const { id } = data
        const { data: q, error } = await supabase.from("quotes").update({ status: "SENT", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "QUOTE_SENT", "QUOTE", id)
        return ok(q)
      }
      if (action === "accept") {
        const { id } = data
        const { data: q, error } = await supabase.from("quotes").update({ status: "ACCEPTED", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "QUOTE_ACCEPTED", "QUOTE", id)
        return ok(q)
      }
      if (action === "decline") {
        const { id } = data
        const { data: q, error } = await supabase.from("quotes").update({ status: "DECLINED", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        return ok(q)
      }
      if (action === "expire") {
        const { id } = data
        const { data: q, error } = await supabase.from("quotes").update({ status: "EXPIRED", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        return ok(q)
      }
      if (action === "convert") {
        const { id } = data
        const { data: quote } = await supabase.from("quotes").select("*, quote_items(*), business_id, currency").eq("id", id).single()
        if (!quote) return err("Quote not found", 404)
        if (quote.status !== "ACCEPTED") return err("Quote must be accepted before conversion")
        const invoiceNumber = await nextInvoiceNumber()
        const today = new Date().toISOString().split("T")[0]
        const dueDate = data.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        const { data: inv, error } = await supabase.from("invoices").insert({
          invoice_number: invoiceNumber,
          business_id: quote.business_id,
          quote_id: id,
          currency: quote.currency,
          issue_date: today,
          due_date: dueDate,
          subtotal: quote.subtotal,
          discount_amount: quote.discount_amount,
          tax_amount: quote.tax_amount,
          total_amount: quote.total_amount,
          amount_paid: 0,
          balance_due: quote.total_amount,
          status: "DRAFT",
          created_by: actor.id,
          created_at: now(),
          updated_at: now(),
        }).select().single()
        if (error) return err(error.message, 500)
        await supabase.from("invoice_items").insert(quote.quote_items.map((it: any) => ({ ...it, invoice_id: inv.id })))
        await recalculateInvoice(inv.id)
        await supabase.from("quotes").update({ status: "CONVERTED", updated_at: now() }).eq("id", id)
        await logFinanceAudit("ADMIN", actor.id, "QUOTE_CONVERTED", "QUOTE", id, { invoice_id: inv.id })
        await logFinanceAudit("ADMIN", actor.id, "INVOICE_CREATED", "INVOICE", inv.id)
        return ok(inv)
      }
    }

    if (resource === "invoices") {
      if (action === "create") {
        const { items, business_id, due_date, ...fields } = data
        const invoiceNumber = await nextInvoiceNumber()
        const today = new Date().toISOString().split("T")[0]
        const { data: inv, error } = await supabase.from("invoices").insert({
          ...fields,
          invoice_number: invoiceNumber,
          business_id,
          issue_date: today,
          due_date: due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          amount_paid: 0,
          balance_due: 0,
          status: "DRAFT",
          created_by: actor.id,
          created_at: now(),
          updated_at: now(),
        }).select().single()
        if (error) return err(error.message, 500)
        if (items?.length) {
          await supabase.from("invoice_items").insert(items.map((it: any) => ({ ...it, invoice_id: inv.id, line_total: money((it.quantity || 0) * (it.unit_price || 0) - (it.discount || 0) + (it.tax || 0)) })))
        }
        await recalculateInvoice(inv.id)
        await logFinanceAudit("ADMIN", actor.id, "INVOICE_CREATED", "INVOICE", inv.id)
        return ok(inv)
      }
      if (action === "add_item") {
        const { invoice_id, ...it } = data
        await supabase.from("invoice_items").insert({ ...it, invoice_id, line_total: money((it.quantity || 0) * (it.unit_price || 0) - (it.discount || 0) + (it.tax || 0)) })
        await recalculateInvoice(invoice_id)
        return ok({ success: true })
      }
      if (action === "remove_item") {
        const { invoice_id, item_id } = data
        await supabase.from("invoice_items").delete().eq("id", item_id)
        await recalculateInvoice(invoice_id)
        return ok({ success: true })
      }
      if (action === "issue") {
        const { id } = data
        const { data: inv, error } = await supabase.from("invoices").update({ status: "ISSUED", issued_by: actor.id, updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "INVOICE_ISSUED", "INVOICE", id)
        return ok(inv)
      }
      if (action === "void") {
        const { id } = data
        const { data: inv, error } = await supabase.from("invoices").update({ status: "VOID", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "INVOICE_VOIDED", "INVOICE", id)
        return ok(inv)
      }
      if (action === "cancel") {
        const { id } = data
        const { data: inv, error } = await supabase.from("invoices").update({ status: "CANCELLED", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        return ok(inv)
      }
    }

    if (resource === "payments") {
      if (action === "record") {
        const p = await recordPayment(data)
        await logFinanceAudit("ADMIN", actor.id, "PAYMENT_RECORDED", "PAYMENT", p.id)
        return ok(p)
      }
      if (action === "confirm") {
        await confirmPayment(data.id, actor.id, actor.id)
        return ok({ success: true })
      }
      if (action === "reverse") {
        const { id } = data
        const { data: p, error } = await supabase.from("payments").update({ status: "REVERSED", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "PAYMENT_REVERSED", "PAYMENT", id)
        return ok(p)
      }
      if (action === "allocate") {
        await allocatePayment(data)
        return ok({ success: true })
      }
      if (action === "receipt") {
        const r = await createReceipt(data.payment_id, actor.id)
        return ok(r)
      }
    }

    if (resource === "subscriptions") {
      if (action === "create") {
        const { business_id, plan_id, billing_interval, quantity, start_date, current_period_end, renewal_date, ...fields } = data
        const { data: plan } = await supabase.from("plans").select("*").eq("id", plan_id).single()
        if (!plan) return err("Plan not found", 404)
        const today = start_date || new Date().toISOString().split("T")[0]
        const cpEnd = current_period_end || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        const { data: sub, error } = await supabase.from("subscriptions").insert({
          business_id,
          plan_id,
          billing_interval,
          quantity,
          start_date: today,
          current_period_start: today,
          current_period_end: cpEnd,
          renewal_date: renewal_date || cpEnd,
          price_at_activation: money(plan.base_price * (quantity || 1)),
          currency: plan.currency,
          status: "PENDING",
          created_by: actor.id,
          created_at: now(),
          updated_at: now(),
        }).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "SUBSCRIPTION_CREATED", "SUBSCRIPTION", sub.id)
        return ok(sub)
      }
      if (action === "activate") {
        await activateSubscription(data.id, actor.id, { licence_type: data.licence_type, expires_at: data.expires_at })
        await logFinanceAudit("ADMIN", actor.id, "SUBSCRIPTION_ACTIVATED", "SUBSCRIPTION", data.id)
        return ok({ success: true })
      }
      if (action === "suspend") {
        const { data: sub, error } = await supabase.from("subscriptions").update({ status: "SUSPENDED", updated_at: now() }).eq("id", data.id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "SUBSCRIPTION_SUSPENDED", "SUBSCRIPTION", data.id)
        return ok(sub)
      }
      if (action === "cancel_subscription") {
        const { data: sub, error } = await supabase.from("subscriptions").update({ status: "CANCELLED", updated_at: now() }).eq("id", data.id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "SUBSCRIPTION_CANCELLED", "SUBSCRIPTION", data.id)
        return ok(sub)
      }
      if (action === "renew") {
        const { id } = data
        const { data: sub } = await supabase.from("subscriptions").select("*").eq("id", id).single()
        if (!sub) return err("Subscription not found", 404)
        const nextEnd = new Date(new Date(sub.current_period_end).getTime() + (sub.billing_interval === "MONTHLY" ? 30 : sub.billing_interval === "QUARTERLY" ? 91 : 365) * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        await supabase.from("subscriptions").update({ current_period_end: nextEnd, renewal_date: nextEnd, updated_at: now() }).eq("id", id)
        await supabase.from("subscription_renewals").update({ status: "RENEWED", renewed_at: now(), updated_at: now() }).eq("subscription_id", id)
        await logFinanceAudit("ADMIN", actor.id, "SUBSCRIPTION_RENEWED", "SUBSCRIPTION", id)
        return ok({ success: true })
      }
      if (action === "add_addon") {
        const { subscription_id, addon_id, quantity, unit_price } = data
        const { data: addon } = await supabase.from("addons").select("*").eq("id", addon_id).single()
        if (!addon) return err("Addon not found", 404)
        const q = quantity || 1
        const price = money(unit_price || addon.default_price)
        const { data: sa, error } = await supabase.from("subscription_addons").insert({
          subscription_id,
          addon_id,
          quantity: q,
          unit_price_at_activation: price,
          total_price: money(q * price),
          start_date: new Date().toISOString().split("T")[0],
          status: "ACTIVE",
          created_at: now(),
          updated_at: now(),
        }).select().single()
        if (error) return err(error.message, 500)
        await syncEntitlementsFromSubscription(subscription_id, actor.id)
        await logFinanceAudit("ADMIN", actor.id, "ADDON_ACTIVATED", "SUBSCRIPTION_ADDON", sa.id)
        return ok(sa)
      }
      if (action === "remove_addon") {
        const { subscription_id, addon_id } = data
        await supabase.from("subscription_addons").update({ status: "INACTIVE", updated_at: now() }).eq("subscription_id", subscription_id).eq("addon_id", addon_id)
        await syncEntitlementsFromSubscription(subscription_id, actor.id)
        await logFinanceAudit("ADMIN", actor.id, "ADDON_REMOVED", "SUBSCRIPTION_ADDON", addon_id)
        return ok({ success: true })
      }
    }

    if (resource === "renewals") {
      if (action === "create") {
        const { subscription_id, renewal_due_date, status } = data
        const { data: r, error } = await supabase.from("subscription_renewals").upsert({
          subscription_id,
          renewal_due_date,
          status: status || "UPCOMING",
          created_at: now(),
          updated_at: now(),
        }, { onConflict: "subscription_id" }).select().single()
        if (error) return err(error.message, 500)
        return ok(r)
      }
      if (action === "update") {
        const { id } = data
        const { data: r, error } = await supabase.from("subscription_renewals").update({ ...data, updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        return ok(r)
      }
      if (action === "link_invoice") {
        const { id, invoice_id } = data
        const { data: r, error } = await supabase.from("subscription_renewals").update({ renewal_invoice_id: invoice_id, updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        return ok(r)
      }
      if (action === "refresh") {
        await refreshRenewalStatus(data.subscription_id)
        return ok({ success: true })
      }
    }

    if (resource === "commission_plans") {
      if (action === "create") {
        const { data: p, error } = await supabase.from("commission_plans").insert({ ...data, created_at: now(), updated_at: now() }).select().single()
        if (error) return err(error.message, 500)
        return ok(p)
      }
      if (action === "update") {
        const { data: p, error } = await supabase.from("commission_plans").update({ ...data, updated_at: now() }).eq("id", data.id).select().single()
        if (error) return err(error.message, 500)
        return ok(p)
      }
      if (action === "set_active" || action === "set_inactive") {
        const { data: p, error } = await supabase.from("commission_plans").update({ active: action === "set_active", updated_at: now() }).eq("id", data.id).select().single()
        if (error) return err(error.message, 500)
        return ok(p)
      }
    }

    if (resource === "commissions") {
      if (action === "approve") {
        const { id } = data
        const { data: c, error } = await supabase.from("partner_commissions").update({ status: "APPROVED", approved_at: now(), approved_by: actor.id, updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "COMMISSION_APPROVED", "PARTNER_COMMISSION", id)
        return ok(c)
      }
      if (action === "cancel") {
        const { id } = data
        const { data: c, error } = await supabase.from("partner_commissions").update({ status: "CANCELLED", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        return ok(c)
      }
      if (action === "reverse") {
        const { id, reason } = data
        const { data: c, error } = await supabase.from("partner_commissions").update({ status: "REVERSED", reversal_reason: reason, updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "COMMISSION_REVERSED", "PARTNER_COMMISSION", id)
        return ok(c)
      }
      if (action === "evaluate") {
        await evaluateCommissionsForPayment(data.payment_id, actor.id)
        return ok({ success: true })
      }
    }

    if (resource === "payouts") {
      if (action === "create") {
        const { partner_id, commission_ids } = data
        const p = await createCommissionPayout(partner_id, commission_ids, actor.id)
        return ok(p)
      }
      if (action === "approve") {
        const { id } = data
        const { data: p, error } = await supabase.from("commission_payouts").update({ status: "APPROVED", approved_by: actor.id, approved_at: now(), updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "COMMISSION_PAYOUT_APPROVED", "COMMISSION_PAYOUT", id)
        return ok(p)
      }
      if (action === "mark_paid") {
        const { id, bank_reference } = data
        const { data: p, error } = await supabase.from("commission_payouts").update({ status: "PAID", bank_reference, paid_by: actor.id, paid_at: now(), updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "COMMISSION_PAYOUT_PAID", "COMMISSION_PAYOUT", id)
        return ok(p)
      }
    }

    if (resource === "receipts") {
      if (action === "create") {
        const r = await createReceipt(data.payment_id, actor.id)
        return ok(r)
      }
    }

    return err("Unknown resource or action", 404)
  } catch (e) {
    console.error(`[Finance Commercial API /${resource}]`, e)
    return err(String(e), 500)
  }
}
