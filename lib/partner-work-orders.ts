import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "./audit"
import { issueWorkOrderDocument, issueChangeOrderDocument, issueCompletionHandoverDocument } from "./partner-generated-docs"

/* ───────────────────────────  Implementation work orders  ───────────────────────────
 * Blueprint rules enforced here:
 * - No billable work without an ISSUED + partner-accepted work order.
 * - Milestones require submitted evidence and a named acceptance before the
 *   fee becomes an earning (a partner_commissions row on the internal
 *   Implementation Fee plan — status ELIGIBLE, awaiting Finance review).
 * - Scope/fee/date changes require an approved Change Order.
 */

export type WorkOrderStatus = "DRAFT" | "ISSUED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED" | "CANCELLED"
export type MilestoneStatus = "PENDING" | "SUBMITTED" | "ACCEPTED" | "REJECTED"

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued — awaiting partner acceptance",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
}

const IMPL_FEE_PLAN_NAME = "Internal Implementation Fee"

function now() {
  return new Date().toISOString()
}

async function generateWorkOrderRef(): Promise<string> {
  const year = new Date().getFullYear()
  if (!isSupabaseConfigured()) {
    return `WO-${year}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
  }
  const { data, error } = await supabase.rpc("increment_partner_work_order_seq")
  if (error || !data) {
    const { count } = await supabase.from("partner_work_orders").select("id", { count: "exact", head: true })
    return `WO-${year}-${String((count ?? 0) + 1).padStart(5, "0")}`
  }
  return `WO-${year}-${String(data as number).padStart(5, "0")}`
}

export interface WorkOrderMilestoneInput {
  title: string
  description?: string
  orderIndex?: number
  dueDate?: string | null
  feeAmount?: number | null
  currency?: string
  acceptanceCriteria?: string
}

export interface WorkOrderInput {
  partnerId: string
  assignmentId?: string | null
  businessId?: string | null
  title: string
  scope: string
  exclusions?: string
  acceptanceCriteria?: string
  customerDuties?: string
  accessNotes?: string
  feeTotal?: number | null
  currency?: string
  startsAt?: string | null
  dueAt?: string | null
  milestones?: WorkOrderMilestoneInput[]
}

export async function createWorkOrder(
  input: WorkOrderInput,
  createdBy: string
): Promise<{ ok: boolean; error?: string; workOrder?: Record<string, unknown> }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  if (!input.scope?.trim()) return { ok: false, error: "Scope is required" }

  // A draft ref is assigned now and kept stable; it identifies the WO on the PDF.
  const ref = await generateWorkOrderRef()
  const { data: wo, error } = await supabase
    .from("partner_work_orders")
    .insert({
      work_order_ref: ref,
      partner_id: input.partnerId,
      assignment_id: input.assignmentId ?? null,
      business_id: input.businessId ?? null,
      title: input.title.trim(),
      scope: input.scope.trim(),
      exclusions: input.exclusions ?? null,
      acceptance_criteria: input.acceptanceCriteria ?? null,
      customer_duties: input.customerDuties ?? null,
      access_notes: input.accessNotes ?? null,
      fee_total: input.feeTotal ?? null,
      currency: input.currency || "NGN",
      status: "DRAFT" as WorkOrderStatus,
      starts_at: input.startsAt ?? null,
      due_at: input.dueAt ?? null,
      created_by: createdBy,
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single()
  if (error || !wo) return { ok: false, error: "Failed to create work order" }

  if (input.milestones?.length) {
    const rows = input.milestones.map((m, i) => ({
      work_order_id: wo.id,
      title: m.title,
      description: m.description ?? null,
      order_index: m.orderIndex ?? i,
      due_date: m.dueDate ?? null,
      fee_amount: m.feeAmount ?? null,
      currency: m.currency || input.currency || "NGN",
      acceptance_criteria: m.acceptanceCriteria ?? null,
      status: "PENDING" as MilestoneStatus,
      created_at: now(),
      updated_at: now(),
    }))
    const { error: mErr } = await supabase.from("partner_work_order_milestones").insert(rows)
    if (mErr) return { ok: false, error: "Work order created but milestones failed", workOrder: wo }
  }

  await recordAudit(
    { actorType: "ADMIN", actorId: createdBy },
    {
      action: AUDIT_ACTIONS.PARTNER_WORK_ORDER_CREATED,
      entityType: AUDIT_ENTITIES.PARTNER_WORK_ORDER,
      entityId: wo.id as string,
      metadata: { partnerId: input.partnerId, workOrderRef: ref, milestoneCount: input.milestones?.length || 0 },
    }
  )
  return { ok: true, workOrder: wo }
}

/** Issue a draft work order: generates the Work Order PDF and awaits partner acceptance. */
export async function issueWorkOrder(
  workOrderId: string,
  issuedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: wo } = await supabase.from("partner_work_orders").select("*").eq("id", workOrderId).single()
  if (!wo) return { ok: false, error: "Work order not found" }
  if (wo.status !== "DRAFT") return { ok: false, error: "Only draft work orders can be issued" }

  // Hard gate: implementation work requires a partner-accepted Customer
  // Assignment when the work order is linked to one.
  if (wo.assignment_id) {
    const { data: assignment } = await supabase
      .from("partner_customer_assignments")
      .select("status, partner_accepted_at")
      .eq("id", wo.assignment_id as string)
      .single()
    if (!assignment || assignment.status !== "ACTIVE" || !assignment.partner_accepted_at) {
      return { ok: false, error: "The customer assignment must be accepted by the partner before this work order can be issued" }
    }
  }

  const { error } = await supabase
    .from("partner_work_orders")
    .update({ status: "ISSUED", issued_at: now(), issued_by: issuedBy, updated_at: now() })
    .eq("id", workOrderId)
  if (error) return { ok: false, error: "Failed to issue work order" }

  try {
    const doc = await issueWorkOrderDocument(workOrderId, issuedBy)
    if (doc.ok && doc.document) {
      await supabase
        .from("partner_work_orders")
        .update({ generated_document_id: doc.document.id, updated_at: now() })
        .eq("id", workOrderId)
    }
  } catch (e) {
    console.error("[work-orders] document generation failed:", e)
  }

  await recordAudit(
    { actorType: "ADMIN", actorId: issuedBy },
    {
      action: AUDIT_ACTIONS.PARTNER_WORK_ORDER_ISSUED,
      entityType: AUDIT_ENTITIES.PARTNER_WORK_ORDER,
      entityId: workOrderId,
      metadata: { partnerId: wo.partner_id, workOrderRef: wo.work_order_ref },
    }
  )
  return { ok: true }
}

/* ─── Partner-side actions ─── */

export async function listPartnerWorkOrders(partnerId: string): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("partner_work_orders")
    .select("*, businesses(business_name), partner_work_order_milestones(*), partner_change_orders(*)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
  return (data || []) as Record<string, unknown>[]
}

export async function getPartnerWorkOrder(
  workOrderId: string,
  partnerId: string
): Promise<{ workOrder: Record<string, unknown>; milestones: Record<string, unknown>[]; changeOrders: Record<string, unknown>[] } | null> {
  if (!isSupabaseConfigured()) return null
  const { data: wo } = await supabase
    .from("partner_work_orders")
    .select("*, businesses(business_name), partner_generated_documents(document_id)")
    .eq("id", workOrderId)
    .eq("partner_id", partnerId)
    .single()
  if (!wo) return null
  const [{ data: milestones }, { data: changeOrders }] = await Promise.all([
    supabase.from("partner_work_order_milestones").select("*").eq("work_order_id", workOrderId).order("order_index", { ascending: true }),
    supabase.from("partner_change_orders").select("*").eq("work_order_id", workOrderId).order("created_at", { ascending: false }),
  ])
  return { workOrder: wo, milestones: (milestones || []) as Record<string, unknown>[], changeOrders: (changeOrders || []) as Record<string, unknown>[] }
}

/** Partner principal accepts an issued work order → ACCEPTED, work may begin. */
export async function acknowledgeWorkOrder(
  workOrderId: string,
  partnerId: string,
  user: { id: string; name: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: wo } = await supabase
    .from("partner_work_orders")
    .select("id, status")
    .eq("id", workOrderId)
    .eq("partner_id", partnerId)
    .single()
  if (!wo) return { ok: false, error: "Work order not found" }
  if (wo.status !== "ISSUED") return { ok: false, error: "Work order is not awaiting acceptance" }

  const { error } = await supabase
    .from("partner_work_orders")
    .update({ status: "ACCEPTED", partner_acknowledged_at: now(), partner_acknowledged_by: user.id, updated_at: now() })
    .eq("id", workOrderId)
  if (error) return { ok: false, error: "Failed to accept work order" }

  await recordAudit(
    { actorType: "PARTNER", actorId: user.id },
    {
      action: AUDIT_ACTIONS.PARTNER_WORK_ORDER_ACCEPTED,
      entityType: AUDIT_ENTITIES.PARTNER_WORK_ORDER,
      entityId: workOrderId,
      metadata: { partnerId, acceptedByName: user.name },
    }
  )
  return { ok: true }
}

/** Partner marks delivery started (ACCEPTED → IN_PROGRESS). */
export async function startWorkOrder(
  workOrderId: string,
  partnerId: string,
  user: { id: string; name: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { error } = await supabase
    .from("partner_work_orders")
    .update({ status: "IN_PROGRESS", updated_at: now() })
    .eq("id", workOrderId)
    .eq("partner_id", partnerId)
    .eq("status", "ACCEPTED")
  if (error) return { ok: false, error: "Work order must be accepted before work starts" }
  await recordAudit(
    { actorType: "PARTNER", actorId: user.id },
    { action: AUDIT_ACTIONS.PARTNER_WORK_ORDER_STARTED, entityType: AUDIT_ENTITIES.PARTNER_WORK_ORDER, entityId: workOrderId, metadata: { partnerId } }
  )
  return { ok: true }
}

/** Partner submits milestone evidence for MartPoint review. */
export async function submitMilestoneEvidence(
  milestoneId: string,
  partnerId: string,
  user: { id: string; name: string },
  input: { evidenceText?: string; evidenceUrl?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: ms } = await supabase
    .from("partner_work_order_milestones")
    .select("*, partner_work_orders!inner(partner_id, status, assignment_id)")
    .eq("id", milestoneId)
    .single()
  if (!ms) return { ok: false, error: "Milestone not found" }
  const wo = ms.partner_work_orders as Record<string, unknown>
  if (wo.partner_id !== partnerId) return { ok: false, error: "Milestone not found" }
  if (!["ACCEPTED", "IN_PROGRESS"].includes(wo.status as string)) {
    return { ok: false, error: "Work order must be accepted before submitting evidence" }
  }
  if (wo.assignment_id) {
    const { data: assignment } = await supabase
      .from("partner_customer_assignments")
      .select("partner_accepted_at")
      .eq("id", wo.assignment_id as string)
      .single()
    if (!assignment?.partner_accepted_at) {
      return { ok: false, error: "The customer assignment must be accepted before billable work" }
    }
  }
  if (!["PENDING", "REJECTED"].includes(ms.status as string)) {
    return { ok: false, error: "Milestone is not awaiting submission" }
  }

  const { error } = await supabase
    .from("partner_work_order_milestones")
    .update({
      status: "SUBMITTED",
      evidence_text: input.evidenceText ?? null,
      evidence_url: input.evidenceUrl ?? null,
      submitted_by: user.id,
      submitted_at: now(),
      updated_at: now(),
    })
    .eq("id", milestoneId)
  if (error) return { ok: false, error: "Failed to submit evidence" }

  // Move the work order into progress on first submission.
  if (wo.status === "ACCEPTED") {
    await supabase.from("partner_work_orders").update({ status: "IN_PROGRESS", updated_at: now() }).eq("id", ms.work_order_id)
  }

  await recordAudit(
    { actorType: "PARTNER", actorId: user.id },
    {
      action: AUDIT_ACTIONS.PARTNER_MILESTONE_SUBMITTED,
      entityType: AUDIT_ENTITIES.PARTNER_WORK_ORDER_MILESTONE,
      entityId: milestoneId,
      metadata: { partnerId, workOrderId: ms.work_order_id, submittedByName: user.name },
    }
  )
  return { ok: true }
}

/** Partner requests a change order on an issued/accepted/in-progress work order. */
export async function requestChangeOrder(
  workOrderId: string,
  partnerId: string,
  user: { id: string; name: string },
  input: { description: string; reason?: string; impactScope?: string; impactFee?: number | null; impactSchedule?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  if (!input.description?.trim()) return { ok: false, error: "Description is required" }
  const { data: wo } = await supabase
    .from("partner_work_orders")
    .select("id, status")
    .eq("id", workOrderId)
    .eq("partner_id", partnerId)
    .single()
  if (!wo) return { ok: false, error: "Work order not found" }
  if (!["ISSUED", "ACCEPTED", "IN_PROGRESS"].includes(wo.status as string)) {
    return { ok: false, error: "Changes can only be requested on an open work order" }
  }

  const { data, error } = await supabase
    .from("partner_change_orders")
    .insert({
      work_order_id: workOrderId,
      requested_by_type: "PARTNER",
      requested_by: user.id,
      description: input.description.trim(),
      reason: input.reason ?? null,
      impact_scope: input.impactScope ?? null,
      impact_fee: input.impactFee ?? null,
      impact_schedule: input.impactSchedule ?? null,
      status: "PENDING",
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: "Failed to submit change request" }

  await recordAudit(
    { actorType: "PARTNER", actorId: user.id },
    {
      action: AUDIT_ACTIONS.PARTNER_CHANGE_ORDER_REQUESTED,
      entityType: AUDIT_ENTITIES.PARTNER_CHANGE_ORDER,
      entityId: data.id as string,
      metadata: { partnerId, workOrderId, requestedByName: user.name },
    }
  )
  return { ok: true }
}

/* ─── Admin-side review ─── */

async function internalFeePlanId(): Promise<string | null> {
  const { data } = await supabase
    .from("commission_plans")
    .select("id")
    .eq("name", IMPL_FEE_PLAN_NAME)
    .eq("applies_to", "IMPLEMENTATION")
    .limit(1)
    .maybeSingle()
  return (data?.id as string) ?? null
}

/** MartPoint reviews a submitted milestone. ACCEPTED turns the fee into an ELIGIBLE earning. */
export async function reviewMilestone(
  milestoneId: string,
  decision: "ACCEPTED" | "REJECTED",
  notes: string | null,
  reviewerId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  if (decision === "REJECTED" && !notes?.trim()) return { ok: false, error: "A reason is required when rejecting" }

  const { data: ms } = await supabase
    .from("partner_work_order_milestones")
    .select("*, partner_work_orders(partner_id, business_id, work_order_ref, status)")
    .eq("id", milestoneId)
    .single()
  if (!ms) return { ok: false, error: "Milestone not found" }
  if (ms.status !== "SUBMITTED") return { ok: false, error: "Milestone is not awaiting review" }
  const wo = ms.partner_work_orders as Record<string, unknown>

  const update: Record<string, unknown> = {
    status: decision,
    reviewed_by: reviewerId,
    reviewed_at: now(),
    review_notes: notes ?? null,
    updated_at: now(),
  }

  let commissionId: string | null = null
  if (decision === "ACCEPTED" && ms.fee_amount != null && Number(ms.fee_amount) > 0) {
    if (!wo.business_id) return { ok: false, error: "Work order has no customer — cannot book the fee" }
    const planId = await internalFeePlanId()
    if (!planId) return { ok: false, error: "Internal Implementation Fee plan missing — run migration 058" }
    const { data: comm, error: cErr } = await supabase
      .from("partner_commissions")
      .insert({
        partner_id: wo.partner_id,
        business_id: wo.business_id,
        commission_plan_id: planId,
        basis_amount: ms.fee_amount,
        fixed_amount: ms.fee_amount,
        commission_amount: ms.fee_amount,
        currency: ms.currency || "NGN",
        status: "ELIGIBLE",
        earned_at: now(),
        attribution_type: "IMPLEMENTATION",
        created_at: now(),
        updated_at: now(),
      })
      .select("id")
      .single()
    if (cErr || !comm) return { ok: false, error: "Failed to create fee earning" }
    commissionId = comm.id as string
    update.commission_id = commissionId
  }

  const { error } = await supabase.from("partner_work_order_milestones").update(update).eq("id", milestoneId)
  if (error) return { ok: false, error: "Failed to record decision" }

  await recordAudit(
    { actorType: "ADMIN", actorId: reviewerId },
    {
      action: decision === "ACCEPTED" ? AUDIT_ACTIONS.PARTNER_MILESTONE_ACCEPTED : AUDIT_ACTIONS.PARTNER_MILESTONE_REJECTED,
      entityType: AUDIT_ENTITIES.PARTNER_WORK_ORDER_MILESTONE,
      entityId: milestoneId,
      metadata: { workOrderId: ms.work_order_id, workOrderRef: wo.work_order_ref, partnerId: wo.partner_id, commissionId, notes },
    }
  )

  // If every milestone is accepted, mark the work order completed.
  const { data: remaining } = await supabase
    .from("partner_work_order_milestones")
    .select("id")
    .eq("work_order_id", ms.work_order_id)
    .neq("status", "ACCEPTED")
  if ((remaining || []).length === 0) {
    await supabase
      .from("partner_work_orders")
      .update({ status: "COMPLETED", completed_at: now(), updated_at: now() })
      .eq("id", ms.work_order_id)
      .in("status", ["ACCEPTED", "IN_PROGRESS"])
    try {
      await issueCompletionHandoverDocument(ms.work_order_id as string, reviewerId)
    } catch (e) {
      console.error("[work-orders] completion record failed:", e)
    }
  }

  return { ok: true }
}

/** MartPoint decides a change order. APPROVED issues the Change Order PDF and applies the fee delta. */
export async function decideChangeOrder(
  changeOrderId: string,
  decision: "APPROVED" | "REJECTED" | "DEFERRED",
  decisionReason: string | null,
  decidedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: co } = await supabase.from("partner_change_orders").select("*").eq("id", changeOrderId).single()
  if (!co) return { ok: false, error: "Change order not found" }
  if (co.status !== "PENDING") return { ok: false, error: "Change order already decided" }

  const { error } = await supabase
    .from("partner_change_orders")
    .update({ status: decision, decided_by: decidedBy, decided_at: now(), decision_reason: decisionReason ?? null, updated_at: now() })
    .eq("id", changeOrderId)
  if (error) return { ok: false, error: "Failed to record decision" }

  if (decision === "APPROVED") {
    if (co.impact_fee != null && Number(co.impact_fee) !== 0) {
      const { data: wo } = await supabase.from("partner_work_orders").select("fee_total").eq("id", co.work_order_id).single()
      const newTotal = (Number(wo?.fee_total) || 0) + Number(co.impact_fee)
      await supabase.from("partner_work_orders").update({ fee_total: newTotal, updated_at: now() }).eq("id", co.work_order_id)
    }
    try {
      const doc = await issueChangeOrderDocument(changeOrderId, decidedBy)
      if (doc.ok && doc.document) {
        await supabase.from("partner_change_orders").update({ generated_document_id: doc.document.id, updated_at: now() }).eq("id", changeOrderId)
      }
    } catch (e) {
      console.error("[work-orders] change order document failed:", e)
    }
  }

  await recordAudit(
    { actorType: "ADMIN", actorId: decidedBy },
    {
      action: AUDIT_ACTIONS.PARTNER_CHANGE_ORDER_DECIDED,
      entityType: AUDIT_ENTITIES.PARTNER_CHANGE_ORDER,
      entityId: changeOrderId,
      metadata: { workOrderId: co.work_order_id, decision, decisionReason },
    }
  )
  return { ok: true }
}

/** Close a completed work order: finalises fee eligibility and revokes nothing by itself. */
export async function closeWorkOrder(
  workOrderId: string,
  closedBy: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: wo } = await supabase.from("partner_work_orders").select("id, status, partner_id, work_order_ref").eq("id", workOrderId).single()
  if (!wo) return { ok: false, error: "Work order not found" }
  if (!["COMPLETED", "ACCEPTED", "IN_PROGRESS"].includes(wo.status as string)) {
    return { ok: false, error: "Only in-flight or completed work orders can be closed" }
  }
  const { error } = await supabase
    .from("partner_work_orders")
    .update({ status: "CLOSED", closed_at: now(), closed_by: closedBy, updated_at: now() })
    .eq("id", workOrderId)
  if (error) return { ok: false, error: "Failed to close work order" }
  await recordAudit(
    { actorType: "ADMIN", actorId: closedBy },
    {
      action: AUDIT_ACTIONS.PARTNER_WORK_ORDER_CLOSED,
      entityType: AUDIT_ENTITIES.PARTNER_WORK_ORDER,
      entityId: workOrderId,
      metadata: { partnerId: wo.partner_id, workOrderRef: wo.work_order_ref },
    }
  )
  return { ok: true }
}

export async function listWorkOrdersForPartnerAdmin(partnerId: string): Promise<Record<string, unknown>[]> {
  return listPartnerWorkOrders(partnerId)
}
