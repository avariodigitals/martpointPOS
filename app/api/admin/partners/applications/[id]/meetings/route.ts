import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail, REPLY_TO } from "@/lib/email"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"
import { createMeetEvent, deleteCalendarEvent, getGoogleSettings, isGoogleConnected } from "@/lib/google-calendar"
import { getBaseUrl } from "@/lib/marketing"

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(10).max(240),
  meetingLink: z.string().trim().max(1000).optional().default("").refine((value) => !value || /^https?:\/\//i.test(value), "Meeting link must use http or https"),
  message: z.string().trim().max(3000).optional().default(""),
  /** When true, create a Google Meet event (if the account is connected) and use
   *  its link. An explicitly supplied meetingLink always wins. */
  createMeet: z.boolean().optional().default(false),
})

/** Business timezone used for the .ics and the partner-facing confirmation. */
const PARTNER_MEETING_TZ = "Africa/Lagos"

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!)
}

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")
}

function toIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

/* ─── GET: list stored meetings for the application ─── */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ meetings: [] })
  const { id } = await params
  const { data, error } = await supabase
    .from("partner_meetings")
    .select("id, title, scheduled_at, duration_minutes, timezone, meeting_link, provider, status, email_sent, team_notified, meet_error, created_by_name, created_at")
    .eq("application_id", id)
    .order("scheduled_at", { ascending: false })
  if (error) {
    console.error("[partner-application] meeting list failed", { applicationId: id, message: error.message })
    return NextResponse.json({ error: "Failed to load meetings" }, { status: 500 })
  }
  return NextResponse.json({ meetings: data || [] })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })
  const { id } = await params
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid meeting details" }, { status: 400 })

  const { data: application, error } = await supabase.from("partner_applications")
    .select("id, reference_number, full_name, business_name, email")
    .eq("id", id).single()
  if (error || !application) return NextResponse.json({ error: "Application not found" }, { status: 404 })
  if (!application.email) return NextResponse.json({ error: "Applicant has no email address" }, { status: 400 })

  const input = parsed.data
  const start = new Date(input.scheduledAt)
  if (start.getTime() <= Date.now()) return NextResponse.json({ error: "Meeting time must be in the future" }, { status: 400 })
  const end = new Date(start.getTime() + input.durationMinutes * 60_000)
  const formatted = new Intl.DateTimeFormat("en-NG", { dateStyle: "full", timeStyle: "short", timeZone: PARTNER_MEETING_TZ }).format(start)

  // Generate a Google Meet link when asked and no link was typed. Best-effort:
  // a disconnected Google account or an API error degrades to a link-less
  // invite rather than blocking the invitation.
  let meetingLink = input.meetingLink
  let meetError: string | undefined
  let googleEventId: string | null = null
  if (input.createMeet && !meetingLink) {
    try {
      const g = await getGoogleSettings()
      if (isGoogleConnected(g)) {
        const attendee = application.full_name
          ? `${input.title} — ${application.full_name}`
          : input.title
        const ev = await createMeetEvent({
          sendUpdates: false, // our branded email (with .ics) is the partner-facing notice
          summary: attendee,
          description: [
            `Partner application: ${application.reference_number}`,
            application.full_name ? `Applicant: ${application.full_name}` : null,
            application.business_name ? `Business: ${application.business_name}` : null,
            input.message ? `\n${input.message}` : null,
          ]
            .filter((l) => l !== null)
            .join("\n"),
          start,
          end,
          timezone: PARTNER_MEETING_TZ,
          attendeeEmail: application.email || undefined,
          attendeeName: application.full_name || undefined,
        })
        meetingLink = ev.meetLink
        googleEventId = ev.eventId
      } else {
        meetError = "Google account is not connected — add the Meet link manually or connect Google in Settings."
      }
    } catch (err) {
      meetError = err instanceof Error ? err.message : "Failed to create Google Meet"
      console.error("[partner-application] Google Meet creation failed:", meetError)
    }
  }

  const details = [
    `Meeting invitation: ${input.title}`,
    `Application: ${application.reference_number}`,
    `When: ${formatted} WAT`,
    `Duration: ${input.durationMinutes} minutes`,
    meetingLink ? `Join: ${meetingLink}` : "",
    input.message,
  ].filter(Boolean).join("\n")
  const event = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MartPoint//Partner Application//EN", "CALSCALE:GREGORIAN", "METHOD:REQUEST",
    "BEGIN:VEVENT", `UID:${crypto.randomUUID()}@martpoint.com.ng`, `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`, `DTEND:${toIcsDate(end)}`, `SUMMARY:${icsEscape(input.title)}`,
    `ORGANIZER;CN=MartPoint Partners:mailto:${REPLY_TO.partners.match(/<([^>]+)>/)?.[1] || "partners@martpoint.com.ng"}`,
    `ATTENDEE;CN=${icsEscape(application.full_name || application.email)};RSVP=TRUE:mailto:${application.email}`,
    meetingLink ? `LOCATION:${icsEscape(meetingLink)}` : null,
    `DESCRIPTION:${icsEscape(details)}`, "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n") + "\r\n"

  const sent = await sendEmail({
    to: application.email,
    subject: `Meeting invitation: ${input.title}`,
    text: `Hello ${application.full_name || "there"},\n\n${details}\n\nRegards,\nMartPoint Partners`,
    html: `<p>Hello ${escapeHtml(application.full_name || "there")},</p><p>You are invited to a meeting about your MartPoint partner application.</p><p><strong>${escapeHtml(input.title)}</strong><br>${escapeHtml(formatted)} WAT · ${input.durationMinutes} minutes</p>${meetingLink ? `<p><a href="${escapeHtml(meetingLink)}">Join meeting</a></p>` : ""}${input.message ? `<p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>` : ""}<p>Application reference: ${escapeHtml(application.reference_number)}</p><p>Regards,<br>MartPoint Partners</p>`,
    replyTo: REPLY_TO.partners,
    route: "partners",
    attachments: [{ filename: "meeting-invitation.ics", content: Buffer.from(event).toString("base64") }],
  })

  // Heads-up to partner ops so the team can prepare. Recipients come from the
  // `partner_application` email route (partners@martpoint.com.ng by default).
  // Best-effort: a delivery failure never blocks the applicant invitation.
  const teamNotified = await sendEmail({
    route: "partner_application",
    subject: `Partner meeting booked: ${application.full_name || application.email} — ${formatted} WAT`,
    text: [
      `A meeting was scheduled with a partner applicant.`,
      ``,
      `Title: ${input.title}`,
      `Application: ${application.reference_number}`,
      `Applicant: ${application.full_name || "—"}${application.business_name ? ` (${application.business_name})` : ""}`,
      `Email: ${application.email}`,
      `When: ${formatted} WAT · ${input.durationMinutes} minutes`,
      meetingLink ? `Google Meet: ${meetingLink}` : `No Meet link (${meetError || "not requested"})`,
      input.message ? `\nMessage: ${input.message}` : "",
      ``,
      `Review: ${getBaseUrl()}/admin/partners/applications/${id}`,
    ].filter(Boolean).join("\n"),
  }).catch((err) => {
    console.error("[partner-application] team meeting notification failed:", err)
    return false
  })

  // Persist the meeting so it can be listed/cancelled later (not just timeline prose).
  const { data: meetingRow, error: meetingError } = await supabase
    .from("partner_meetings")
    .insert({
      application_id: id,
      title: input.title,
      scheduled_at: start.toISOString(),
      duration_minutes: input.durationMinutes,
      timezone: PARTNER_MEETING_TZ,
      meeting_link: meetingLink || null,
      provider: meetingLink ? "Google Meet" : null,
      google_event_id: googleEventId,
      status: "SCHEDULED",
      message: input.message || null,
      email_sent: sent,
      team_notified: teamNotified,
      meet_error: meetError || null,
      created_by: session!.userId,
      created_by_name: session!.name || session!.username,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (meetingError) {
    console.error("[partner-application] meeting row insert failed", { applicationId: id, message: meetingError.message })
  }

  const historyText = `${input.title}\nScheduled: ${formatted} WAT · ${input.durationMinutes} minutes${meetingLink ? `\nJoin: ${meetingLink}` : ""}${googleEventId ? `\nGoogle event: ${googleEventId}` : ""}${input.message ? `\nMessage: ${input.message}` : ""}\nInvitation email ${sent ? "sent" : "could not be sent"} to ${application.email}.${teamNotified ? " Team notified." : ""}`
  const { error: historyError } = await supabase.from("partner_status_history").insert({
    application_id: id,
    previous_status: null,
    new_status: "MEETING",
    reason: historyText,
    changed_by: session!.userId,
    changed_by_name: session!.name || session!.username,
    event_type: sent ? "MEETING_INVITED" : "MEETING_EMAIL_FAILED",
  })
  if (historyError) {
    console.error("[partner-application] meeting history insert failed", { applicationId: id, message: historyError.message })
    return NextResponse.json({ error: sent ? "Invitation sent, but the timeline event could not be recorded" : "Invitation email and timeline save both failed" }, { status: 500 })
  }
  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.PARTNER_APPLICATION_STATUS_CHANGED,
    entityType: AUDIT_ENTITIES.PARTNER_APPLICATION,
    entityId: id,
    metadata: {
      reference: application.reference_number,
      eventType: sent ? "MEETING_INVITED" : "MEETING_EMAIL_FAILED",
      meetingId: meetingRow?.id ?? null,
      googleEventId,
      teamNotified,
    },
  })
  return NextResponse.json({
    success: true,
    emailSent: sent,
    teamNotified,
    meetingId: meetingRow?.id ?? null,
    meetingLink: meetingLink || null,
    meetError,
  })
}

