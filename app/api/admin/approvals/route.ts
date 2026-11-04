import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import { hasFinanceActionForUser } from "@/lib/finance-permissions"
import { ALL_ROLES } from "@/lib/admin-types"
import { hasEffectivePermission } from "@/lib/permission-overrides"
import { supabase } from "@/lib/supabase"
import { logFinanceAudit, syncInvoiceFinanceTransaction, removePaymentFinanceTransaction, waiveSubscription, confirmPayment, recordPayment } from "@/lib/finance-commercial"
import { postPaymentReversal, postPayoutJournal, voidEntriesForSource } from "@/lib/finance-ledger"
import { issuePayoutStatement } from "@/lib/partner-generated-docs"
import { notifyAdminUser } from "@/lib/admin-notifications"

export const dynamic = "force-dynamic"

const error = (message: string, status = 400) => NextResponse.json({ success: false, error: message }, { status })
const cleanIds = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : []
const isApprover = (policy: { approver_roles?: unknown; approver_user_ids?: unknown }, userId: string, role: string) =>
  cleanIds(policy.approver_roles).includes(role) || cleanIds(policy.approver_user_ids).includes(userId)

export async function GET() {
  const session = await getSession()
  if (!session) return error("Unauthorized", 401)
  const explicitDeny = await supabase.from("user_permission_overrides").select("effect").eq("user_id", session.userId).eq("permission_key", "approvals").maybeSingle()
  if (explicitDeny.data?.effect === "deny") return error("Approval inbox access is denied for this user", 403)
  const [requests, policies] = await Promise.all([
    supabase.from("approval_requests").select("*").order("requested_at", { ascending: false }).limit(300),
    supabase.from("approval_policies").select("*").order("label"),
  ])
  if (requests.error || policies.error) return error("Apply migration 167 to use approval workflows", 503)
  const financeAccess = await hasFinanceActionForUser(session.userId, session.role, "finance:view")
  const eligibleKeys = (policies.data || []).filter((policy) => policy.enabled && isApprover(policy, session.userId, session.role)).map((policy) => policy.action_key)
  const pageAccess = await hasEffectivePermission(session.userId, session.role, "approvals", hasPermission(session.role, "approvals"))
  if (!financeAccess && !eligibleKeys.length && !pageAccess) return error("Finance access or an approver assignment is required", 403)
  const fullFinanceInbox = financeAccess && ["Admin", "Finance"].includes(session.role)
  const visibleRequests = fullFinanceInbox ? requests.data || [] : (requests.data || []).filter((item) => item.requested_by === session.userId || eligibleKeys.includes(item.action_key))
  const users = session.role === "Admin"
    ? await supabase.from("users").select("id,name,username,role,status").eq("status", "ACTIVE").order("name")
    : { data: [] as { id: string; name: string; username: string; role: string; status: string }[], error: null }
  return NextResponse.json({ success: true, requests: visibleRequests, policies: policies.data || [], users: users.data || [], canManagePolicies: session.role === "Admin" })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return error("Unauthorized", 401)
  try {
    const body = await request.json() as Record<string, unknown>
    const action = String(body.action || "")
    if (action === "decide") {
      const explicitDeny = await supabase.from("user_permission_overrides").select("effect").eq("user_id", session.userId).eq("permission_key", "approvals").maybeSingle()
      if (explicitDeny.data?.effect === "deny") return error("Approval inbox access is denied for this user", 403)
    }
    if (!(["request_invoice_cancel", "decide"].includes(action)) && !await hasEffectivePermission(session.userId, session.role, "approvals", hasPermission(session.role, "approvals"))) return error("Approval inbox access is required", 403)
    if (action === "request_invoice_cancel") {
      if (!await hasFinanceActionForUser(session.userId, session.role, "finance:invoices:approval_request")) return error("You cannot request invoice approval", 403)
      const id = String(body.invoiceId || "")
      const reason = String(body.reason || "").trim()
      if (!id || reason.length < 5) return error("Invoice ID and a reason of at least 5 characters are required")
      const { data: policy, error: policyError } = await supabase.from("approval_policies").select("enabled").eq("action_key", "finance.invoice.cancel").maybeSingle()
      if (policyError) return error("Apply migration 167 to use invoice cancellation approvals", 503)
      if (!policy?.enabled) return error("Invoice cancellation approvals are not enabled")
      const { data: invoice, error: invoiceError } = await supabase.from("invoices").select("id,invoice_number,status,balance_due,businesses:business_id(business_name)").eq("id", id).maybeSingle()
      if (invoiceError || !invoice) return error("Invoice not found", 404)
      if (["CANCELLED", "VOID", "WAIVED", "PAID"].includes(String(invoice.status).toUpperCase())) return error("This invoice cannot be cancelled in its current state", 409)
      const business = Array.isArray(invoice.businesses) ? invoice.businesses[0] : invoice.businesses
      const inserted = await supabase.from("approval_requests").insert({
        action_key: "finance.invoice.cancel", entity_type: "INVOICE", entity_id: id,
        entity_reference: String(invoice.invoice_number || id), reason, details: { status_at_request: invoice.status, balance_due: invoice.balance_due, business_name: business?.business_name || "" },
        requested_by: session.userId, requested_by_name: session.name, requested_by_role: session.role,
      }).select().single()
      if (inserted.error) return error(inserted.error.code === "23505" ? "A cancellation request is already pending for this invoice" : "Could not create the approval request", inserted.error.code === "23505" ? 409 : 500)
      return NextResponse.json({ success: true, request: inserted.data })
    }

    if (action === "decide") {
      const id = String(body.requestId || "")
      const decision = String(body.decision || "")
      const note = String(body.note || "").trim()
      if (!id || !["APPROVED", "REJECTED"].includes(decision)) return error("Request and decision are required")
      if (decision === "REJECTED" && note.length < 5) return error("Add a reason of at least 5 characters when rejecting")
      const { data: approval, error: approvalError } = await supabase.from("approval_requests").select("*").eq("id", id).eq("status", "PENDING").maybeSingle()
      if (approvalError || !approval) return error("Pending approval request not found", 404)
      if (approval.requested_by === session.userId) return error("You cannot approve your own request", 403)
      const { data: policy, error: policyError } = await supabase.from("approval_policies").select("enabled,approver_roles,approver_user_ids").eq("action_key", approval.action_key).maybeSingle()
      if (policyError || !policy || !policy.enabled) return error("Approval policy is unavailable or disabled", 409)
      const allowedRoles = cleanIds(policy.approver_roles)
      const allowedUsers = cleanIds(policy.approver_user_ids)
      if (session.role !== "Admin" && !allowedRoles.includes(session.role) && !allowedUsers.includes(session.userId)) return error("You are not an approver for this action", 403)

      if (decision === "APPROVED" && approval.action_key === "quotation.send") {
        const { data: quote, error: quoteError } = await supabase.from("lead_quotations").select("id,status,updated_at,creator_id,quote_number").eq("id", approval.entity_id).maybeSingle()
        if (quoteError || !quote || quote.status !== "DRAFT" || quote.creator_id !== approval.requested_by || quote.updated_at !== approval.details?.quote_updated_at) return error("This quote changed or is no longer a draft. The creator must resubmit it.", 409)
        const changed = await supabase.from("lead_quotations").update({ approval_status: "APPROVED", approved_by: session.userId, approved_at: new Date().toISOString() }).eq("id", approval.entity_id).eq("updated_at", quote.updated_at).select("id").maybeSingle()
        if (changed.error || !changed.data) return error("The quote approval could not be applied", 409)
        await logFinanceAudit("ADMIN", session.userId, "QUOTE_APPROVAL_APPROVED", "LEAD_QUOTATION", String(approval.entity_id), { approval_request_id: id, requested_by: approval.requested_by, quote_number: quote.quote_number, reason: approval.reason })
        await notifyAdminUser({ admin_user_id: approval.requested_by, type: "QUOTATION_APPROVED", title: `Quotation ${quote.quote_number} approved`, message: "It is back in your drafts and ready for you to email to the client.", deep_link: "/admin/quotations", source_type: "LEAD_QUOTATION", source_id: String(approval.entity_id), actor_admin_user_id: session.userId })
      } else if (decision === "APPROVED" && ["finance.invoice.cancel", "finance.invoice.void", "finance.invoice.waive"].includes(approval.action_key)) {
        const current = await supabase.from("invoices").select("id,status,invoice_number").eq("id", approval.entity_id).maybeSingle()
        if (current.error || !current.data || ["CANCELLED", "VOID", "WAIVED", "PAID"].includes(String(current.data.status).toUpperCase())) return error("The invoice changed since the request. Review its current state before deciding.", 409)
        const status = approval.action_key === "finance.invoice.cancel" ? "CANCELLED" : approval.action_key === "finance.invoice.void" ? "VOID" : approval.action_key === "finance.invoice.waive" ? "WAIVED" : null
        if (!status) return error("This approval action has no apply handler", 409)
        const patch = status === "WAIVED"
          ? { status, waived_at: new Date().toISOString(), waived_by: session.userId, waive_reason: approval.reason, updated_at: new Date().toISOString() }
          : { status, updated_at: new Date().toISOString() }
        const applied = await supabase.from("invoices").update(patch).eq("id", approval.entity_id).eq("status", current.data.status).select("id").maybeSingle()
        if (applied.error || !applied.data) return error("The approved invoice action could not be applied", 409)
        await syncInvoiceFinanceTransaction(String(approval.entity_id))
        const auditAction = status === "CANCELLED" ? "INVOICE_CANCELLATION_APPROVED" : status === "VOID" ? "INVOICE_VOID_APPROVED" : "INVOICE_WAIVER_APPROVED"
        await logFinanceAudit("ADMIN", session.userId, auditAction, "INVOICE", String(approval.entity_id), { approval_request_id: id, requested_by: approval.requested_by, reason: approval.reason })
      } else if (decision === "APPROVED" && ["finance.invoice.update", "finance.invoice.delete"].includes(approval.action_key)) {
        const { data: current, error: currentError } = await supabase.from("invoices").select("id,status,updated_at,invoice_number,amount_paid").eq("id", approval.entity_id).maybeSingle()
        if (currentError || !current || current.status !== approval.details?.status_at_request || (approval.details?.updated_at_at_request && current.updated_at !== approval.details.updated_at_at_request)) return error("The invoice changed since the request. Review it again before deciding.", 409)
        if (approval.action_key === "finance.invoice.delete") {
          if (current.status !== "DRAFT" || Number(current.amount_paid) > 0) return error("Only an unpaid draft invoice can be deleted", 409)
          await voidEntriesForSource("INVOICE", String(approval.entity_id))
          await supabase.from("finance_transactions").delete().eq("invoice_id", approval.entity_id)
          await supabase.from("invoice_items").delete().eq("invoice_id", approval.entity_id)
          await supabase.from("payment_allocations").delete().eq("invoice_id", approval.entity_id)
          await supabase.from("payments").update({ invoice_id: null, updated_at: new Date().toISOString() }).eq("invoice_id", approval.entity_id)
          const removed = await supabase.from("invoices").delete().eq("id", approval.entity_id).select("id").maybeSingle()
          if (removed.error || !removed.data) return error("The approved invoice deletion could not be applied", 409)
          await logFinanceAudit("ADMIN", session.userId, "INVOICE_DELETED", "INVOICE", String(approval.entity_id), { approval_request_id: id, requested_by: approval.requested_by, reason: approval.reason })
        } else {
          const payload = (approval.details?.payload || {}) as Record<string, unknown>
          const updates = payload
          if (Array.isArray(updates.items) && (updates.items as Record<string, unknown>[]).some((item) => !String(item.description || "").trim())) return error("Every invoice line needs a description", 409)
          const meta: Record<string, unknown> = {}
          for (const key of ["issue_date", "due_date", "currency", "notes_public", "notes_internal", "payment_terms", "bank_details", "template_industry"]) if (key in updates) meta[key] = updates[key]
          const saved = await supabase.from("invoices").update({ ...meta, updated_at: new Date().toISOString() }).eq("id", approval.entity_id).eq("status", current.status).select("id").maybeSingle()
          if (saved.error || !saved.data) return error("The approved invoice change could not be applied", 409)
          if (Array.isArray(updates.items)) {
            const items = updates.items as Record<string, unknown>[]
            const existing = await supabase.from("invoice_items").select("id").eq("invoice_id", approval.entity_id)
            if (existing.error) return error("Invoice items could not be loaded", 409)
            const keepIds = new Set(items.filter((item) => item.id).map((item) => String(item.id)))
            const removed = (existing.data || []).map((item) => item.id).filter((item) => !keepIds.has(item))
            if (removed.length) await supabase.from("invoice_items").delete().in("id", removed)
            for (const item of items) {
              const quantity = Number(item.quantity) || 0
              const unitPrice = Number(item.unit_price) || 0
              const discount = Number(item.discount) || 0
              const tax = Number(item.tax) || 0
              const row = { item_type: item.item_type || "CUSTOM", reference_id: item.reference_id || null, description: item.description, quantity, unit_price: unitPrice, discount, tax, line_total: Math.round((quantity * unitPrice - discount + tax) * 100) / 100 }
              const result = item.id
                ? await supabase.from("invoice_items").update(row).eq("id", String(item.id)).eq("invoice_id", approval.entity_id)
                : await supabase.from("invoice_items").insert({ ...row, invoice_id: approval.entity_id })
              if (result.error) return error("An approved invoice line could not be saved", 409)
            }
          }
          await syncInvoiceFinanceTransaction(String(approval.entity_id))
          await logFinanceAudit("ADMIN", session.userId, "INVOICE_UPDATED", "INVOICE", String(approval.entity_id), { approval_request_id: id, requested_by: approval.requested_by, reason: approval.reason })
        }
      } else if (decision === "APPROVED" && approval.action_key === "finance.payment.record") {
        const payload = (approval.details?.payload || {}) as Record<string, unknown>
        const businessId = String(payload.business_id || "")
        const amount = Number(payload.amount)
        if (!businessId || !Number.isFinite(amount) || amount <= 0) return error("Payment request data is invalid", 409)
        const created = await recordPayment({
          business_id: businessId,
          ...(payload.invoice_id ? { invoice_id: String(payload.invoice_id) } : {}),
          amount,
          currency: String(payload.currency || "NGN"),
          payment_method: String(payload.payment_method || "OTHER") as Parameters<typeof recordPayment>[0]["payment_method"],
          paid_at: String(payload.paid_at || new Date().toISOString()),
          notes: String(payload.notes || ""),
        })
        await confirmPayment(String(created.id), session.userId, session.userId, String(payload.payment_account_id || "") || undefined)
        await logFinanceAudit("ADMIN", session.userId, "PAYMENT_CONFIRMED", "PAYMENT", String(created.id), { approval_request_id: id, requested_by: approval.requested_by, reason: approval.reason, amount })
      } else if (decision === "APPROVED" && approval.action_key === "finance.payment.confirm") {
        const payload = (approval.details?.payload || {}) as Record<string, unknown>
        const { data: payment } = await supabase.from("payments").select("id,status").eq("id", approval.entity_id).maybeSingle()
        if (!payment || payment.status !== "PENDING") return error("Payment changed since the request", 409)
        await confirmPayment(String(approval.entity_id), session.userId, session.userId, String(payload.payment_account_id || "") || undefined)
        await logFinanceAudit("ADMIN", session.userId, "PAYMENT_CONFIRMATION_APPROVED", "PAYMENT", String(approval.entity_id), { approval_request_id: id, requested_by: approval.requested_by, reason: approval.reason })
      } else if (decision === "APPROVED" && approval.action_key === "finance.payment.reverse") {
        const { data: payment } = await supabase.from("payments").select("id,status").eq("id", approval.entity_id).maybeSingle()
        if (!payment || ["REVERSED", "REJECTED"].includes(String(payment.status).toUpperCase())) return error("Payment changed since the request", 409)
        const changed = await supabase.from("payments").update({ status: "REVERSED", updated_at: new Date().toISOString() }).eq("id", approval.entity_id).eq("status", payment.status).select("id").maybeSingle()
        if (changed.error || !changed.data) return error("Payment reversal could not be applied", 409)
        await removePaymentFinanceTransaction(String(approval.entity_id))
        await postPaymentReversal(String(approval.entity_id))
        await logFinanceAudit("ADMIN", session.userId, "PAYMENT_REVERSAL_APPROVED", "PAYMENT", String(approval.entity_id), { approval_request_id: id, requested_by: approval.requested_by, reason: approval.reason })
      } else if (decision === "APPROVED" && approval.action_key === "finance.subscription.waive") {
        const payload = (approval.details?.payload || {}) as Record<string, unknown>
        const { data: subscription } = await supabase.from("subscriptions").select("id,status").eq("id", approval.entity_id).maybeSingle()
        if (!subscription || ["CANCELLED", "WAIVED"].includes(String(subscription.status).toUpperCase())) return error("Subscription changed since the request", 409)
        await waiveSubscription(String(approval.entity_id), session.userId, { ...payload, reason: approval.reason })
        await logFinanceAudit("ADMIN", session.userId, "SUBSCRIPTION_WAIVER_APPROVED", "SUBSCRIPTION", String(approval.entity_id), { approval_request_id: id, requested_by: approval.requested_by, reason: approval.reason })
      } else if (decision === "APPROVED" && ["finance.subscription.suspend", "finance.subscription.cancel"].includes(approval.action_key)) {
        const targetStatus = approval.action_key.endsWith("suspend") ? "SUSPENDED" : "CANCELLED"
        const { data: subscription, error: subscriptionError } = await supabase.from("subscriptions").select("id,status").eq("id", approval.entity_id).maybeSingle()
        if (subscriptionError || !subscription || ["CANCELLED", "WAIVED"].includes(String(subscription.status).toUpperCase())) return error("Subscription changed since the request", 409)
        const changed = await supabase.from("subscriptions").update({ status: targetStatus, updated_at: new Date().toISOString() }).eq("id", approval.entity_id).eq("status", subscription.status).select("id").maybeSingle()
        if (changed.error || !changed.data) return error("Subscription action could not be applied", 409)
        await logFinanceAudit("ADMIN", session.userId, `SUBSCRIPTION_${targetStatus}_APPROVED`, "SUBSCRIPTION", String(approval.entity_id), { approval_request_id: id, requested_by: approval.requested_by, reason: approval.reason })
      } else if (decision === "APPROVED" && approval.action_key === "finance.commission.approve") {
        const { data: commission } = await supabase.from("partner_commissions").select("id,status,earning_kind").eq("id", approval.entity_id).maybeSingle()
        if (!commission || commission.status !== "PENDING") return error("Commission changed since the request", 409)
        if (commission.earning_kind) {
          const { approveReferralCommission } = await import("@/lib/referral-finance")
          const result = await approveReferralCommission(String(approval.entity_id), { actorId: session.userId, actorName: session.name })
          if (!result.ok) return error(result.error || "Commission could not be approved", 409)
        } else {
          const changed = await supabase.from("partner_commissions").update({ status: "APPROVED", approved_at: new Date().toISOString(), approved_by: session.userId, updated_at: new Date().toISOString() }).eq("id", approval.entity_id).eq("status", "PENDING").select("id").maybeSingle()
          if (changed.error || !changed.data) return error("Commission could not be approved", 409)
        }
        await logFinanceAudit("ADMIN", session.userId, "COMMISSION_APPROVAL_APPROVED", "PARTNER_COMMISSION", String(approval.entity_id), { approval_request_id: id, requested_by: approval.requested_by, reason: approval.reason })
      } else if (decision === "APPROVED" && approval.action_key === "finance.payout.mark_paid") {
        const payload = (approval.details?.payload || {}) as Record<string, unknown>
        const { data: payout } = await supabase.from("commission_payouts").select("id,status").eq("id", approval.entity_id).maybeSingle()
        if (!payout || payout.status === "PAID" || payout.status === "CANCELLED") return error("Payout changed since the request", 409)
        const changed = await supabase.from("commission_payouts").update({ status: "PAID", bank_reference: payload.bank_reference || null, ...(payload.payment_account_id ? { payment_account_id: payload.payment_account_id } : {}), paid_by: session.userId, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", approval.entity_id).eq("status", payout.status).select("id").maybeSingle()
        if (changed.error || !changed.data) return error("Payout could not be marked paid", 409)
        await supabase.from("partner_payout_requests").update({ status: "PAID", updated_at: new Date().toISOString() }).eq("payout_id", approval.entity_id)
        await import("@/lib/referral-finance").then(({ markReferralCommissionsPaid }) => markReferralCommissionsPaid(String(approval.entity_id), { actorId: session.userId, actorName: session.name }))
        await postPayoutJournal(String(approval.entity_id))
        await issuePayoutStatement(String(approval.entity_id), session.userId)
        await logFinanceAudit("ADMIN", session.userId, "COMMISSION_PAYOUT_PAYMENT_APPROVED", "COMMISSION_PAYOUT", String(approval.entity_id), { approval_request_id: id, requested_by: approval.requested_by, reason: approval.reason })
      } else if (decision === "APPROVED") {
        return error("This approval action has no apply handler", 409)
      }
      const saved = await supabase.from("approval_requests").update({
        status: decision, decided_by: session.userId, decided_by_name: session.name,
        decision_note: note || null, decided_at: new Date().toISOString(), applied_at: decision === "APPROVED" ? new Date().toISOString() : null,
      }).eq("id", id).eq("status", "PENDING").select().maybeSingle()
      if (saved.error || !saved.data) return error("The decision was not saved. Refresh the inbox before trying again.", 409)
      if (decision === "REJECTED" && approval.action_key === "quotation.send") {
        await supabase.from("lead_quotations").update({ approval_status: "REJECTED" }).eq("id", approval.entity_id).eq("status", "DRAFT").eq("updated_at", approval.details?.quote_updated_at)
        await logFinanceAudit("ADMIN", session.userId, "QUOTE_APPROVAL_REJECTED", "LEAD_QUOTATION", String(approval.entity_id), { approval_request_id: id, requested_by: approval.requested_by, reason: approval.reason, note })
        await notifyAdminUser({ admin_user_id: approval.requested_by, type: "QUOTATION_REJECTED", title: `Quotation ${approval.entity_reference} needs changes`, message: note || "An approver declined the quote. Edit it and resubmit for approval.", deep_link: "/admin/quotations", source_type: "LEAD_QUOTATION", source_id: String(approval.entity_id), actor_admin_user_id: session.userId })
      }
      return NextResponse.json({ success: true, request: saved.data })
    }

    if (action === "save_policy") {
      if (session.role !== "Admin") return error("Only Admin can configure approval policies", 403)
      const key = String(body.actionKey || "")
      const enabled = body.enabled === true
      const approverRoles = cleanIds(body.approverRoles)
      const approverUserIds = cleanIds(body.approverUserIds)
      const allowedKeys = new Set(["quotation.send", "finance.invoice.cancel", "finance.invoice.void", "finance.invoice.waive", "finance.invoice.update", "finance.invoice.delete", "finance.payment.record", "finance.payment.confirm", "finance.payment.reverse", "finance.subscription.waive", "finance.subscription.suspend", "finance.subscription.cancel", "finance.commission.approve", "finance.payout.mark_paid"])
      if (!allowedKeys.has(key)) return error("Unknown approval action")
      if (approverRoles.some((role) => !ALL_ROLES.includes(role as typeof ALL_ROLES[number]))) return error("One or more approver roles are invalid")
      if (enabled && !approverRoles.length && !approverUserIds.length) return error("Choose at least one approver role or staff member")
      if (approverUserIds.length) {
        const approvers = await supabase.from("users").select("id").eq("status", "ACTIVE").in("id", approverUserIds)
        if (approvers.error || approvers.data?.length !== approverUserIds.length) return error("Choose active staff members as individual approvers")
      }
      const { data, error: saveError } = await supabase.from("approval_policies").update({ enabled, approver_roles: approverRoles, approver_user_ids: approverUserIds, updated_by: session.userId, updated_at: new Date().toISOString() }).eq("action_key", key).select().single()
      if (saveError) return error("Could not save the approval policy", 500)
      return NextResponse.json({ success: true, policy: data })
    }
    return error("Unknown approval action")
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Approval request failed", 500)
  }
}
