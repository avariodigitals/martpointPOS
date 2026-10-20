import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import {
  MEETING_SELECT,
  mapMeeting,
  cancelMeeting,
  sendMeetingInviteEmail,
  draftMeetingFollowupEmail,
  sendMeetingFollowupEmail,
  sendMeetingConfirmationEmails,
  computeAvailableSlots,
  attachGoogleMeet,
  meetEventSummary,
  meetEventDescription,
  meetingEventTimezone,
} from "@/lib/meeting-booking"
import { GoogleApiError, getGoogleSettings, isGoogleConnected, updateMeetEvent } from "@/lib/google-calendar"
import { isValidTimeZone } from "@/lib/scheduling"

const patchSchema = z.object({
  action: z.enum([
    "cancel",
    "resend_invite",
    "set_status",
    "save_notes",
    "draft_followup",
    "send_followup",
    "update",
    "create_meet",
  ]),
  status: z.enum(["COMPLETED", "NO_SHOW", "SCHEDULED"]).optional(),
  summary: z.string().nullable().optional(),
  actionItems: z.array(z.string()).nullable().optional(),
  transcript: z.string().nullable().optional(),
  transcriptUrl: z.string().nullable().optional(),
  recordingUrl: z.string().nullable().optional(),
  subject: z.string().max(300).optional(),
  body: z.string().max(20000).optional(),
  // update
  title: z.string().trim().min(1).max(200).optional(),
  scheduledAt: z.string().optional(),
  durationMinutes: z.number().int().min(10).max(240).optional(),
  timezone: z.string().trim().max(100).optional(),
  notes: z.string().max(5000).nullable().optional(),
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

  if (parsed.data.action === "draft_followup") {
    if (!meeting.summary && !meeting.transcript && !meeting.actionItems?.length) {
      return NextResponse.json({ error: "No notes on this meeting yet" }, { status: 400 })
    }
    if (!meeting.leadEmail) return NextResponse.json({ error: "Lead has no email address" }, { status: 400 })
    const draft = await draftMeetingFollowupEmail(meeting)
    if (!draft) return NextResponse.json({ error: "Could not draft an email — add a meeting summary first" }, { status: 422 })
    return NextResponse.json({ success: true, draft })
  }

  if (parsed.data.action === "send_followup") {
    const subject = parsed.data.subject?.trim() || ""
    const body = parsed.data.body?.trim() || ""
    if (!subject || !body) return NextResponse.json({ error: "Subject and message are required" }, { status: 400 })
    if (!meeting.leadEmail) return NextResponse.json({ error: "Lead has no email address" }, { status: 400 })
    const sent = await sendMeetingFollowupEmail(meeting, subject, body)
    if (sent) {
      await supabase.from("lead_meetings").update({ summary_sent_at: new Date().toISOString() }).eq("id", meeting.id)
    }
    return NextResponse.json({ success: true, emailSent: sent, meeting: await loadMeeting(id, meetingId) })
  }

  if (parsed.data.action === "update") {
    if (meeting.status !== "PENDING" && meeting.status !== "SCHEDULED") {
      return NextResponse.json({ error: "Only active meetings can be edited." }, { status: 409 })
    }

    const title = parsed.data.title?.trim() || meeting.title
    const durationMinutes = parsed.data.durationMinutes ?? meeting.durationMinutes
    const timezone = parsed.data.timezone || meeting.timezone
    if (!isValidTimeZone(timezone)) return NextResponse.json({ error: "Invalid timezone" }, { status: 400 })

    let scheduledAt = meeting.scheduledAt
    if (parsed.data.scheduledAt) {
      const next = new Date(parsed.data.scheduledAt)
      if (Number.isNaN(next.getTime())) return NextResponse.json({ error: "Invalid date/time" }, { status: 400 })
      scheduledAt = next.toISOString()
    }
    if (meeting.status === "SCHEDULED" && !scheduledAt) {
      return NextResponse.json({ error: "Scheduled date/time is required" }, { status: 400 })
    }

    const timeChanged = Boolean(scheduledAt && scheduledAt !== meeting.scheduledAt)
    const durationChanged = durationMinutes !== meeting.durationMinutes
    const titleChanged = title !== meeting.title
    if (timeChanged && new Date(scheduledAt!).getTime() <= Date.now()) {
      return NextResponse.json({ error: "The new meeting time must be in the future" }, { status: 400 })
    }

    let meetingLink = meeting.meetingLink
    let googleEventId = meeting.googleEventId
    let warning: string | undefined
    const g = await getGoogleSettings()

    if (googleEventId && scheduledAt && (timeChanged || durationChanged || titleChanged)) {
      if (!isGoogleConnected(g)) {
        warning =
          "Saved, but the Google Calendar event was not updated because Google is disconnected. Reconnect Google in Settings → Google Meet, then reschedule again to sync it."
      } else {
        const edited = { ...meeting, title, durationMinutes, timezone, scheduledAt }
        try {
          const event = await updateMeetEvent(googleEventId, {
            summary: meetEventSummary(edited),
            description: meetEventDescription(edited),
            start: new Date(scheduledAt),
            end: new Date(new Date(scheduledAt).getTime() + durationMinutes * 60_000),
            timezone: await meetingEventTimezone(edited),
            attendeeEmail: meeting.leadEmail || undefined,
            attendeeName: meeting.leadFullName || undefined,
          })
          if (event.meetLink) meetingLink = event.meetLink
          googleEventId = event.eventId
        } catch (err) {
          // The event was deleted in Google Calendar — mint a fresh Meet instead of blocking the edit.
          if (err instanceof GoogleApiError && err.status === 404) {
            try {
              const fresh = await attachGoogleMeet(edited, { sendUpdates: false })
              if (!fresh) throw new Error("Google Meet is not available.")
              meetingLink = fresh.meetingLink
              googleEventId = fresh.eventId
            } catch (createErr) {
              return NextResponse.json(
                { error: `Google Meet could not be created: ${createErr instanceof Error ? createErr.message : "unknown error"}` },
                { status: 502 },
              )
            }
          } else {
            return NextResponse.json(
              { error: `Google Calendar could not be updated: ${err instanceof Error ? err.message : "unknown error"}` },
              { status: 502 },
            )
          }
        }
      }
    }

    const { data, error } = await supabase
      .from("lead_meetings")
      .update({
        title,
        duration_minutes: durationMinutes,
        timezone,
        scheduled_at: scheduledAt,
        notes: parsed.data.notes === undefined ? meeting.notes : parsed.data.notes,
        meeting_link: meetingLink,
        google_event_id: googleEventId,
        google_calendar_id: googleEventId ? g.calendarId : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id)
      .select(MEETING_SELECT)
      .single()
    if (error || !data) {
      console.error("[Lead Meeting PATCH update]", error)
      if (error?.code === "23505") {
        return NextResponse.json({ error: "Another meeting already starts at that time." }, { status: 409 })
      }
      return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 })
    }

    const updated = mapMeeting(data as Record<string, unknown>)
    let emailSent = false
    if ((timeChanged || durationChanged) && updated.scheduledAt) {
      emailSent = await sendMeetingConfirmationEmails(updated, { notifyTeam: false, rescheduled: true })
        .then(() => true)
        .catch((err) => {
          console.error("[Lead Meeting PATCH update] reschedule email failed:", err)
          return false
        })
    }
    return NextResponse.json({ success: true, meeting: updated, emailSent, warning, scheduleChanged: timeChanged || durationChanged })
  }

  if (parsed.data.action === "create_meet") {
    if (meeting.status !== "SCHEDULED" || !meeting.scheduledAt) {
      return NextResponse.json({ error: "Only a scheduled meeting can get a Meet link." }, { status: 400 })
    }
    if (meeting.meetingLink) {
      return NextResponse.json({ success: true, meeting, emailSent: false })
    }

    const g = await getGoogleSettings()
    if (!isGoogleConnected(g)) {
      return NextResponse.json(
        { error: "Google account is not connected — connect it in Settings → Google Meet, then try again." },
        { status: 400 },
      )
    }

    let meet: { meetingLink: string; eventId: string } | null = null
    try {
      meet = await attachGoogleMeet(meeting, { sendUpdates: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create Google Meet"
      console.error("[Lead Meeting PATCH create_meet]", message)
      return NextResponse.json({ error: message }, { status: 502 })
    }
    if (!meet) {
      return NextResponse.json({ error: "Google Meet could not be created." }, { status: 502 })
    }

    const { data, error } = await supabase
      .from("lead_meetings")
      .update({
        meeting_link: meet.meetingLink,
        provider: "Google Meet",
        google_event_id: meet.eventId,
        google_calendar_id: g.calendarId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id)
      .select(MEETING_SELECT)
      .single()
    if (error || !data) {
      console.error("[Lead Meeting PATCH create_meet]", error)
      return NextResponse.json({ error: "Meet link created but could not be saved — try again." }, { status: 500 })
    }

    const updated = mapMeeting(data as Record<string, unknown>)
    const emailSent = await sendMeetingConfirmationEmails(updated, { notifyTeam: false })
      .then(() => true)
      .catch((err) => {
        console.error("[Lead Meeting PATCH create_meet] confirmation email failed:", err)
        return false
      })
    return NextResponse.json({ success: true, meeting: updated, emailSent })
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
