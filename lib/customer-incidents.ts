import { supabase, isSupabaseConfigured } from "./supabase"
import { logFinanceAudit } from "./finance-commercial"

export type IncidentType = "SERVICE" | "SECURITY" | "DATA" | "BILLING" | "PARTNER" | "OTHER"
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
export type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "CLOSED"

export type CustomerIncident = {
  id: string
  business_id: string
  support_ticket_id?: string | null
  type: IncidentType
  severity: IncidentSeverity
  summary: string
  status: IncidentStatus
  owner_admin_user_id?: string | null
  created_at: string
  resolved_at?: string | null
  updated_at: string
}

function now() {
  return new Date().toISOString()
}

export async function createIncident(input: {
  business_id: string
  support_ticket_id?: string | null
  type: IncidentType
  severity: IncidentSeverity
  summary: string
  owner_admin_user_id?: string | null
  actorId?: string | null
}) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data, error } = await supabase
    .from("customer_incidents")
    .insert({
      business_id: input.business_id,
      support_ticket_id: input.support_ticket_id || null,
      type: input.type,
      severity: input.severity,
      summary: input.summary,
      status: "OPEN",
      owner_admin_user_id: input.owner_admin_user_id || null,
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Incident create failed: ${error?.message || "unknown"}`)

  await logFinanceAudit("ADMIN", input.actorId, "CUSTOMER_INCIDENT_CREATED", (data as CustomerIncident).id)
  return data as CustomerIncident
}

export async function getIncidentById(id: string): Promise<CustomerIncident | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase.from("customer_incidents").select("*").eq("id", id).single()
  if (error || !data) return null
  return data as CustomerIncident
}

export async function listIncidents(filters?: { business_id?: string; status?: string; type?: string }) {
  if (!isSupabaseConfigured()) return []
  let q = supabase.from("customer_incidents").select("*").order("created_at", { ascending: false })
  if (filters?.business_id) q = q.eq("business_id", filters.business_id)
  if (filters?.status) q = q.eq("status", filters.status)
  if (filters?.type) q = q.eq("type", filters.type)
  const { data, error } = await q
  if (error) throw new Error(`Incident list failed: ${error.message}`)
  return (data || []) as CustomerIncident[]
}

export async function updateIncident(
  id: string,
  updates: Partial<CustomerIncident>,
  actorId?: string | null
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const current = await getIncidentById(id)
  if (!current) throw new Error("Incident not found")

  const { data, error } = await supabase
    .from("customer_incidents")
    .update({
      ...updates,
      updated_at: now(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error || !data) throw new Error(`Incident update failed: ${error?.message || "unknown"}`)

  const d = data as CustomerIncident

  if (updates.severity && updates.severity !== current.severity) {
    await logFinanceAudit("ADMIN", actorId, "CUSTOMER_INCIDENT_SEVERITY_CHANGED", id, { from: current.severity, to: updates.severity })
  }
  if (updates.status && updates.status !== current.status) {
    if (updates.status === "RESOLVED") {
      await supabase.from("customer_incidents").update({ resolved_at: now() }).eq("id", id)
      await logFinanceAudit("ADMIN", actorId, "CUSTOMER_INCIDENT_RESOLVED", id)
    }
    await logFinanceAudit("ADMIN", actorId, "CUSTOMER_INCIDENT_STATUS_CHANGED", id, { from: current.status, to: updates.status })
  }
  if (updates.owner_admin_user_id && updates.owner_admin_user_id !== current.owner_admin_user_id) {
    await logFinanceAudit("ADMIN", actorId, "CUSTOMER_INCIDENT_ASSIGNED", id, { owner: updates.owner_admin_user_id })
  }

  return d
}

export async function resolveIncident(id: string, actorId?: string | null) {
  return updateIncident(id, { status: "RESOLVED" }, actorId)
}

export async function closeIncident(id: string, actorId?: string | null) {
  return updateIncident(id, { status: "CLOSED" }, actorId)
}