/* ─── PATCH: cancel or reschedule a stored meeting ─── */

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancel"),
    meetingId: z.string().uuid(),
    /** Optional note sent to the applicant with the cancellation. */
    reason: z.string().trim().max(1000).optional().default(""),
    /** When true, the applicant gets a cancellation email. */
    notify: z.boolean().optional().default(true),
  }),
  z.object({
    action: z.literal("reschedule"),
    meetingId: z.string().uuid(),
    scheduledAt: z.string().datetime(),
    durationMinutes: z.number().int().min(10).max(240).optional(),
    notify: z.boolean().optional().default(true),
  }),
])

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })
  const { id } = await params

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 })

  const { data: application, error: appError } = await supabase.from("partner_applications")
    .select("id, reference_number, full_name, business_name, email")
    .eq("id", id).single()
  if (appError || !application) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const { data: meeting, error: meetLoadError } = await supabase.from("partner_meetings")
    .select("id, application_id, title, scheduled_at, duration_minutes, meeting_link, google_event_id, status")
    .eq("id", parsed.data.meetingId)
    .eq("application_id", id)
    .single()
  if (meetLoadError || !meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 })

  const now = new Date()
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-NG", { dateStyle: "full", timeStyle: "short", timeZone: PARTNER_MEETING_TZ }).format(d)
  const whenOld = fmt(new Date(meeting.scheduled_at as string))
  const actor = session!.name || session!.username

  /* ── cancel ── */
  if (parsed.data.action === "cancel") {
    if (meeting.status === "CANCELLED") return NextResponse.json({ error: "This meeting is already cancelled." }, { status: 409 })

    // Remove the Google Calendar event (which also removes the Meet link) so the
    // organiser's calendar and the applicant's invite don't go stale.
    let calendarDeleted = false
    if (meeting.google_event_id) {
      try {
        await deleteCalendarEvent(meeting.google_event_id as string)
        calendarDeleted = true
      } catch (err) {
        console.error("[partner-application] calendar delete failed:", err instanceof Error ? err.message : err)
      }
    }

    const { error: updError } = await supabase.from("partner_meetings")
      .update({ status: "CANCELLED", updated_at: now.toISOString() })
      .eq("id", meeting.id)
    if (updError) {
      console.error("[partner-application] cancel update failed", { meetingId: meeting.id, message: updError.message })
      return NextResponse.json({ error: "Failed to cancel the meeting" }, { status: 500 })
    }

    let emailSent = false
    if (parsed.data.notify && application.email) {
      emailSent = await sendEmail({
        to: application.email,
        subject: `Meeting cancelled: ${meeting.title}`,
        text: `Hello ${application.full_name || "there"},\n\nThe following meeting about your MartPoint partner application has been cancelled.\n\n${meeting.title}\nWas scheduled: ${whenOld} WAT${parsed.data.reason ? `\n\n${parsed.data.reason}` : ""}\n\nWe'll be in touch to arrange another time.\n\nRegards,\nMartPoint Partners`,
        html: `<p>Hello ${escapeHtml(application.full_name || "there")},</p><p>The following meeting about your MartPoint partner application has been <strong>cancelled</strong>.</p><p><strong>${escapeHtml(meeting.title as string)}</strong><br>Was scheduled: ${escapeHtml(whenOld)} WAT</p>${parsed.data.reason ? `<p>${escapeHtml(parsed.data.reason).replace(/\n/g, "<br>")}</p>` : ""}<p>We'll be in touch to arrange another time.</p><p>Regards,<br>MartPoint Partners</p>`,
        replyTo: REPLY_TO.partners,
        route: "partners",
        attachments: [{
          filename: "meeting-cancelled.ics",
          content: Buffer.from([
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MartPoint//Partner Application//EN", "CALSCALE:GREGORIAN", "METHOD:CANCEL",
            "BEGIN:VEVENT", `UID:${meeting.google_event_id || crypto.randomUUID()}@martpoint.com.ng`, `DTSTAMP:${toIcsDate(now)}`,
            `DTSTART:${toIcsDate(new Date(meeting.scheduled_at as string))}`,
            `DTEND:${toIcsDate(new Date(new Date(meeting.scheduled_at as string).getTime() + (meeting.duration_minutes as number) * 60_000))}`,
            `SUMMARY:${icsEscape(meeting.title as string)}`, "STATUS:CANCELLED",
            `ORGANIZER;CN=MartPoint Partners:mailto:${REPLY_TO.partners.match(/<([^>]+)>/)?.[1] || "partners@martpoint.com.ng"}`,
            `ATTENDEE;CN=${icsEscape(application.full_name || application.email)};RSVP=TRUE:mailto:${application.email}`,
            "SEQUENCE:1", "END:VEVENT", "END:VCALENDAR",
          ].join("\r\n") + "\r\n").toString("base64"),
        }],
      })
    }

    await supabase.from("partner_status_history").insert({
      application_id: id,
      previous_status: null,
      new_status: "MEETING",
      reason: `Meeting cancelled: ${meeting.title}\nWas scheduled: ${whenOld} WAT${calendarDeleted ? "\nGoogle Calendar event removed." : ""}${parsed.data.reason ? `\nReason: ${parsed.data.reason}` : ""}${emailSent ? "\nCancellation email sent to the applicant." : ""}`,
      changed_by: session!.userId,
      changed_by_name: actor,
      event_type: "MEETING_CANCELLED",
    })

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.PARTNER_APPLICATION_STATUS_CHANGED,
      entityType: AUDIT_ENTITIES.PARTNER_APPLICATION,
      entityId: id,
      metadata: { reference: application.reference_number, eventType: "MEETING_CANCELLED", meetingId: meeting.id, calendarDeleted },
    })

    return NextResponse.json({ success: true, emailSent, calendarDeleted })
  }

  /* ── reschedule ── */
  const start = new Date(parsed.data.scheduledAt)
  if (start.getTime() <= Date.now()) return NextResponse.json({ error: "New meeting time must be in the future" }, { status: 400 })
  if (meeting.status === "CANCELLED") return NextResponse.json({ error: "This meeting was cancelled — schedule a new one instead." }, { status: 409 })

  const duration = parsed.data.durationMinutes ?? (meeting.duration_minutes as number)
  const whenNew = fmt(start)

  // Delete the old calendar event (if any) and create a fresh one so the Meet
  // link and attendee list stay in sync with the new time.
  let newLink: string | null = null
  let newEventId: string | null = null
  let provider: string | null = meeting.meeting_link ? "Google Meet" : null
  let meetError: string | undefined
  if (meeting.google_event_id) {
    try {
      await deleteCalendarEvent(meeting.google_event_id as string)
    } catch (err) {
      console.error("[partner-application] reschedule: old event delete failed:", err instanceof Error ? err.message : err)
    }
  }
  try {
    const g = await getGoogleSettings()
    if (isGoogleConnected(g)) {
      const ev = await createMeetEvent({
        sendUpdates: false,
        summary: application.full_name ? `${meeting.title} — ${application.full_name}` : (meeting.title as string),
        description: [
          `Partner application: ${application.reference_number}`,
          application.full_name ? `Applicant: ${application.full_name}` : null,
          application.business_name ? `Business: ${application.business_name}` : null,
        ].filter((l) => l !== null).join("\n"),
        start,
        end: new Date(start.getTime() + duration * 60_000),
        timezone: PARTNER_MEETING_TZ,
        attendeeEmail: application.email || undefined,
        attendeeName: application.full_name || undefined,
      })
      newLink = ev.meetLink
      newEventId = ev.eventId
      provider = "Google Meet"
    } else {
      meetError = "Google account is not connected — the Meet link was not regenerated."
    }
  } catch (err) {
    meetError = err instanceof Error ? err.message : "Failed to create Google Meet"
    console.error("[partner-application] reschedule: Meet creation failed:", meetError)
  }

  // Fall back to the previous link when we couldn't mint a new one.
  const meetingLink = newLink || (meeting.meeting_link as string | null)

  const { error: updError } = await supabase.from("partner_meetings")
    .update({
      scheduled_at: start.toISOString(),
      duration_minutes: duration,
      meeting_link: meetingLink,
      provider,
      google_event_id: newEventId,
      meet_error: meetError || null,
      updated_at: now.toISOString(),
    })
    .eq("id", meeting.id)
  if (updError) {
    console.error("[partner-application] reschedule update failed", { meetingId: meeting.id, message: updError.message })
    return NextResponse.json({ error: "Failed to reschedule the meeting" }, { status: 500 })
  }

  const details = [
    `Meeting invitation (rescheduled): ${meeting.title}`,
    `Application: ${application.reference_number}`,
    `New time: ${whenNew} WAT`,
    `Duration: ${duration} minutes`,
    meetingLink ? `Join: ${meetingLink}` : "",
  ].filter(Boolean).join("\n")

  let emailSent = false
  if (parsed.data.notify && application.email) {
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MartPoint//Partner Application//EN", "CALSCALE:GREGORIAN", "METHOD:REQUEST",
      "BEGIN:VEVENT", `UID:${newEventId || crypto.randomUUID()}@martpoint.com.ng`, `DTSTAMP:${toIcsDate(now)}`,
      `DTSTART:${toIcsDate(start)}`, `DTEND:${toIcsDate(new Date(start.getTime() + duration * 60_000))}`,
      `SUMMARY:${icsEscape(meeting.title as string)}`,
      `ORGANIZER;CN=MartPoint Partners:mailto:${REPLY_TO.partners.match(/<([^>]+)>/)?.[1] || "partners@martpoint.com.ng"}`,
      `ATTENDEE;CN=${icsEscape(application.full_name || application.email)};RSVP=TRUE:mailto:${application.email}`,
      meetingLink ? `LOCATION:${icsEscape(meetingLink)}` : null,
      `DESCRIPTION:${icsEscape(details)}`, "SEQUENCE:1", "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n") + "\r\n"
    emailSent = await sendEmail({
      to: application.email,
      subject: `Meeting rescheduled: ${meeting.title}`,
      text: `Hello ${application.full_name || "there"},\n\nYour meeting about your MartPoint partner application has been moved.\n\n${details}\n\nRegards,\nMartPoint Partners`,
      html: `<p>Hello ${escapeHtml(application.full_name || "there")},</p><p>Your meeting about your MartPoint partner application has been <strong>rescheduled</strong>.</p><p><strong>${escapeHtml(meeting.title as string)}</strong><br>New time: ${escapeHtml(whenNew)} WAT · ${duration} minutes</p>${meetingLink ? `<p><a href="${escapeHtml(meetingLink)}">Join meeting</a></p>` : ""}<p>Regards,<br>MartPoint Partners</p>`,
      replyTo: REPLY_TO.partners,
      route: "partners",
      attachments: [{ filename: "meeting-invitation.ics", content: Buffer.from(ics).toString("base64") }],
    })
  }

  await supabase.from("partner_status_history").insert({
    application_id: id,
    previous_status: null,
    new_status: "MEETING",
    reason: `Meeting rescheduled: ${meeting.title}\nFrom: ${whenOld} WAT\nTo: ${whenNew} WAT · ${duration} minutes${meetingLink ? `\nJoin: ${meetingLink}` : ""}${emailSent ? "\nUpdated invitation emailed to the applicant." : ""}`,
    changed_by: session!.userId,
    changed_by_name: actor,
    event_type: "MEETING_RESCHEDULED",
  })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.PARTNER_APPLICATION_STATUS_CHANGED,
    entityType: AUDIT_ENTITIES.PARTNER_APPLICATION,
    entityId: id,
    metadata: { reference: application.reference_number, eventType: "MEETING_RESCHEDULED", meetingId: meeting.id, googleEventId: newEventId },
  })

  return NextResponse.json({ success: true, emailSent, meetingLink, meetError })
}
