import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

interface CalendarMeeting {
  id: string
  leadId: string
  customerToken: string
  title: string
  scheduledAt: string
  durationMinutes: number
  timezone: string
  meetingLink: string | null
  provider: string | null
  status: "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
  notes: string | null
  summary: string | null
  actionItems: string[] | null
  transcriptUrl: string | null
  recordingUrl: string | null
  notesProvider: string | null
  leadFullName: string
  leadBusinessName: string
  leadEmail: string
  leadPhone: string
}

function mapCalendarRow(row: Record<string, unknown>): CalendarMeeting {
  const lead = (row.leads as Record<string, unknown> | undefined) || {}
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
    status: row.status as CalendarMeeting["status"],
    notes: row.notes as string | null,
    summary: row.summary as string | null,
    actionItems: Array.isArray(row.action_items) ? (row.action_items as string[]) : null,
    transcriptUrl: row.transcript_url as string | null,
    recordingUrl: row.recording_url as string | null,
    notesProvider: row.notes_provider as string | null,
    leadFullName: lead.full_name as string,
    leadBusinessName: lead.business_name as string,
    leadEmail: lead.email as string,
    leadPhone: lead.phone as string,
  }
}

/* ─── GET all meetings for a date range ─── */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ meetings: [] })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  let query = supabase
    .from("lead_meetings")
    .select("*, leads(full_name, business_name, email, phone)")
    .neq("status", "CANCELLED")
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true })

  if (from) query = query.gte("scheduled_at", new Date(from).toISOString())
  if (to) query = query.lte("scheduled_at", new Date(to).toISOString())

  const { data, error } = await query

  if (error) {
    console.error("[Admin Calendar GET]", error)
    return NextResponse.json({ error: "Failed to load calendar" }, { status: 500 })
  }

  const meetings = (data || []).map((row) => mapCalendarRow(row as Record<string, unknown>))
  return NextResponse.json({ meetings })
}
