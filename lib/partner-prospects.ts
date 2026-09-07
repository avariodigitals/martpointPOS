import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "./audit"
import type { AuditContext } from "./audit"

export type PartnerProspectStatus =
  | "NEW_LEAD" | "CONTACTED" | "INTERESTED" | "INVITED_TO_APPLY" | "APPLICATION_SUBMITTED" | "CONVERTED" | "NOT_INTERESTED" | "DISQUALIFIED"

export interface PartnerProspect {
  id: string
  referenceNumber: string
  source: string | null
  fullName: string
  businessName: string | null
  email: string | null
  phone: string | null
  country: string | null
  state: string | null
  city: string | null
  interestedPartnerType: string | null
  owner: string | null
  status: PartnerProspectStatus
  notes: string | null
  nextFollowUp: string | null
  inviteToken: string | null
  invitedAt: string | null
  linkedApplicationId: string | null
  createdAt: string
  updatedAt: string
}

export interface ProspectInput {
  source?: string | null
  fullName: string
  businessName?: string | null
  email?: string | null
  phone?: string | null
  country?: string | null
  state?: string | null
  city?: string | null
  interestedPartnerType?: string | null
  owner?: string | null
  status?: PartnerProspectStatus
  notes?: string | null
  nextFollowUp?: string | null
}

/** Accepts datetime-local ("2026-05-03T10:00") or full ISO; returns ISO or null. */
function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function mapRow(row: Record<string, unknown>): PartnerProspect {
  return {
    id: row.id as string,
    referenceNumber: row.reference_number as string,
    source: (row.source as string) ?? null,
    fullName: row.full_name as string,
    businessName: (row.business_name as string) ?? null,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    country: (row.country as string) ?? null,
    state: (row.state as string) ?? null,
    city: (row.city as string) ?? null,
    interestedPartnerType: (row.interested_partner_type as string) ?? null,
    owner: (row.owner as string) ?? null,
    status: row.status as PartnerProspectStatus,
    notes: (row.notes as string) ?? null,
    nextFollowUp: (row.next_follow_up as string) ?? null,
    inviteToken: (row.invite_token as string) ?? null,
    invitedAt: (row.invited_at as string) ?? null,
    linkedApplicationId: (row.linked_application_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

async function nextReferenceNumber(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const { count, error } = await supabase.from("partner_prospects").select("*", { count: "exact", head: true })
  if (error) throw error
  const n = (count ?? 0) + 1
  return `MPPL-${today}-${n.toString().padStart(4, "0")}`
}

export async function listPartnerProspects(): Promise<PartnerProspect[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase.from("partner_prospects").select("*").order("created_at", { ascending: false })
  if (error) {
    console.error("[listPartnerProspects]", error)
    return []
  }
  return (data || []).map(mapRow)
}

export async function getPartnerProspectById(id: string): Promise<PartnerProspect | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase.from("partner_prospects").select("*").eq("id", id).single()
  if (error || !data) return null
  return mapRow(data)
}

export async function getPartnerProspectByToken(token: string): Promise<PartnerProspect | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase.from("partner_prospects").select("*").eq("invite_token", token).maybeSingle()
  if (error || !data) return null
  return mapRow(data)
}

export async function createPartnerProspect(input: ProspectInput, actor: AuditContext): Promise<{ ok: boolean; prospect?: PartnerProspect; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  try {
    const ref = await nextReferenceNumber()
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from("partner_prospects")
      .insert({
        reference_number: ref,
        source: input.source ?? null,
        full_name: input.fullName,
        business_name: input.businessName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        country: input.country ?? null,
        state: input.state ?? null,
        city: input.city ?? null,
        interested_partner_type: input.interestedPartnerType ?? null,
        owner: input.owner ?? null,
        status: input.status ?? "NEW_LEAD",
        notes: input.notes ?? null,
        next_follow_up: toIso(input.nextFollowUp),
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()
    if (error || !data) {
      console.error("[createPartnerProspect]", error)
      return { ok: false, error: "Failed to create prospect" }
    }
    await recordAudit(actor, {
      action: AUDIT_ACTIONS.PARTNER_PROSPECT_CREATED,
      entityType: AUDIT_ENTITIES.PARTNER,
      entityId: data.id as string,
      metadata: { reference: ref, source: input.source, fullName: input.fullName },
    })
    return { ok: true, prospect: mapRow(data) }
  } catch (e) {
    console.error("[createPartnerProspect]", e)
    return { ok: false, error: "Failed to create prospect" }
  }
}

export async function updatePartnerProspect(
  id: string,
  input: Partial<ProspectInput>,
  actor: AuditContext
): Promise<{ ok: boolean; prospect?: PartnerProspect; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const updates: Record<string, unknown> = {}
  if (input.source !== undefined) updates.source = input.source
  if (input.fullName !== undefined) updates.full_name = input.fullName
  if (input.businessName !== undefined) updates.business_name = input.businessName
  if (input.email !== undefined) updates.email = input.email
  if (input.phone !== undefined) updates.phone = input.phone
  if (input.country !== undefined) updates.country = input.country
  if (input.state !== undefined) updates.state = input.state
  if (input.city !== undefined) updates.city = input.city
  if (input.interestedPartnerType !== undefined) updates.interested_partner_type = input.interestedPartnerType
  if (input.owner !== undefined) updates.owner = input.owner
  if (input.status !== undefined) updates.status = input.status
  if (input.notes !== undefined) updates.notes = input.notes
  if (input.nextFollowUp !== undefined) updates.next_follow_up = toIso(input.nextFollowUp)
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase.from("partner_prospects").update(updates).eq("id", id).select().single()
  if (error || !data) {
    console.error("[updatePartnerProspect]", error)
    return { ok: false, error: "Failed to update prospect" }
  }
  await recordAudit(actor, {
    action: AUDIT_ACTIONS.PARTNER_PROSPECT_UPDATED,
    entityType: AUDIT_ENTITIES.PARTNER,
    entityId: id,
    metadata: { updates: Object.keys(updates) },
  })
  return { ok: true, prospect: mapRow(data) }
}

export async function createProspectInvite(id: string, actor: AuditContext): Promise<{ ok: boolean; prospect?: PartnerProspect; token?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const token = crypto.randomUUID()
  const { data, error } = await supabase
    .from("partner_prospects")
    .update({ invite_token: token, invited_at: new Date().toISOString(), status: "INVITED_TO_APPLY", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error || !data) {
    console.error("[createProspectInvite]", error)
    return { ok: false, error: "Failed to create invite" }
  }
  await recordAudit(actor, {
    action: AUDIT_ACTIONS.PARTNER_PROSPECT_INVITED,
    entityType: AUDIT_ENTITIES.PARTNER,
    entityId: id,
    metadata: { token },
  })
  return { ok: true, prospect: mapRow(data), token }
}

export async function deletePartnerProspect(id: string, actor: AuditContext): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from("partner_prospects").delete().eq("id", id)
  if (error) {
    console.error("[deletePartnerProspect]", error)
    return false
  }
  await recordAudit(actor, {
    action: AUDIT_ACTIONS.PARTNER_PROSPECT_DELETED,
    entityType: AUDIT_ENTITIES.PARTNER,
    entityId: id,
    metadata: {},
  })
  return true
}
