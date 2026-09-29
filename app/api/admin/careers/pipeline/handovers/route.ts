import { NextResponse } from "next/server"
import crypto from "crypto"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { PIPELINE_STAGE_KEYS } from "@/lib/careers-pipeline"

export const dynamic = "force-dynamic"

/* POST: record a pipeline handover. Requires careers.performance.manage.
 * previous_owner is auto-filled from the latest accepted handover for the
 * subject when not supplied. */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("careers.performance.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const stage = String(body.pipeline_stage || "").trim().toUpperCase()
  const newOwner = String(body.new_owner || "").trim()
  if (!PIPELINE_STAGE_KEYS.includes(stage as never)) {
    return NextResponse.json({ error: "Invalid pipeline stage" }, { status: 400 })
  }
  if (!newOwner) return NextResponse.json({ error: "New owner is required" }, { status: 400 })

  const subjectType = body.subject_type === "CUSTOMER" ? "CUSTOMER" : "LEAD"
  const leadId = body.lead_id || null
  const businessId = body.business_id || null
  if (subjectType === "LEAD" && !leadId && !body.subject_label) {
    return NextResponse.json({ error: "A lead or subject label is required" }, { status: 400 })
  }
  if (subjectType === "CUSTOMER" && !businessId && !body.subject_label) {
    return NextResponse.json({ error: "A customer or subject label is required" }, { status: 400 })
  }

  // Resolve the previous owner from the subject's latest handover.
  let previousOwner = body.previous_owner ? String(body.previous_owner) : null
  if (!previousOwner) {
    let q = supabase
      .from("career_pipeline_handovers")
      .select("new_owner")
      .order("handed_at", { ascending: false })
      .limit(1)
    if (leadId) q = q.eq("lead_id", leadId)
    else if (businessId) q = q.eq("business_id", businessId)
    const { data: last } = await q.maybeSingle()
    previousOwner = last?.new_owner || null
  }

  const id = crypto.randomUUID()
  const { error } = await supabase.from("career_pipeline_handovers").insert({
    id,
    subject_type: subjectType,
    lead_id: leadId,
    business_id: businessId,
    subject_label: body.subject_label || null,
    pipeline_stage: stage,
    previous_owner: previousOwner,
    new_owner: newOwner,
    previous_owner_id: body.previous_owner_id || null,
    new_owner_id: body.new_owner_id || null,
    required_action: body.required_action || null,
    deadline: body.deadline || null,
    notes: body.notes || null,
    attached_documents: Array.isArray(body.attached_documents) ? body.attached_documents : [],
    acceptance_status: "PENDING",
    created_by: session.userId,
  })
  if (error) {
    console.error("[careers] handover insert failed:", error.message)
    return NextResponse.json({ error: "Failed to record handover" }, { status: 500 })
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_PIPELINE_HANDOVER_RECORDED,
    entityType: AUDIT_ENTITIES.CAREER_PIPELINE_HANDOVER,
    entityId: id,
    metadata: { stage, new_owner: newOwner, lead_id: leadId, business_id: businessId },
  })
  return NextResponse.json({ success: true, id, previous_owner: previousOwner })
}
