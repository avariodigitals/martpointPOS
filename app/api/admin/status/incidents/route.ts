import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import {
  listIncidents,
  listSubscribers,
  notifyStatusSubscribers,
  INCIDENT_STATUSES,
  type IncidentStatus,
  type StatusIncident,
  type StatusIncidentUpdate,
} from "@/lib/status-page"

const VALID_IMPACTS = ["none", "minor", "major", "critical", "maintenance"]
const VALID_KINDS = ["incident", "maintenance"]
const TERMINAL_STATUSES: string[] = ["resolved", "completed"]

export async function GET() {
  const { denied } = await authorizeAdmin("status")
  if (denied) return denied

  const [incidents, subscribers] = await Promise.all([listIncidents(), listSubscribers()])
  return NextResponse.json({ incidents, subscriberCount: subscribers.length })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("status", "create")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const kind = VALID_KINDS.includes(body.kind) ? body.kind : "incident"
    const status: IncidentStatus = INCIDENT_STATUSES.includes(body.status)
      ? body.status
      : kind === "maintenance"
        ? "scheduled"
        : "investigating"

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from("status_incidents")
      .insert({
        title: body.title.trim(),
        kind,
        status,
        impact: VALID_IMPACTS.includes(body.impact)
          ? body.impact
          : kind === "maintenance"
            ? "maintenance"
            : "minor",
        component_ids: Array.isArray(body.componentIds) ? body.componentIds : [],
        scheduled_for: body.scheduledFor || null,
        scheduled_until: body.scheduledUntil || null,
        resolved_at: TERMINAL_STATUSES.includes(status) ? now : null,
        created_by: session.name || session.username,
      })
      .select()
      .single()

    if (error || !data) {
      console.error("[admin/status/incidents] POST", error)
      return NextResponse.json({ error: "Failed to create incident" }, { status: 500 })
    }

    const incident = data as unknown as StatusIncident & { component_ids: string[] }

    const message = typeof body.message === "string" ? body.message.trim() : ""
    let firstUpdate: StatusIncidentUpdate | null = null
    if (message) {
      const { data: upd } = await supabase
        .from("status_incident_updates")
        .insert({
          incident_id: incident.id,
          status,
          body: message,
          created_by: session.name || session.username,
        })
        .select()
        .single()
      if (upd) {
        firstUpdate = {
          id: upd.id,
          incidentId: upd.incident_id,
          status: upd.status,
          body: upd.body,
          createdBy: upd.created_by || "",
          createdAt: upd.created_at,
        }
      }
    }

    if (body.notify && firstUpdate) {
      await notifyStatusSubscribers(
        { ...incident, componentIds: incident.component_ids || [], updates: [] },
        firstUpdate
      )
    }

    revalidatePath("/status")
    return NextResponse.json({ success: true, id: incident.id })
  } catch (e) {
    console.error("[admin/status/incidents] POST", e)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const { session, denied } = await authorizeAdmin("status", "update")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    if (!body.id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from("status_incidents")
      .select("status, resolved_at")
      .eq("id", body.id)
      .single()
    if (!existing) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 })
    }

    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = { updated_at: now }
    if (body.title !== undefined) updateData.title = String(body.title).trim()
    if (body.impact !== undefined && VALID_IMPACTS.includes(body.impact)) updateData.impact = body.impact
    if (body.componentIds !== undefined)
      updateData.component_ids = Array.isArray(body.componentIds) ? body.componentIds : []
    if (body.scheduledFor !== undefined) updateData.scheduled_for = body.scheduledFor || null
    if (body.scheduledUntil !== undefined) updateData.scheduled_until = body.scheduledUntil || null

    const newStatus: IncidentStatus | undefined =
      body.status !== undefined && INCIDENT_STATUSES.includes(body.status)
        ? (body.status as IncidentStatus)
        : undefined
    if (newStatus) {
      updateData.status = newStatus
      if (TERMINAL_STATUSES.includes(newStatus) && !existing.resolved_at) {
        updateData.resolved_at = now
      } else if (!TERMINAL_STATUSES.includes(newStatus)) {
        updateData.resolved_at = null
      }
    }

    const { error } = await supabase.from("status_incidents").update(updateData).eq("id", body.id)
    if (error) {
      console.error("[admin/status/incidents] PUT", error)
      return NextResponse.json({ error: "Failed to update incident" }, { status: 500 })
    }

    const message = typeof body.message === "string" ? body.message.trim() : ""
    if (message) {
      const { data: upd } = await supabase
        .from("status_incident_updates")
        .insert({
          incident_id: body.id,
          status: newStatus || existing.status,
          body: message,
          created_by: session.name || session.username,
        })
        .select()
        .single()

      if (body.notify && upd) {
        const { data: inc } = await supabase
          .from("status_incidents")
          .select("*")
          .eq("id", body.id)
          .single()
        if (inc) {
          await notifyStatusSubscribers(
            {
              ...(inc as unknown as StatusIncident),
              componentIds: inc.component_ids || [],
              updates: [],
            },
            {
              id: upd.id,
              incidentId: upd.incident_id,
              status: upd.status,
              body: upd.body,
              createdBy: upd.created_by || "",
              createdAt: upd.created_at,
            }
          )
        }
      }
    }

    revalidatePath("/status")
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[admin/status/incidents] PUT", e)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { denied } = await authorizeAdmin("status", "delete")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const { error } = await supabase.from("status_incidents").delete().eq("id", id)
    if (error) {
      console.error("[admin/status/incidents] DELETE", error)
      return NextResponse.json({ error: "Failed to delete incident" }, { status: 500 })
    }

    revalidatePath("/status")
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
