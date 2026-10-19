import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { completeExpiredMeetings } from "@/lib/meeting-status"

interface CalendarMeeting {
  id: string
  source: "lead" | "partner"
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
    source: "lead",
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

function mapPartnerMeetingRow(row: Record<string, unknown>): CalendarMeeting {
  const app = (row.partner_applications as Record<string, unknown> | undefined) || {}
  return {
    id: row.id as string,
    source: "partner",
    leadId: row.application_id as string,
    customerToken: "",
    title: row.title as string,
    scheduledAt: row.scheduled_at as string,
    durationMinutes: row.duration_minutes as number,
    timezone: row.timezone as string,
    meetingLink: row.meeting_link as string | null,
    provider: row.provider as string | null,
    status: row.status as CalendarMeeting["status"],
    notes: null,
    summary: row.summary as string | null,
    actionItems: Array.isArray(row.action_items) ? (row.action_items as string[]) : null,
    transcriptUrl: row.transcript_url as string | null,
    recordingUrl: row.recording_url as string | null,
    notesProvider: row.notes_provider as string | null,
    leadFullName: (app.full_name as string) || "Partner applicant",
    leadBusinessName: (app.business_name as string) || "",
    leadEmail: (app.email as string) || "",
    leadPhone: "",
  }
}

/* ─── GET all meetings for a date range ─── */
export async function GET(request: Request) {
  const session = await getSession()
  const role = session?.role as UserRole
  const canLeads = !!session && hasPermission(role, "leads")
  const canPartners = !!session && hasPermission(role, "partners")
  if (!session || (!canLeads && !canPartners)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ meetings: [] })
  }

  await completeExpiredMeetings()

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const fromIso = from ? new Date(from).toISOString() : null
  const toIso = to ? new Date(to).toISOString() : null

  const [leadRes, partnerRes] = await Promise.all([
    canLeads
      ? (() => {
          let query = supabase
            .from("lead_meetings")
            .select("*, leads(full_name, business_name, email, phone)")
            .neq("status", "CANCELLED")
            .not("scheduled_at", "is", null)
            .order("scheduled_at", { ascending: true })
          if (fromIso) query = query.gte("scheduled_at", fromIso)
          if (toIso) query = query.lte("scheduled_at", toIso)
          return query
        })()
      : Promise.resolve({ data: null, error: null }),
    canPartners
      ? (() => {
          let query = supabase
            .from("partner_meetings")
            .select("*, partner_applications(full_name, business_name, email)")
            .neq("status", "CANCELLED")
            .order("scheduled_at", { ascending: true })
          if (fromIso) query = query.gte("scheduled_at", fromIso)
          if (toIso) query = query.lte("scheduled_at", toIso)
          return query
        })()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (leadRes.error || partnerRes.error) {
    console.error("[Admin Calendar GET]", leadRes.error, partnerRes.error)
    return NextResponse.json({ error: "Failed to load calendar" }, { status: 500 })
  }

  const meetings = [
    ...(leadRes.data || []).map((row) => mapCalendarRow(row as Record<string, unknown>)),
    ...(partnerRes.data || []).map((row) => mapPartnerMeetingRow(row as Record<string, unknown>)),
  ].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  return NextResponse.json({ meetings })
}
