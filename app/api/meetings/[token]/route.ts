import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

interface PublicMeeting {
  title: string
  scheduledAt: string
  durationMinutes: number
  timezone: string
  meetingLink: string | null
  provider: string | null
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
  leadFullName: string
  leadBusinessName: string
  leadEmail: string
  leadPhone: string
}

function mapPublic(row: Record<string, unknown>): PublicMeeting {
  const lead = (row.leads as Record<string, unknown> | undefined) || {}
  return {
    title: row.title as string,
    scheduledAt: row.scheduled_at as string,
    durationMinutes: row.duration_minutes as number,
    timezone: row.timezone as string,
    meetingLink: row.meeting_link as string | null,
    provider: row.provider as string | null,
    status: row.status as PublicMeeting["status"],
    leadFullName: lead.full_name as string,
    leadBusinessName: lead.business_name as string,
    leadEmail: lead.email as string,
    leadPhone: lead.phone as string,
  }
}

/* ─── GET public meeting by customer token ─── */
export async function GET(request: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  const { data, error } = await supabase
    .from("lead_meetings")
    .select("title, scheduled_at, duration_minutes, timezone, meeting_link, provider, status, leads(full_name, business_name, email, phone)")
    .eq("customer_token", token)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 })
  }

  return NextResponse.json({ meeting: mapPublic(data as Record<string, unknown>) })
}
