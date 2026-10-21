/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { hasFinanceAction, type FinanceAction } from "@/lib/finance-permissions"
import type { UserRole } from "@/lib/admin-types"
import { supabase } from "@/lib/supabase"
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
  waiveSubscription,
  getLicencesSoldReport,
  syncEntitlementsFromSubscription,
  evaluateCommissionsForPayment,
  createCommissionPayout,
  refreshRenewalStatus,
  syncInvoiceFinanceTransaction,
  removePaymentFinanceTransaction,
  reopenInvoiceStatus,
  money,
} from "@/lib/finance-commercial"
import {
  postPaymentReversal,
  postPayoutJournal,
  voidEntriesForSource,
} from "@/lib/finance-ledger"
import { issuePayoutStatement } from "@/lib/partner-generated-docs"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { sendInvoiceEmail } from "@/lib/invoice-emails"
import { sendPaymentConfirmationEmail } from "@/lib/payment-emails"
import { convertPartnerLeadToBusiness } from "@/lib/partner-leads"

type Action = string

const resourceActionMap: Record<string, Record<string, FinanceAction | null | undefined>> = {
  products: { list: "finance:view", get: "finance:view", create: null, update: null, delete: null, set_active: null, set_inactive: null, issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  plans: { list: "finance:view", get: "finance:view", create: "finance:subscriptions:manage", update: "finance:subscriptions:manage", delete: null, set_active: "finance:subscriptions:manage", set_inactive: "finance:subscriptions:manage", issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  addons: { list: "finance:view", get: "finance:view", create: "finance:subscriptions:manage", update: "finance:subscriptions:manage", delete: null, set_active: "finance:subscriptions:manage", set_inactive: "finance:subscriptions:manage", issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  quotes: { list: "finance:view", get: "finance:view", create: "finance:quotes:create", update: "finance:quotes:create", delete: "finance:quotes:create", add_item: "finance:quotes:create", remove_item: "finance:quotes:create", attach_business: "finance:quotes:create", create_business: "finance:quotes:create", send: "finance:quotes:create", accept: "finance:quotes:approve", decline: "finance:quotes:approve", expire: "finance:quotes:approve", convert: "finance:invoices:create", set_active: null, set_inactive: null, issue: null, void: null, cancel: null, activate: null, suspend: null, renew: null, cancel_subscription: null, confirm: null, reverse: null, allocate: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  invoices: { list: "finance:view", get: "finance:view", create: "finance:invoices:create", update: "finance:invoices:create", delete: "finance:invoices:create", add_item: "finance:invoices:create", remove_item: "finance:invoices:create", issue: "finance:invoices:issue", void: "finance:invoices:void", cancel: "finance:invoices:void", waive: "finance:invoices:void", reopen: "finance:invoices:void", set_active: null, set_inactive: null, send: "finance:invoices:issue", send_reminder: "finance:invoices:issue", pause_reminders: "finance:invoices:create", resume_reminders: "finance:invoices:create", accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  payments: { list: "finance:view", get: "finance:payments:view", create: "finance:payments:record", confirm: "finance:payments:confirm", reverse: "finance:payments:reverse", allocate: "finance:payments:record", update: "finance:payments:record", delete: "finance:payments:record", receipt: "finance:payments:record", send_receipt: "finance:payments:record", set_active: null, set_inactive: null, issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, refresh: null },
  subscriptions: { list: "finance:view", get: "finance:subscriptions:view", create: "finance:subscriptions:manage", update: "finance:subscriptions:manage", delete: "finance:subscriptions:manage", activate: "finance:subscriptions:manage", waive: "finance:subscriptions:manage", suspend: "finance:subscriptions:manage", cancel_subscription: "finance:subscriptions:manage", renew: "finance:renewals:manage", add_addon: "finance:subscriptions:manage", remove_addon: "finance:subscriptions:manage", set_active: null, set_inactive: null, issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  renewals: { list: "finance:view", get: "finance:view", create: "finance:renewals:manage", update: "finance:renewals:manage", delete: "finance:renewals:manage", link_invoice: "finance:renewals:manage", refresh: "finance:renewals:manage", set_active: null, set_inactive: null, issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, evaluate: null, receipt: null },
  commission_plans: { list: "finance:view", get: "finance:view", create: "finance:commissions:approve", update: "finance:commissions:approve", delete: "finance:commissions:approve", set_active: "finance:commissions:approve", set_inactive: "finance:commissions:approve", issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  commissions: { list: "finance:commissions:view", get: "finance:commissions:view", approve: "finance:commissions:approve", cancel: "finance:commissions:approve", reverse: "finance:commissions:approve", schedule: "finance:commissions:payout", evaluate: "finance:commissions:approve", set_active: null, set_inactive: null, issue: null, void: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, create: null, update: null, delete: null, mark_paid: null, link_invoice: null, receipt: null, refresh: null },
  payouts: { list: "finance:commissions:view", get: "finance:commissions:view", create: "finance:commissions:payout", approve: "finance:commissions:payout", mark_paid: "finance:commissions:payout", update: "finance:commissions:payout", delete: "finance:commissions:payout", set_active: null, set_inactive: null, issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  receipts: { list: "finance:view", get: "finance:view", create: "finance:payments:record", update: null, delete: null, set_active: null, set_inactive: null, issue: null, void: null, cancel: null, send: null, accept: null, decline: null, expire: null, convert: null, confirm: null, reverse: null, allocate: null, activate: null, suspend: null, renew: null, cancel_subscription: null, add_item: null, remove_item: null, add_addon: null, remove_addon: null, approve: null, mark_paid: null, schedule: null, link_invoice: null, evaluate: null, receipt: null, refresh: null },
  licences_sold: { list: "finance:view", get: "finance:view" },
}

function requireActionPerm(resource: string, action: Action, role: string | undefined): boolean {
  if (role === "Admin") return true
  const map = resourceActionMap[resource]
  if (!map) return false
  const permission = map[action]
  if (permission === null || permission === undefined) return false
  return hasFinanceAction(role as UserRole, permission)
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

/**
 * Create the end-customer business from an accepted partner quote's lead and
 * attach it to the quote. The partner remains attribution/revenue-linked on
 * the business; the partner organisation is never used as the customer.
 */
async function ensureQuoteBusiness(
  quoteId: string,
  actor: { id: string; name: string },
): Promise<{ ok: true; quote: any; business: any } | { ok: false; error: string }> {
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, status, business_id, partner_lead_id")
    .eq("id", quoteId)
    .single()
  if (quoteError || !quote) return { ok: false, error: "Quote not found" }
  if (String(quote.status).toUpperCase() !== "ACCEPTED") {
    return { ok: false, error: "The quote must be accepted before customer setup" }
  }

  if (quote.business_id) {
    const { data: existing } = await supabase.from("businesses").select("*").eq("id", quote.business_id).maybeSingle()
    if (!existing) return { ok: false, error: "The quote points to a missing customer business" }
    return { ok: true, quote, business: existing }
  }
  if (!quote.partner_lead_id) {
    return { ok: false, error: "This quote has no partner lead. Attach an existing customer business first." }
  }

  const result = await convertPartnerLeadToBusiness(
    quote.partner_lead_id,
    actor.id,
    { actorType: "ADMIN", actorId: actor.id, actorName: actor.name },
    { allowQuoteAccepted: true },
  )
  if (!result.ok || !result.business?.id) return { ok: false, error: result.error || "Customer business could not be created" }

  const { data: attached, error: attachError } = await supabase
    .from("quotes")
    .update({ business_id: result.business.id, updated_at: now() })
    .eq("id", quoteId)
    .is("business_id", null)
    .select()
    .single()
  if (attachError || !attached) {
    // If another retry attached the quote while the business was being
    // created, return the now-current quote rather than reporting a false
    // failure or creating another invoice path.
    const { data: current } = await supabase.from("quotes").select("*").eq("id", quoteId).single()
    if (current?.business_id) {
      const { data: currentBusiness } = await supabase.from("businesses").select("*").eq("id", current.business_id).single()
      if (currentBusiness) return { ok: true, quote: current, business: currentBusiness }
    }
    return { ok: false, error: "Customer business was created but the quote could not be linked" }
  }

  await logFinanceAudit("ADMIN", actor.id, "QUOTE_BUSINESS_ATTACHED", "QUOTE", quoteId, {
    business_id: result.business.id,
    created_from_partner_lead: quote.partner_lead_id,
  })
  return { ok: true, quote: attached, business: result.business }
}

/**
 * Manually cancelling or reversing a referral earning is an override: it must
 * carry a written reason and leave an immutable audit entry naming the actor.
 * Returns an error response when the reason is missing, otherwise null.
 */
async function requireOverrideReason(
  commissionId: string,
  actor: { id: string; name: string },
  reason?: string
) {
  const { data: row } = await supabase
    .from("partner_commissions")
    .select("earning_kind, partner_id, status")
    .eq("id", commissionId)
    .maybeSingle()
  if (!row || !(row as { earning_kind?: string | null }).earning_kind) return null

  const trimmed = (reason || "").trim()
  if (trimmed.length < 5) return err("A reason is required to override a referral earning", 400)

  await recordAudit({ actorType: "ADMIN", actorId: actor.id, actorName: actor.name }, {
    action: AUDIT_ACTIONS.REFERRAL_COMMISSION_OVERRIDDEN,
    entityType: AUDIT_ENTITIES.PARTNER_COMMISSION,
    entityId: commissionId,
    metadata: {
      reason: trimmed,
      partnerId: (row as { partner_id?: string }).partner_id,
      previousStatus: (row as { status?: string }).status,
    },
  })
  return null
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
      let q = supabase.from("quotes").select("*, quote_items(*), businesses:business_id (business_name, originating_partner_id), partner_leads:partner_lead_id (id, business_name, contact_name, email, phone, country, state, city, industry, business_type, estimated_branches, estimated_users)")
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
      // Joins mirror the style used by the other resources above: businesses /
      // invoices carry display names, payment_accounts surfaces the receiving
      // account set at confirmation (null until then).
      let q = supabase.from("payments").select("*, payment_allocations(*), businesses:business_id (business_name), invoices:invoice_id (invoice_number), payment_accounts:payment_account_id (id, name)")
      if (businessId) q = q.eq("business_id", businessId)
      if (invoiceId) {
        // Include payments linked directly AND those allocated to this invoice via payment_allocations.
        const { data: allocs } = await supabase.from("payment_allocations").select("payment_id").eq("invoice_id", invoiceId)
        const allocIds = ((allocs as { payment_id: string }[]) || []).map((a) => a.payment_id)
        q = allocIds.length ? q.or(`invoice_id.eq.${invoiceId},id.in.(${allocIds.join(",")})`) : q.eq("invoice_id", invoiceId)
      }
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

    if (resource === "licences_sold") {
      const report = await getLicencesSoldReport()
      return ok(report)
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
        const partnerLeadId = typeof fields.partner_lead_id === "string" && fields.partner_lead_id.trim() ? fields.partner_lead_id.trim() : null
        const businessId = typeof fields.business_id === "string" && fields.business_id.trim() ? fields.business_id.trim() : null
        const planId = typeof fields.plan_id === "string" && fields.plan_id.trim() ? fields.plan_id.trim() : null
        if (!businessId && !partnerLeadId) return err("Select a business or a partner lead for this quote")
        if (partnerLeadId && !planId) return err("Select an active plan for this partner quote")

        if (planId) {
          const { data: plan } = await supabase.from("plans").select("id, active").eq("id", planId).maybeSingle()
          if (!plan || plan.active !== true) return err("Select a current active plan")
        }

        if (partnerLeadId) {
          const { data: lead } = await supabase
            .from("partner_leads")
            .select("id, partner_id, status, protection_status")
            .eq("id", partnerLeadId)
            .maybeSingle()
          if (!lead) return err("Partner lead not found")
          if (["LOST", "EXPIRED"].includes(String(lead.status))) return err("A quote cannot be created for a lost or expired lead")
          if (lead.protection_status !== "PROTECTED") return err("Protect the partner lead before creating its quote")
          fields.partner_id = fields.partner_id || lead.partner_id
        }
        fields.business_id = businessId
        fields.partner_lead_id = partnerLeadId
        fields.plan_id = planId
        // Legacy callers and the pre-catalog form could omit currency. Keep
        // every quote usable and consistently NGN unless an explicit catalog
        // currency was selected.
        fields.currency = typeof fields.currency === "string" && fields.currency.trim()
          ? fields.currency.trim().toUpperCase()
          : "NGN"

        const { data: q, error } = await supabase.from("quotes").insert({ ...fields, quote_number: quoteNumber, status: "DRAFT", created_by: actor.id, created_at: now(), updated_at: now() }).select().single()
        if (error) return err(error.message, 500)
        if (items?.length) {
          const { error: itemError } = await supabase.from("quote_items").insert(items.map((it: any) => ({
            item_type: it.item_type || "CUSTOM",
            reference_id: it.reference_id || null,
            description: String(it.description || "").trim(),
            quantity: Number(it.quantity) || 0,
            unit_price: Number(it.unit_price) || 0,
            discount: Number(it.discount) || 0,
            tax: Number(it.tax) || 0,
            tax_rate: it.tax_rate == null || it.tax_rate === "" ? null : Number(it.tax_rate),
            quote_id: q.id,
            line_total: money((it.quantity || 0) * (it.unit_price || 0) - (it.discount || 0) + (it.tax || 0)),
          })))
          if (itemError) return err(`Quote created but its lines could not be saved: ${itemError.message}`, 500)
        }
        await recalculateQuote(q.id)
        if (partnerLeadId) {
          const { data: requestRow } = await supabase
            .from("partner_quote_requests")
            .select("id")
            .eq("partner_lead_id", partnerLeadId)
            .in("status", ["SUBMITTED", "UNDER_REVIEW"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
          if (requestRow) {
            await supabase.from("partner_quote_requests").update({ issued_quote_ref: q.quote_number, updated_at: now() }).eq("id", requestRow.id)
          }
        }
        await logFinanceAudit("ADMIN", actor.id, "QUOTE_CREATED", "QUOTE", q.id)
        return ok(q)
      }
      if (action === "add_item") {
        const { quote_id, ...it } = data
        await supabase.from("quote_items").insert({
          ...it,
          tax_rate: it.tax_rate == null || it.tax_rate === "" ? null : Number(it.tax_rate),
          quote_id,
          line_total: money((it.quantity || 0) * (it.unit_price || 0) - (it.discount || 0) + (it.tax || 0)),
        })
        await recalculateQuote(quote_id)
        return ok({ success: true })
      }
      if (action === "remove_item") {
        const { quote_id, item_id } = data
        await supabase.from("quote_items").delete().eq("id", item_id)
        await recalculateQuote(quote_id)
        return ok({ success: true })
      }
      if (action === "attach_business") {
        const { id, business_id } = data
        if (!id || !business_id) return err("Quote and customer business are required")
        const { data: business } = await supabase.from("businesses").select("id, status").eq("id", business_id).maybeSingle()
        if (!business) return err("Customer business not found", 404)
        if (["CHURNED", "INACTIVE"].includes(String(business.status))) return err("This customer business is not active")
        const { data: q, error } = await supabase.from("quotes").update({ business_id, updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "QUOTE_BUSINESS_ATTACHED", "QUOTE", id, { business_id })
        return ok(q)
      }
      if (action === "create_business") {
        const { id } = data
        if (!id) return err("Quote is required")
        const prepared = await ensureQuoteBusiness(id, actor)
        if (!prepared.ok) return err(prepared.error)
        return ok(prepared.business)
      }
      if (action === "send") {
        const { id } = data
        const { data: q, error } = await supabase.from("quotes").update({ status: "SENT", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        if (q?.partner_lead_id) {
          await supabase
            .from("partner_quote_requests")
            .update({ status: "ISSUED", issued_quote_ref: q.quote_number, decided_by: actor.id, decided_at: now(), decision_reason: "Finance quote sent", updated_at: now() })
            .eq("partner_lead_id", q.partner_lead_id)
            .in("status", ["SUBMITTED", "UNDER_REVIEW"])
        }
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
        const { data: quoteRow } = await supabase.from("quotes").select("*, quote_items(*), business_id, currency").eq("id", id).single()
        const quote = quoteRow as any
        if (!quote) return err("Quote not found", 404)
        if (quote.status === "CONVERTED") {
          const { data: existingInvoice } = await supabase.from("invoices").select("*").eq("quote_id", id).maybeSingle()
          if (existingInvoice) return ok(existingInvoice)
          return err("This quote is already converted, but its invoice could not be found", 409)
        }
        if (quote.status !== "ACCEPTED") return err("Quote must be accepted before conversion")
        let businessCreated = false
        if (!quote.business_id && data.create_business === true) {
          const prepared = await ensureQuoteBusiness(id, actor)
          if (!prepared.ok) return err(prepared.error)
          quote.business_id = prepared.business.id
          businessCreated = true
        }
        if (!quote.business_id) return err("Create the customer business from this quote before converting it to an invoice")
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
        // Quote items and invoice items intentionally have different foreign-key
        // columns. Do not spread the quote row here: `quote_id` belongs to
        // quote_items, not invoice_items (and tax_rate is also quote-only).
        const invoiceItems = quote.quote_items.map((it: any) => ({
          invoice_id: inv.id,
          item_type: it.item_type || "CUSTOM",
          reference_id: it.reference_id ?? null,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount: it.discount,
          tax: it.tax,
          line_total: it.line_total,
        }))
        const { error: itemError } = await supabase.from("invoice_items").insert(invoiceItems)
        if (itemError) {
          await supabase.from("invoices").delete().eq("id", inv.id)
          return err(`Invoice could not be completed: ${itemError.message}`, 500)
        }
        await recalculateInvoice(inv.id)
        await supabase.from("quotes").update({ status: "CONVERTED", updated_at: now() }).eq("id", id)
        await logFinanceAudit("ADMIN", actor.id, "QUOTE_CONVERTED", "QUOTE", id, { invoice_id: inv.id })
        await logFinanceAudit("ADMIN", actor.id, "INVOICE_CREATED", "INVOICE", inv.id)
        return ok({ ...inv, business_created: businessCreated })
      }
    }

    if (resource === "invoices") {
      if (action === "create") {
        const { items, business_id, due_date, ...fields } = data
        if (!business_id) return err("Business is required for every invoice")
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
        await syncInvoiceFinanceTransaction(id)
        const email = await sendInvoiceEmail(id, "invoice", { type: "ADMIN", id: actor.id })
        return ok({ ...inv, emailSent: email.ok, emailError: email.error, emailSentTo: email.sentTo })
      }
      if (action === "send") {
        const r = await sendInvoiceEmail(data.id, "invoice", { type: "ADMIN", id: actor.id })
        if (!r.ok) return err(r.error || "Failed to send invoice email", 500)
        return ok({ sentTo: r.sentTo })
      }
      if (action === "send_reminder") {
        const r = await sendInvoiceEmail(data.id, "reminder", { type: "ADMIN", id: actor.id })
        if (!r.ok) return err(r.error || "Failed to send reminder", 500)
        return ok({ sentTo: r.sentTo })
      }
      if (action === "pause_reminders" || action === "resume_reminders") {
        const paused = action === "pause_reminders"
        const { data: inv, error } = await supabase.from("invoices").update({ reminders_paused: paused, updated_at: now() }).eq("id", data.id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "INVOICE_REMINDERS_TOGGLED", "INVOICE", data.id, { paused })
        return ok(inv)
      }
      if (action === "void") {
        const { id } = data
        const { data: inv, error } = await supabase.from("invoices").update({ status: "VOID", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "INVOICE_VOIDED", "INVOICE", id)
        await syncInvoiceFinanceTransaction(id)
        return ok(inv)
      }
      if (action === "waive") {
        const { id, reason } = data
        if (!id) return err("Invoice ID required")
        const waiverReason = (reason || "").trim() || "Waived by finance"
        const { data: inv, error } = await supabase.from("invoices").update({
          status: "WAIVED",
          waived_at: now(),
          waived_by: actor.id,
          waive_reason: waiverReason,
          updated_at: now(),
        }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "INVOICE_WAIVED", "INVOICE", id, { reason: waiverReason })
        return ok(inv)
      }
      if (action === "cancel") {
        const { id } = data
        const { data: inv, error } = await supabase.from("invoices").update({ status: "CANCELLED", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await syncInvoiceFinanceTransaction(id)
        return ok(inv)
      }
      if (action === "reopen") {
        const { id } = data
        const { data: inv, error } = await supabase.from("invoices").select("status, issued_by, amount_paid").eq("id", id).single()
        if (error) return err(error.message, 500)
        if ((inv as { status: string } | null)?.status !== "CANCELLED") return err("Only a cancelled invoice can be reopened")
        const restored = reopenInvoiceStatus(inv as { issued_by: string | null; amount_paid: number })
        const { data: reopened, error: updateError } = await supabase.from("invoices").update({ status: restored, updated_at: now() }).eq("id", id).select().single()
        if (updateError) return err(updateError.message, 500)
        // Restores the finance transaction and reposts the income journal entry
        // that was voided on cancellation.
        await recalculateInvoice(id)
        await logFinanceAudit("ADMIN", actor.id, "INVOICE_REOPENED", "INVOICE", id, { restored_to: restored })
        return ok(reopened)
      }
      if (action === "update") {
        const { id, items, ...updates } = data
        if (!id) return err("Invoice ID required")
        const meta: Record<string, unknown> = {}
        for (const k of ["issue_date", "due_date", "currency", "notes_public", "notes_internal"]) {
          if (k in updates) meta[k] = updates[k]
        }
        const { data: inv, error } = await supabase.from("invoices").update({ ...meta, updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        if (Array.isArray(items)) {
          for (const it of items) {
            if (!it.description) return err("Every line item needs a description")
          }
          const { data: existing } = await supabase.from("invoice_items").select("id").eq("invoice_id", id)
          const keepIds = new Set(items.filter((it: any) => it?.id).map((it: any) => it.id as string))
          const removed = ((existing as { id: string }[]) || []).map((r) => r.id).filter((itemId) => !keepIds.has(itemId))
          if (removed.length) {
            const { error: delErr } = await supabase.from("invoice_items").delete().in("id", removed)
            if (delErr) return err(delErr.message, 500)
          }
          for (const it of items) {
            const row = {
              item_type: it.item_type || "CUSTOM",
              reference_id: it.reference_id || null,
              description: it.description,
              quantity: Number(it.quantity) || 0,
              unit_price: Number(it.unit_price) || 0,
              discount: Number(it.discount) || 0,
              tax: Number(it.tax) || 0,
              line_total: money((Number(it.quantity) || 0) * (Number(it.unit_price) || 0) - (Number(it.discount) || 0) + (Number(it.tax) || 0)),
            }
            if (it.id) {
              const { error: uErr } = await supabase.from("invoice_items").update(row).eq("id", it.id).eq("invoice_id", id)
              if (uErr) return err(uErr.message, 500)
            } else {
              const { error: iErr } = await supabase.from("invoice_items").insert({ ...row, invoice_id: id })
              if (iErr) return err(iErr.message, 500)
            }
          }
        }
        await recalculateInvoice(id)
        await logFinanceAudit("ADMIN", actor.id, "INVOICE_UPDATED", "INVOICE", id)
        return ok(inv)
      }
      if (action === "delete") {
        const { id } = data
        await voidEntriesForSource("INVOICE", id)
        await supabase.from("finance_transactions").delete().eq("invoice_id", id)
        await supabase.from("invoice_items").delete().eq("invoice_id", id)
        await supabase.from("payment_allocations").delete().eq("invoice_id", id)
        await supabase.from("payments").update({ invoice_id: null, updated_at: now() }).eq("invoice_id", id)
        const { data: inv, error } = await supabase.from("invoices").delete().eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "INVOICE_DELETED", "INVOICE", id)
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
        await confirmPayment(data.id, actor.id, actor.id, data.payment_account_id)
        return ok({ success: true })
      }
      if (action === "reverse") {
        const { id } = data
        const { data: p, error } = await supabase.from("payments").update({ status: "REVERSED", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "PAYMENT_REVERSED", "PAYMENT", id)
        await removePaymentFinanceTransaction(id)
        try { await postPaymentReversal(id) } catch (e) { console.error("[payments.reverse] ledger", e) }
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
      if (action === "send_receipt") {
        const r = await sendPaymentConfirmationEmail(data.id, { type: "ADMIN", id: actor.id })
        if (!r.ok) return err(r.error || "Failed to send receipt email", 500)
        await logFinanceAudit("ADMIN", actor.id, "INVOICE_EMAIL_SENT", "PAYMENT", data.id, { to: r.sentTo, kind: "send_receipt" })
        return ok({ sentTo: r.sentTo })
      }
    }

    if (resource === "subscriptions") {
      if (action === "create") {
        const { business_id, plan_id, billing_interval, quantity, start_date, current_period_end, renewal_date, auto_renew } = data
        if (!business_id) return err("Business is required for every subscription")
        if (!plan_id) return err("Plan is required for every subscription")

        // Validate the business exists and is a real, selectable business.
        const { data: business } = await supabase.from("businesses").select("id, status").eq("id", business_id).single()
        if (!business) return err("Business not found", 404)
        if (["CHURNED", "INACTIVE"].includes((business as { status: string }).status)) {
          return err(`Cannot create a subscription for a ${(business as { status: string }).status.toLowerCase()} business`)
        }

        // Validate the plan exists and is still active — only available plans
        // may be selected, and only a plan (never a service) drives a licence.
        const { data: plan } = await supabase.from("plans").select("*").eq("id", plan_id).single()
        if (!plan) return err("Plan not found", 404)
        if (!(plan as { active: boolean }).active) return err("Selected plan is not available")

        const today = start_date || new Date().toISOString().split("T")[0]
        const cpEnd = current_period_end || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        const { data: sub, error } = await supabase.from("subscriptions").insert({
          business_id,
          plan_id,
          billing_interval: billing_interval || (plan as { billing_interval: string }).billing_interval,
          quantity,
          start_date: today,
          current_period_start: today,
          current_period_end: cpEnd,
          renewal_date: renewal_date || cpEnd,
          auto_renew: auto_renew ?? false,
          price_at_activation: money((plan as { base_price: number }).base_price * (quantity || 1)),
          currency: (plan as { currency: string }).currency,
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
      if (action === "waive") {
        const result = await waiveSubscription(data.id, actor.id, {
          reason: data.reason,
          licence_type: data.licence_type,
          expires_at: data.expires_at,
        })
        return ok(result)
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
        // Referral earnings carry contractual gates — approveReferralCommission
        // re-evaluates them and requires a verified payout profile.
        const { data: target } = await supabase
          .from("partner_commissions")
          .select("earning_kind")
          .eq("id", id)
          .maybeSingle()
        if ((target as { earning_kind?: string | null } | null)?.earning_kind) {
          const { approveReferralCommission } = await import("@/lib/referral-finance")
          const res = await approveReferralCommission(id, { actorId: actor.id, actorName: actor.name })
          if (!res.ok) return err(res.error || "Approval failed", 400)
          const { data: c } = await supabase.from("partner_commissions").select("*").eq("id", id).single()
          return ok(c)
        }
        const { data: c, error } = await supabase.from("partner_commissions").update({ status: "APPROVED", approved_at: now(), approved_by: actor.id, updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        await logFinanceAudit("ADMIN", actor.id, "COMMISSION_APPROVED", "PARTNER_COMMISSION", id)
        return ok(c)
      }
      if (action === "cancel") {
        const { id, reason } = data
        const guard = await requireOverrideReason(id, actor, reason)
        if (guard) return guard
        const { data: c, error } = await supabase.from("partner_commissions").update({ status: "CANCELLED", updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        return ok(c)
      }
      if (action === "reverse") {
        const { id, reason } = data
        const guard = await requireOverrideReason(id, actor, reason)
        if (guard) return guard
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
        const { id, bank_reference, payment_account_id } = data
        const { data: p, error } = await supabase.from("commission_payouts").update({ status: "PAID", bank_reference, ...(payment_account_id ? { payment_account_id } : {}), paid_by: actor.id, paid_at: now(), updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        // Reflect the payment on any linked partner payout request
        await supabase.from("partner_payout_requests").update({ status: "PAID", updated_at: now() }).eq("payout_id", id)
        await logFinanceAudit("ADMIN", actor.id, "COMMISSION_PAYOUT_PAID", "COMMISSION_PAYOUT", id)
        // Earnings inside a completed payout become PAID with the payout reference.
        try {
          const { markReferralCommissionsPaid } = await import("@/lib/referral-finance")
          await markReferralCommissionsPaid(id, { actorId: actor.id, actorName: actor.name })
        } catch (e) { console.error("[payouts.mark_paid] commission settlement", e) }
        try { await postPayoutJournal(id) } catch (e) { console.error("[payouts.mark_paid] ledger", e) }
        try { await issuePayoutStatement(id, actor.id) } catch (e) { console.error("[payouts.mark_paid] statement", e) }
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
