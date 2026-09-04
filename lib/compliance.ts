import { supabase, isSupabaseConfigured } from "./supabase"

export type ComplianceRecord = {
  id: string
  subject_type: "BUSINESS" | "PARTNER"
  business_id?: string | null
  partner_id?: string | null
  requirement_type: string
  status: "NOT_REQUIRED" | "REQUESTED" | "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "EXPIRED"
  requested_at?: string | null
  submitted_at?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  expires_at?: string | null
  internal_notes?: string | null
  public_note?: string | null
  document_path?: string | null
  created_at: string
  updated_at: string
}

function now() {
  return new Date().toISOString()
}

export async function listRequirements(subjectType?: string) {
  if (!isSupabaseConfigured()) return []
  let q = supabase.from("compliance_requirements").select("*").eq("active", true)
  if (subjectType) q = q.eq("subject_type", subjectType)
  const { data, error } = await q
  if (error) throw new Error(`Requirements list failed: ${error.message}`)
  return (data || []) as ComplianceRecord[]
}

export async function createComplianceRecord(input: {
  subject_type: "BUSINESS" | "PARTNER"
  business_id?: string
  partner_id?: string
  requirement_type: string
  requested_by?: string
  public_note?: string
}) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data, error } = await supabase
    .from("compliance_records")
    .insert({
      ...input,
      business_id: input.business_id || null,
      partner_id: input.partner_id || null,
      status: "REQUESTED",
      requested_at: now(),
      public_note: input.public_note || null,
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Compliance record create failed: ${error?.message || "unknown"}`)
  await logComplianceAudit("ADMIN", input.requested_by, "COMPLIANCE_REQUESTED", (data as ComplianceRecord).id)
  return data as ComplianceRecord
}

export async function submitDocument(
  recordId: string,
  documentPath: string,
  actorId: string,
  actorType: "ADMIN" | "PARTNER" = "ADMIN"
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data, error } = await supabase
    .from("compliance_records")
    .update({
      document_path: documentPath,
      status: "SUBMITTED",
      submitted_at: now(),
      updated_at: now(),
    })
    .eq("id", recordId)
    .select()
    .single()

  if (error || !data) throw new Error(`Document submit failed: ${error?.message || "unknown"}`)
  await logComplianceAudit(actorType, actorId, "COMPLIANCE_DOCUMENT_SUBMITTED", recordId)
  return data as ComplianceRecord
}

export async function reviewCompliance(
  recordId: string,
  status: "VERIFIED" | "REJECTED" | "EXPIRED",
  reviewerId: string,
  publicNote?: string,
  internalNotes?: string,
  expiresAt?: string
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const updates: Record<string, unknown> = {
    status,
    reviewed_at: now(),
    reviewed_by: reviewerId,
    public_note: publicNote || null,
    internal_notes: internalNotes || null,
    expires_at: expiresAt || null,
    updated_at: now(),
  }

  const { data, error } = await supabase
    .from("compliance_records")
    .update(updates)
    .eq("id", recordId)
    .select()
    .single()

  if (error || !data) throw new Error(`Compliance review failed: ${error?.message || "unknown"}`)

  const action = status === "VERIFIED" ? "COMPLIANCE_VERIFIED" : status === "REJECTED" ? "COMPLIANCE_REJECTED" : "COMPLIANCE_EXPIRED"
  await logComplianceAudit("ADMIN", reviewerId, action, recordId)
  return data as ComplianceRecord
}

export async function requestReplacement(
  recordId: string,
  reason: string,
  actorId: string
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data, error } = await supabase
    .from("compliance_records")
    .update({
      status: "REQUESTED",
      public_note: reason,
      submitted_at: null,
      updated_at: now(),
    })
    .eq("id", recordId)
    .select()
    .single()

  if (error || !data) throw new Error(`Replacement request failed: ${error?.message || "unknown"}`)
  await logComplianceAudit("ADMIN", actorId, "COMPLIANCE_REQUESTED", recordId)
  return data as ComplianceRecord
}

export async function setComplianceExpiry(
  recordId: string,
  expiresAt: string,
  actorId: string
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data, error } = await supabase
    .from("compliance_records")
    .update({
      expires_at: expiresAt,
      updated_at: now(),
    })
    .eq("id", recordId)
    .select()
    .single()

  if (error || !data) throw new Error(`Expiry update failed: ${error?.message || "unknown"}`)
  return data as ComplianceRecord
}

async function logComplianceAudit(
  actorType: "ADMIN" | "PARTNER",
  actorId: string | undefined,
  action: "COMPLIANCE_REQUESTED" | "COMPLIANCE_DOCUMENT_SUBMITTED" | "COMPLIANCE_VERIFIED" | "COMPLIANCE_REJECTED" | "COMPLIANCE_EXPIRED",
  recordId: string
) {
  if (!isSupabaseConfigured()) return
  await supabase.from("finance_audit_events").insert({
    actor_type: actorType,
    actor_id: actorId,
    action,
    entity_type: "COMPLIANCE_RECORD",
    entity_id: recordId,
    created_at: now(),
  })
}
