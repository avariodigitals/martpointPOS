import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "./audit"

/* ───────────────────────────  Partner certifications  ───────────────────────────
 * Structured certification records per the blueprint: a partner progresses
 * CANDIDATE → TRAINING → ASSESSMENT → (SUPERVISED →) CERTIFIED, with expiry.
 * Certification is decided by MartPoint, never by the partner.
 */

export type CertificationStatus = "CANDIDATE" | "TRAINING" | "ASSESSMENT" | "SUPERVISED" | "CERTIFIED" | "EXPIRED" | "REVOKED"

export const CERTIFICATION_STATUS_LABELS: Record<CertificationStatus, string> = {
  CANDIDATE: "Candidate",
  TRAINING: "In training",
  ASSESSMENT: "Assessment",
  SUPERVISED: "Supervised delivery",
  CERTIFIED: "Certified",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
}

/** Default certification validity: 12 months (blueprint: certifications expire). */
const DEFAULT_VALIDITY_MONTHS = 12

function now() {
  return new Date().toISOString()
}

export async function getPartnerCertification(
  partnerId: string,
  programme = "IMPLEMENTATION"
): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("partner_certifications")
    .select("*")
    .eq("partner_id", partnerId)
    .eq("programme", programme)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as Record<string, unknown>) ?? null
}

export async function listPartnerCertifications(partnerId: string): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("partner_certifications")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
  return (data || []) as Record<string, unknown>[]
}

/** MartPoint records or updates a certification decision. */
export async function decideCertification(
  partnerId: string,
  input: {
    programme?: string
    status: CertificationStatus
    score?: number | null
    assessor?: string | null
    supervisedDelivery?: boolean
    restrictions?: string | null
    notes?: string | null
    expiresAt?: string | null
  },
  decidedBy: string
): Promise<{ ok: boolean; error?: string; record?: Record<string, unknown> }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const programme = input.programme || "IMPLEMENTATION"

  const existing = await getPartnerCertification(partnerId, programme)
  const awardedAt = input.status === "CERTIFIED" || input.status === "SUPERVISED" ? now() : (existing?.awarded_at as string | null) ?? null
  const expiresAt =
    input.expiresAt ??
    (awardedAt && (input.status === "CERTIFIED" || input.status === "SUPERVISED")
      ? new Date(new Date(awardedAt).setMonth(new Date(awardedAt).getMonth() + DEFAULT_VALIDITY_MONTHS)).toISOString()
      : (existing?.expires_at as string | null) ?? null)

  const payload = {
    partner_id: partnerId,
    programme,
    status: input.status,
    score: input.score ?? null,
    assessor: input.assessor ?? null,
    supervised_delivery: input.supervisedDelivery ?? false,
    restrictions: input.restrictions ?? null,
    notes: input.notes ?? null,
    awarded_at: awardedAt,
    expires_at: expiresAt,
    decided_by: decidedBy,
    updated_at: now(),
  }

  let record: Record<string, unknown>
  if (existing) {
    const { data, error } = await supabase
      .from("partner_certifications")
      .update(payload)
      .eq("id", existing.id as string)
      .select()
      .single()
    if (error || !data) return { ok: false, error: "Failed to update certification" }
    record = data
  } else {
    const { data, error } = await supabase
      .from("partner_certifications")
      .insert({ ...payload, created_at: now() })
      .select()
      .single()
    if (error || !data) return { ok: false, error: "Failed to create certification" }
    record = data
  }

  await recordAudit(
    { actorType: "ADMIN", actorId: decidedBy },
    {
      action: AUDIT_ACTIONS.PARTNER_CERTIFICATION_UPDATED,
      entityType: AUDIT_ENTITIES.PARTNER_CERTIFICATION,
      entityId: record.id as string,
      metadata: { partnerId, programme, status: input.status, score: input.score, expiresAt },
    }
  )
  return { ok: true, record }
}

/** Cron: expire certifications past their expiry date. Idempotent. */
export async function expireDueCertifications(): Promise<{ expired: number }> {
  if (!isSupabaseConfigured()) return { expired: 0 }
  const { data } = await supabase
    .from("partner_certifications")
    .select("id, partner_id, programme")
    .in("status", ["CERTIFIED", "SUPERVISED"])
    .lt("expires_at", now())
  const rows = (data || []) as Record<string, unknown>[]
  for (const r of rows) {
    const { error } = await supabase
      .from("partner_certifications")
      .update({ status: "EXPIRED", updated_at: now() })
      .eq("id", r.id as string)
      .in("status", ["CERTIFIED", "SUPERVISED"])
    if (!error) {
      await recordAudit(
        { actorType: "SYSTEM", actorId: "cron" },
        {
          action: AUDIT_ACTIONS.PARTNER_CERTIFICATION_EXPIRED,
          entityType: AUDIT_ENTITIES.PARTNER_CERTIFICATION,
          entityId: r.id as string,
          metadata: { partnerId: r.partner_id, programme: r.programme },
        }
      )
    }
  }
  return { expired: rows.length }
}
