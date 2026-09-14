import { NextResponse } from "next/server"
import crypto from "crypto"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

interface MeetingRecord {
  id: string
  leadId: string
  customerToken: string
  title: string
  scheduledAt: string
  durationMinutes: number
  timezone: string
  meetingLink: string | null
  provider: string | null
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
  notes: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  leadFullName?: string
  leadBusinessName?: string
  leadEmail?: string
  leadPhone?: string
}

async function guard(request: Request) {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return session
}

function mapMeeting(row: Record<string, unknown>): MeetingRecord {
  return {
    id: row.id as string,
    leadId: row.lead_id as string,
    customerToken: row.customer_token as string,
    title: row.title as string,
    scheduledAt: row.scheduled_at as string,
    durationMinutes: row.duration_minutes as number,
    timezone: row.timezone as string,
    meetingLink: row.meeting_link as string | null,
    provider: row.provider as string | null,
    status: row.status as MeetingRecord["status"],
    notes: row.notes as string | null,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    leadFullName: (row.leads as Record<string, unknown> | undefined)?.full_name as string | undefined,
    leadBusinessName: (row.leads as Record<string, unknown> | undefined)?.business_name as string | undefined,
    leadEmail: (row.leads as Record<string, unknown> | undefined)?.email as string | undefined,
    leadPhone: (row.leads as Record<string, unknown> | undefined)?.phone as string | undefined,
  }
}

/* ─── GET list meetings for a lead ─── */
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const denied = await guard(request)
  if (denied instanceof NextResponse) return denied

  const { id } = await props.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ meetings: [] })
  }

  const { data, error } = await supabase
    .from("lead_meetings")
    .select("*, leads(full_name, business_name, email, phone)")
    .eq("lead_id", id)
    .order("scheduled_at", { ascending: false })

  if (error) {
    console.error("[Lead Meetings GET]", error)
    return NextResponse.json({ error: "Failed to load meetings" }, { status: 500 })
  }

  const meetings = (data || []).map((row) => mapMeeting(row as Record<string, unknown>))
  return NextResponse.json({ meetings })
}

/* ─── POST schedule a new meeting ─── */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const session = await guard(request)
  if (session instanceof NextResponse) return session

  const { id } = await props.params

  try {
    const body = await request.json()
    const { title, scheduledAt, durationMinutes, timezone, meetingLink, provider, notes } = body

    if (!scheduledAt) {
      return NextResponse.json({ error: "Scheduled date/time is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const customerToken = crypto.randomUUID()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("lead_meetings")
      .insert({
        lead_id: id,
        customer_token: customerToken,
        title: title || "MartPoint Demo",
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: typeof durationMinutes === "number" ? durationMinutes : 30,
        timezone: timezone || "Africa/Lagos",
        meeting_link: meetingLink || null,
        provider: provider || null,
        status: "SCHEDULED",
        notes: notes || null,
        created_by: session.userId,
        created_at: now,
        updated_at: now,
      })
      .select("*, leads(full_name, business_name, email, phone)")
      .single()

    if (error || !data) {
      console.error("[Lead Meetings POST]", error)
      return NextResponse.json({ error: "Failed to schedule meeting" }, { status: 500 })
    }

    return NextResponse.json({ success: true, meeting: mapMeeting(data) })
  } catch {
    return NextResponse.json({ error: "Failed to schedule meeting" }, { status: 500 })
  }
}
