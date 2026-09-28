import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { MEETING_SELECT, mapMeeting, cancelMeeting, sendMeetingInviteEmail, sendMeetingSummaryEmail, computeAvailableSlots } from "@/lib/meeting-booking"

const patchSchema = z.object({
  action: z.enum(["cancel", "resend_invite", "set_status", "save_notes", "email_summary"]),
  status: z.enum(["COMPLETED", "NO_SHOW", "SCHEDULED"]).optional(),
  summary: z.string().nullable().optional(),
  actionItems: z.array(z.string()).nullable().optional(),
  transcript: z.string().nullable().optional(),
  transcriptUrl: z.string().nullable().optional(),
  recordingUrl: z.string().nullable().optional(),
})

async function loadMeeting(leadId: string, meetingId: string) {
  const { data } = await supabase
    .from("lead_meetings")
    .select(MEETING_SELECT)
    .eq("id", meetingId)
    .eq("lead_id", leadId)
    .single()
  return data ? mapMeeting(data as Record<string, unknown>) : null
}

/* ─── GET one meeting (+ open slots when pending) ─── */
export async function GET(_: Request, props: { params: Promise<{ id: string; meetingId: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  const { id, meetingId } = await props.params
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const meeting = await loadMeeting(id, meetingId)
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 })
  const availableSlots = meeting.status === "PENDING" ? await computeAvailableSlots(meeting) : []
  return NextResponse.json({ meeting, availableSlots })
}

/* ─── PATCH cancel / resend invite / set status ─── */
export async function PATCH(request: Request, props: { params: Promise<{ id: string; meetingId: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  const { id, meetingId } = await props.params
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const meeting = await loadMeeting(id, meetingId)
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 })

  if (parsed.data.action === "cancel") {
    if (meeting.status === "CANCELLED") return NextResponse.json({ success: true, meeting })
    const updated = await cancelMeeting(meeting)
    if (!updated) return NextResponse.json({ error: "Failed to cancel meeting" }, { status: 500 })
    return NextResponse.json({ success: true, meeting: updated })
  }

  if (parsed.data.action === "resend_invite") {
    if (meeting.status !== "PENDING") return NextResponse.json({ error: "Only pending invitations can be resent" }, { status: 400 })
    const sent = await sendMeetingInviteEmail(meeting)
    if (sent) {
      await supabase.from("lead_meetings").update({ invite_sent_at: new Date().toISOString() }).eq("id", meeting.id)
    }
    return NextResponse.json({ success: true, emailSent: sent, meeting: await loadMeeting(id, meetingId) })
  }

  if (parsed.data.action === "save_notes") {
    const { summary, actionItems, transcript, transcriptUrl, recordingUrl } = parsed.data
    const { data, error } = await supabase
      .from("lead_meetings")
      .update({
        summary: summary ?? null,
        action_items: actionItems ?? null,
        transcript: transcript ?? null,
        transcript_url: transcriptUrl ?? null,
        recording_url: recordingUrl ?? null,
        notes_provider: "manual",
        notes_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id)
      .select(MEETING_SELECT)
      .single()
    if (error || !data) return NextResponse.json({ error: "Failed to save notes" }, { status: 500 })
    return NextResponse.json({ success: true, meeting: mapMeeting(data as Record<string, unknown>) })
  }

  if (parsed.data.action === "email_summary") {
    if (!meeting.summary) return NextResponse.json({ error: "No notes on this meeting yet" }, { status: 400 })
    if (!meeting.leadEmail) return NextResponse.json({ error: "Lead has no email address" }, { status: 400 })
    const sent = await sendMeetingSummaryEmail(meeting)
    if (sent) {
      await supabase.from("lead_meetings").update({ summary_sent_at: new Date().toISOString() }).eq("id", meeting.id)
    }
    return NextResponse.json({ success: true, emailSent: sent, meeting: await loadMeeting(id, meetingId) })
  }

  // set_status
  if (!parsed.data.status) return NextResponse.json({ error: "Status is required" }, { status: 400 })
  const { data, error } = await supabase
    .from("lead_meetings")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", meeting.id)
    .select(MEETING_SELECT)
    .single()
  if (error || !data) return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 })
  return NextResponse.json({ success: true, meeting: mapMeeting(data as Record<string, unknown>) })
}
