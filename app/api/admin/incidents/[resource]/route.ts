import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { hasSupportAdminAction } from "@/lib/support-permissions"
import type { SupportAdminAction } from "@/lib/support-permissions"
import { supabase } from "@/lib/supabase"
import {
  createIncident,
  updateIncident,
  resolveIncident,
  closeIncident,
  type CustomerIncident,
  type IncidentType,
  type IncidentSeverity,
  type IncidentStatus,
} from "@/lib/customer-incidents"

const INCIDENT_TYPES: IncidentType[] = ["SERVICE", "SECURITY", "DATA", "BILLING", "PARTNER", "OTHER"]
const INCIDENT_SEVERITIES: IncidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
const INCIDENT_STATUSES: IncidentStatus[] = ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"]
const SENSITIVE_TYPES = new Set<IncidentType>(["SECURITY", "DATA"])
const SENSITIVE_STATUSES = new Set<IncidentStatus>(["RESOLVED", "CLOSED"])

type Action = string

const actionPerm: Record<string, SupportAdminAction> = {
  create: "support:create",
  update: "support:update",
  link_ticket: "support:update",
  resolve: "support:resolve",
  close: "support:close",
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

function isValidType(value: string): value is IncidentType {
  return INCIDENT_TYPES.includes(value as IncidentType)
}

function isValidSeverity(value: string): value is IncidentSeverity {
  return INCIDENT_SEVERITIES.includes(value as IncidentSeverity)
}

function isValidStatus(value: string): value is IncidentStatus {
  return INCIDENT_STATUSES.includes(value as IncidentStatus)
}

function isSensitive(type: IncidentType, status?: IncidentStatus) {
  return SENSITIVE_TYPES.has(type) || (status ? SENSITIVE_STATUSES.has(status) : false)
}

/* ─────────────────────────────────────────────────────────────────────────────
   GET — list / single
   ───────────────────────────────────────────────────────────────────────────── */
export async function GET(request: Request, props: { params: Promise<{ resource: string }> }) {
  const actor = await getActor()
  if (!actor) return err("Unauthorized", 401)
  if (!hasSupportAdminAction(actor.role, "support:view")) {
    return err("Forbidden", 403)
  }

  const { resource } = await props.params
  const { searchParams } = new URL(request.url)

  try {
    if (resource === "list") {
      const businessId = searchParams.get("businessId") || undefined
      const status = searchParams.get("status") || undefined
      const type = searchParams.get("type") || undefined
      const severity = searchParams.get("severity") || undefined

      let q = supabase
        .from("customer_incidents")
        .select(
          "*, business:business_id (business_name), owner:owner_admin_user_id (name)"
        )
        .order("created_at", { ascending: false })

      if (businessId) q = q.eq("business_id", businessId)
      if (status) q = q.eq("status", status)
      if (type) q = q.eq("type", type)
      if (severity) q = q.eq("severity", severity)

      const { data, error } = await q
      if (error) return err(error.message, 500)

      const canSeeSensitive = hasSupportAdminAction(actor.role, "support:sensitive")
      const visible = (data || []).filter((item: any) => {
        const it = item as CustomerIncident
        if (!SENSITIVE_TYPES.has(it.type)) return true
        return canSeeSensitive
      })

      return ok(visible)
    }

    if (resource === "incidents") {
      const id = searchParams.get("id")
      if (!id) return err("Missing id")

      const { data, error } = await supabase
        .from("customer_incidents")
        .select(
          "*, business:business_id (business_name), owner:owner_admin_user_id (name), ticket:support_ticket_id (ticket_number, subject)"
        )
        .eq("id", id)
        .single()

      if (error || !data) return err(error?.message || "Not found", 404)

      const incident = data as CustomerIncident & {
        business?: { business_name?: string | null }
        owner?: { name?: string | null }
        ticket?: { ticket_number?: string | null; subject?: string | null }
      }

      if (SENSITIVE_TYPES.has(incident.type) && !hasSupportAdminAction(actor.role, "support:sensitive")) {
        return err("Forbidden", 403)
      }

      const { data: events, error: eventsError } = await supabase
        .from("finance_audit_events")
        .select("*")
        .eq("entity_id", id)
        .eq("entity_type", "CUSTOMER_INCIDENT")
        .order("created_at", { ascending: false })

      if (eventsError) return err(eventsError.message, 500)

      return ok({ ...incident, events: events || [] })
    }

    return err("Unknown resource", 404)
  } catch (e) {
    return err(String(e), 500)
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   POST — create / update / link / resolve / close
   ───────────────────────────────────────────────────────────────────────────── */
export async function POST(request: Request, props: { params: Promise<{ resource: string }> }) {
  const actor = await getActor()
  if (!actor) return err("Unauthorized", 401)

  const { resource } = await props.params
  if (resource !== "incidents") {
    return err("Unknown resource", 404)
  }

  try {
    const body = await request.json()
    const { action, data } = body as { action: Action; data: any }
    if (!action) return err("Missing action")

    const requiredPerm = actionPerm[action]
    if (!requiredPerm || !hasSupportAdminAction(actor.role, requiredPerm)) {
      return err("Forbidden", 403)
    }

    if (action === "create") {
      const { business_id, support_ticket_id, type, severity, summary, owner_admin_user_id } = data || {}
      if (!business_id) return err("Missing business_id")
      if (!type || !isValidType(type)) return err("Invalid type")
      if (!severity || !isValidSeverity(severity)) return err("Invalid severity")
      if (!summary) return err("Missing summary")

      if (SENSITIVE_TYPES.has(type) && !hasSupportAdminAction(actor.role, "support:sensitive")) {
        return err("Forbidden", 403)
      }

      const incident = await createIncident({
        business_id,
        support_ticket_id: support_ticket_id || null,
        type,
        severity,
        summary,
        owner_admin_user_id: owner_admin_user_id || null,
        actorId: actor.id,
      })
      return ok(incident)
    }

    if (action === "update") {
      const { id, summary, status, severity, owner_admin_user_id } = data || {}
      if (!id) return err("Missing id")

      const updates: Partial<CustomerIncident> = {}
      if (summary !== undefined) updates.summary = summary
      if (status !== undefined) {
        if (!isValidStatus(status)) return err("Invalid status")
        if (SENSITIVE_STATUSES.has(status) && !hasSupportAdminAction(actor.role, "support:sensitive")) {
          return err("Forbidden", 403)
        }
        updates.status = status
      }
      if (severity !== undefined) {
        if (!isValidSeverity(severity)) return err("Invalid severity")
        updates.severity = severity
      }
      if (owner_admin_user_id !== undefined) updates.owner_admin_user_id = owner_admin_user_id || null

      const incident = await updateIncident(id, updates, actor.id)
      return ok(incident)
    }

    if (action === "link_ticket") {
      const { id, support_ticket_id } = data || {}
      if (!id || !support_ticket_id) return err("Missing id or support_ticket_id")
      const incident = await updateIncident(id, { support_ticket_id }, actor.id)
      return ok(incident)
    }

    if (action === "resolve") {
      if (!data?.id) return err("Missing id")
      if (!hasSupportAdminAction(actor.role, "support:sensitive")) {
        return err("Forbidden", 403)
      }
      const incident = await resolveIncident(data.id, actor.id)
      return ok(incident)
    }

    if (action === "close") {
      if (!data?.id) return err("Missing id")
      if (!hasSupportAdminAction(actor.role, "support:sensitive")) {
        return err("Forbidden", 403)
      }
      const incident = await closeIncident(data.id, actor.id)
      return ok(incident)
    }

    return err("Unknown action", 400)
  } catch (e) {
    return err(String(e), 500)
  }
}
