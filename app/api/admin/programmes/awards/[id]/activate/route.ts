import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { waiveSubscription } from "@/lib/finance-commercial"
import { notifyAllAdmins } from "@/lib/admin-notifications"

export const dynamic = "force-dynamic"
type Context = { params: Promise<{ id: string }> }

const bodySchema = z.object({ reason: z.string().trim().max(1000).optional() })

export async function POST(request: Request, context: Context) {
  const { session, denied } = await authorizeAdmin("business_growth.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const body = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!body.success) return NextResponse.json({ error: "Invalid activation request" }, { status: 400 })
  const { id } = await context.params
  const { data: current } = await supabase.from("business_growth_awards").select("*").eq("id", id).maybeSingle()
  if (!current) return NextResponse.json({ error: "Award not found" }, { status: 404 })
  if (current.fulfilment_status === "ACTIVE" && current.licence_id) return NextResponse.json({ success: true, alreadyActive: true, licenceId: current.licence_id })
  if (current.status !== "ACCEPTED") return NextResponse.json({ error: "Only accepted offers can be activated." }, { status: 409 })
  if (current.activation_deadline_at && new Date(current.activation_deadline_at).getTime() < Date.now() && !body.data.reason?.trim()) return NextResponse.json({ error: "Activation is past the agreed deadline. Enter an override reason to continue." }, { status: 409 })

  try {
    const { data, error } = await supabase.rpc("prepare_business_growth_activation", { p_award_id: id, p_actor: session!.userId })
    if (error || !data?.[0]) throw new Error(error?.message || "Activation could not be prepared")
    const prepared = data[0] as { business_id: string; subscription_id: string; already_prepared: boolean }
    if (prepared.already_prepared) {
      const ageMs = Date.now() - new Date(current.updated_at).getTime()
      if (ageMs < 10 * 60_000) return NextResponse.json({ error: "Activation is already in progress. Please retry in a few minutes if it does not complete." }, { status: 409 })
    }

    const { data: subscription } = await supabase.from("subscriptions").select("status,current_period_end").eq("id", prepared.subscription_id).maybeSingle()
    if (!subscription) throw new Error("Prepared sponsored subscription was not found")
    if (subscription.status !== "WAIVED") {
      await waiveSubscription(prepared.subscription_id, session!.userId, {
        reason: `MartPoint Business Growth Programme sponsorship — ${id}${body.data.reason ? `; override: ${body.data.reason}` : ""}`,
        expires_at: subscription.current_period_end,
      })
    }
    const { data: waivedSubscription, error: subscriptionCheckError } = await supabase.from("subscriptions").select("status,invoice_id").eq("id", prepared.subscription_id).maybeSingle()
    if (subscriptionCheckError || !waivedSubscription || waivedSubscription.status !== "WAIVED" || !waivedSubscription.invoice_id) throw new Error("The finance service did not confirm the zero-value waived sponsorship record")
    const { data: waivedInvoice, error: invoiceCheckError } = await supabase.from("invoices").select("status,total_amount").eq("id", waivedSubscription.invoice_id).maybeSingle()
    if (invoiceCheckError || !waivedInvoice || waivedInvoice.status !== "WAIVED" || Number(waivedInvoice.total_amount) !== 0) throw new Error("The finance service did not confirm a zero-value waived invoice")
    const { data: licence, error: licenceError } = await supabase.from("business_licenses").select("id,status,plan_id,plan_code,max_branches,max_users,online_store_enabled,effective_from,expires_at,waived").eq("business_id", prepared.business_id).maybeSingle()
    if (licenceError || !licence || licence.status !== "ACTIVE" || !licence.waived) throw new Error("Licence system did not confirm an active waived licence")
    const entitlementSnapshot = { plan_id: licence.plan_id, plan_code: licence.plan_code, branches: licence.max_branches, users: licence.max_users, online_store: licence.online_store_enabled, effective_from: licence.effective_from, expires_at: licence.expires_at }
    const { error: saveError } = await supabase.from("business_growth_awards").update({ status: "ACTIVATED", fulfilment_status: "ACTIVE", business_id: prepared.business_id, subscription_id: prepared.subscription_id, licence_id: licence.id, entitlement_snapshot: entitlementSnapshot, activation_date: licence.effective_from, expiry_date: licence.expires_at, activation_error: null, updated_at: new Date().toISOString() }).eq("id", id)
    if (saveError) throw new Error("Licence activated, but programme record needs reconciliation: " + saveError.message)
    await supabase.from("businesses").update({ status: "ACTIVE", updated_at: new Date().toISOString() }).eq("id", prepared.business_id).eq("status", "ONBOARDING")
    await supabase.from("business_growth_events").insert({ programme_id: current.programme_id, application_id: current.application_id, award_id: id, actor_admin_user_id: session!.userId, event_type: "LICENCE_ACTIVATED", reason: body.data.reason || null, details: { business_id: prepared.business_id, subscription_id: prepared.subscription_id, licence_id: licence.id, entitlement_snapshot: entitlementSnapshot } })
    await supabase.from("admin_tasks").update({ status: "DONE", updated_at: new Date().toISOString() }).eq("entity_type", "BUSINESS_GROWTH_AWARD").eq("entity_id", id).eq("status", "OPEN")
    await supabase.from("business_growth_jobs").insert({ programme_id: current.programme_id, application_id: current.application_id, job_type: "SEND_NOTIFICATION", dedupe_key: `activated:${id}`, payload: { template: "ACTIVATED" } })
    return NextResponse.json({ success: true, licenceId: licence.id, expiryDate: licence.expires_at })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Licence activation failed"
    await supabase.from("business_growth_awards").update({ fulfilment_status: "FAILED", activation_error: message.slice(0, 1500), updated_at: new Date().toISOString() }).eq("id", id).neq("fulfilment_status", "ACTIVE")
    const { data: openTask } = await supabase.from("admin_tasks").select("id").eq("entity_type", "BUSINESS_GROWTH_AWARD").eq("entity_id", id).eq("status", "OPEN").limit(1).maybeSingle()
    if (!openTask) await supabase.from("admin_tasks").insert({ task_type: "CUSTOMER_ONBOARDING_REVIEW", title: "Resolve sponsored licence activation", description: message.slice(0, 1500), entity_type: "BUSINESS_GROWTH_AWARD", entity_id: id, status: "OPEN", deep_link: `/admin/programmes/${current.programme_id}` })
    await notifyAllAdmins({ type: "BUSINESS_GROWTH_ACTIVATION_FAILED", title: "Sponsored licence activation needs review", message: `${message}. No award is marked active unless the licence service confirms it.`, deep_link: `/admin/programmes/${current.programme_id}`, source_type: "BUSINESS_GROWTH_AWARD", source_id: id })
    return NextResponse.json({ error: "Activation did not complete. The award remains visible for retry or manual review." }, { status: 500 })
  }
}
