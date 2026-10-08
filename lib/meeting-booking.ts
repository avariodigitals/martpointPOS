/* ───────────────────  Lead meeting booking (server-only)  ───────────────────
 * Shared by the admin meetings API and the public /api/meetings/[token] route.
 *
 * Flow:
 *   admin "invite"  → PENDING row (+ optional hand-picked proposed_slots) → invite email
 *   lead picks slot → validate against open slots → Google Meet event → SCHEDULED
 *                     → confirmation email to lead + heads-up to sales
 *   admin "direct"  → SCHEDULED row immediately (optionally with a Meet link)
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, type EmailAttachment } from "./email"
import { sendLeadEmail, escapeHtml } from "./lead-email-outbound"
import { renderEmailTemplate } from "./email-templates"
import { getBaseUrl } from "./marketing"
import {
  normalizeScheduling,
  generateSlots,
  filterProposedSlots,
  type SchedulingSettings,
  type BusyInterval,
} from "./scheduling"
import { createMeetEvent, deleteCalendarEvent, getBusyIntervals, getGoogleSettings, isGoogleConnected } from "./google-calendar"

export type MeetingStatus = "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"

export interface MeetingRecord {
  id: string
  leadId: string
  customerToken: string
  title: string
  scheduledAt: string | null
  durationMinutes: number
  timezone: string
  meetingLink: string | null
  provider: string | null
  status: MeetingStatus
  notes: string | null
  proposedSlots: string[] | null
  leadTimezone: string | null
  selectedAt: string | null
  inviteSentAt: string | null
  expiresAt: string | null
  googleEventId: string | null
  summary: string | null
  actionItems: string[] | null
  transcript: string | null
  transcriptUrl: string | null
  recordingUrl: string | null
  notesProvider: string | null
  notesReceivedAt: string | null
  summarySentAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  leadFullName?: string
  leadBusinessName?: string
  leadEmail?: string
  leadPhone?: string
}

export const MEETING_SELECT = "*, leads(full_name, business_name, email, phone)"

export function mapMeeting(row: Record<string, unknown>): MeetingRecord {
  const lead = (row.leads as Record<string, unknown> | undefined) || {}
  return {
    id: row.id as string,
    leadId: row.lead_id as string,
    customerToken: row.customer_token as string,
    title: row.title as string,
    scheduledAt: (row.scheduled_at as string) ?? null,
    durationMinutes: row.duration_minutes as number,
    timezone: row.timezone as string,
    meetingLink: (row.meeting_link as string) ?? null,
    provider: (row.provider as string) ?? null,
    status: row.status as MeetingStatus,
    notes: (row.notes as string) ?? null,
    proposedSlots: Array.isArray(row.proposed_slots) ? (row.proposed_slots as string[]) : null,
    leadTimezone: (row.lead_timezone as string) ?? null,
    selectedAt: (row.selected_at as string) ?? null,
    inviteSentAt: (row.invite_sent_at as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
    googleEventId: (row.google_event_id as string) ?? null,
    summary: (row.summary as string) ?? null,
    actionItems: Array.isArray(row.action_items) ? (row.action_items as string[]) : null,
    transcript: (row.transcript as string) ?? null,
    transcriptUrl: (row.transcript_url as string) ?? null,
    recordingUrl: (row.recording_url as string) ?? null,
    notesProvider: (row.notes_provider as string) ?? null,
    notesReceivedAt: (row.notes_received_at as string) ?? null,
    summarySentAt: (row.summary_sent_at as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    leadFullName: lead.full_name as string | undefined,
    leadBusinessName: lead.business_name as string | undefined,
    leadEmail: lead.email as string | undefined,
    leadPhone: lead.phone as string | undefined,
  }
}

export function meetingPageUrl(token: string): string {
  return `${getBaseUrl()}/meeting/${token}`
}

/* ─── Settings ─── */

export async function getSchedulingSettings(): Promise<SchedulingSettings> {
  if (!isSupabaseConfigured()) return normalizeScheduling(null)
  const { data } = await supabase.from("settings").select("data").eq("id", 1).single()
  return normalizeScheduling((data?.data as Record<string, unknown> | undefined)?.scheduling)
}

/* ─── Busy intervals: Google Calendar + our own scheduled meetings ─── */

export async function getBusyForRange(from: Date, to: Date, excludeMeetingId?: string): Promise<BusyInterval[]> {
  const busy: BusyInterval[] = []

  if (isSupabaseConfigured()) {
    let q = supabase
      .from("lead_meetings")
      .select("id, scheduled_at, duration_minutes")
      .eq("status", "SCHEDULED")
      .gte("scheduled_at", new Date(from.getTime() - 6 * 3_600_000).toISOString())
      .lte("scheduled_at", to.toISOString())
    if (excludeMeetingId) q = q.neq("id", excludeMeetingId)
    const { data } = await q
    for (const m of data || []) {
      const start = new Date(m.scheduled_at as string)
      busy.push({ start, end: new Date(start.getTime() + ((m.duration_minutes as number) || 30) * 60_000) })
    }
  }

  try {
    const g = await getGoogleSettings()
    if (isGoogleConnected(g)) busy.push(...(await getBusyIntervals(from, to)))
  } catch (err) {
    console.warn("[meetings] Google freebusy unavailable:", err instanceof Error ? err.message : err)
  }

  return busy
}

/* ─── Open slots for a pending invite ─── */

export async function computeAvailableSlots(meeting: MeetingRecord, settings?: SchedulingSettings): Promise<string[]> {
  const cfg = settings ?? (await getSchedulingSettings())
  const now = new Date()
  const duration = meeting.durationMinutes || cfg.slotMinutes

  if (meeting.proposedSlots && meeting.proposedSlots.length > 0) {
    const times = meeting.proposedSlots.map((s) => new Date(s).getTime()).filter(Number.isFinite)
    if (times.length === 0) return []
    const from = new Date(Math.min(...times) - 3_600_000)
    const to = new Date(Math.max(...times) + duration * 60_000 + 3_600_000)
    const busy = await getBusyForRange(from, to, meeting.id)
    return filterProposedSlots(meeting.proposedSlots, { durationMinutes: duration, busy, bufferMinutes: cfg.bufferMinutes, now }).map((d) =>
      d.toISOString(),
    )
  }

  const to = new Date(now.getTime() + cfg.maxDaysAhead * 86_400_000)
  const busy = await getBusyForRange(now, to, meeting.id)
  return generateSlots({ settings: cfg, durationMinutes: duration, from: now, to, busy, now }).map((d) => d.toISOString())
}

/* ─── Formatting helpers ─── */

export function formatWhen(iso: string, tz: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  })
}

/* ─── Calendar (.ics) attachment ───
 * Sent inside our branded confirmation email so the lead gets an
 * "Add to Calendar" card instead of Google's bare invite from an
 * address they don't know.
 */
function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

export function buildMeetingIcs(meeting: MeetingRecord): EmailAttachment | null {
  if (!meeting.scheduledAt) return null
  const start = new Date(meeting.scheduledAt)
  const end = new Date(start.getTime() + meeting.durationMinutes * 60_000)
  const description = [
    meeting.meetingLink ? `Join: ${meeting.meetingLink}` : "",
    `Details: ${meetingPageUrl(meeting.customerToken)}`,
  ]
    .filter(Boolean)
    .join("\n")

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MartPoint//Meeting Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${meeting.googleEventId || meeting.id}@martpoint.com.ng`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(meeting.title)}`,
    "ORGANIZER;CN=MartPoint:mailto:hello@martpoint.com.ng",
    meeting.leadEmail
      ? `ATTENDEE;CN=${icsEscape(meeting.leadFullName || meeting.leadEmail)};RSVP=TRUE:mailto:${meeting.leadEmail}`
      : null,
    meeting.meetingLink ? `LOCATION:${icsEscape(meeting.meetingLink)}` : null,
    `DESCRIPTION:${icsEscape(description)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter((l): l is string => Boolean(l))
    .join("\r\n")

  return {
    filename: "invite.ics",
    content: Buffer.from(`${lines}\r\n`).toString("base64"),
  }
}

function firstName(full?: string | null): string {
  return (full || "").trim().split(/\s+/)[0] || "there"
}

/* ─── Emails ─── */

export async function sendMeetingInviteEmail(meeting: MeetingRecord): Promise<boolean> {
  if (!meeting.leadEmail) return false
  const url = meetingPageUrl(meeting.customerToken)

  const tpl = await renderEmailTemplate("meeting_invite", {
    fullName: firstName(meeting.leadFullName),
    businessNameBlock: meeting.leadBusinessName ? ` for ${meeting.leadBusinessName}` : "",
    title: meeting.title,
    durationMinutes: meeting.durationMinutes,
    bookingUrl: url,
  })

  const result = await sendLeadEmail({
    leadId: meeting.leadId,
    to: meeting.leadEmail,
    subject: tpl.subject,
    body: tpl.text,
    html: tpl.html,
    metadata: { meeting_id: meeting.id, kind: "meeting_invite" },
  })
  return result.sent
}

export async function sendMeetingConfirmationEmails(
  meeting: MeetingRecord,
  opts: { notifyTeam?: boolean } = {},
): Promise<void> {
  if (!meeting.scheduledAt) return
  const leadTz = meeting.leadTimezone || meeting.timezone
  const whenLead = formatWhen(meeting.scheduledAt, leadTz)
  const whenTeam = formatWhen(meeting.scheduledAt, meeting.timezone)
  const url = meetingPageUrl(meeting.customerToken)

  if (meeting.leadEmail) {
    const joinLine = meeting.meetingLink
      ? `Join with Google Meet: ${meeting.meetingLink}`
      : `Your meeting details and join link: ${url}`
    const joinBlock = `<p style="margin:0 0 24px; text-align:center;"><a href="${
      meeting.meetingLink || url
    }" style="display:inline-block; background-color:#0057FF; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:8px; font-size:15px; font-weight:600;">${
      meeting.meetingLink ? "Join Google Meet" : "View meeting details"
    }</a></p>`

    const tpl = await renderEmailTemplate("meeting_confirmation", {
      fullName: firstName(meeting.leadFullName),
      title: meeting.title,
      when: whenLead,
      durationMinutes: meeting.durationMinutes,
      joinLine,
      joinBlock,
      detailsUrl: url,
    })

    const ics = buildMeetingIcs(meeting)

    await sendLeadEmail({
      leadId: meeting.leadId,
      to: meeting.leadEmail,
      // hello@ sends the acceptance; copy Sales + Support so each function can
      // trace business meetings from the mailbox it owns.
      cc: ["sales@martpoint.com.ng", "support@martpoint.com.ng"],
      subject: tpl.subject,
      body: tpl.text,
      html: tpl.html,
      attachments: ics ? [ics] : undefined,
      metadata: { meeting_id: meeting.id, kind: "meeting_confirmation" },
    })
  }

  // Heads-up to the sales team (route-configured recipients).
  if (opts.notifyTeam === false) return
  await sendEmail({
    route: "lead_submission",
    cc: "support@martpoint.com.ng",
    subject: `Meeting booked: ${meeting.leadFullName || meeting.leadEmail || "Lead"} — ${whenTeam}`,
    text: [
      `${meeting.leadFullName || "A lead"}${meeting.leadBusinessName ? ` (${meeting.leadBusinessName})` : ""} booked "${meeting.title}".`,
      ``,
      `When: ${whenTeam}`,
      `Duration: ${meeting.durationMinutes} minutes`,
      `Lead: ${meeting.leadEmail || ""} ${meeting.leadPhone || ""}`.trim(),
      meeting.meetingLink ? `Google Meet: ${meeting.meetingLink}` : `No Meet link was generated — connect Google in Settings.`,
      ``,
      `Admin: ${getBaseUrl()}/admin/calendar`,
    ].join("\n"),
  })
}

/** Share the AI-generated recap + action items with the lead. */
export async function sendMeetingSummaryEmail(meeting: MeetingRecord): Promise<boolean> {
  if (!meeting.leadEmail || !meeting.summary) return false
  const when = meeting.scheduledAt ? ` on ${formatWhen(meeting.scheduledAt, meeting.leadTimezone || meeting.timezone)}` : ""

  const items = meeting.actionItems ?? []
  const actionItemsText = items.length ? `Action items:\n${items.map((i) => `• ${i}`).join("\n")}` : ""
  const actionItemsBlock = items.length
    ? `<p style="font-size:14px; color:#6b7280; margin:0 0 6px;">Action items</p>
              <ul style="font-size:14px; line-height:1.7; color:#111827; margin:0 0 24px; padding-left:20px;">
                ${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("\n                ")}
              </ul>`
    : ""

  const tpl = await renderEmailTemplate("meeting_summary", {
    fullName: firstName(meeting.leadFullName),
    title: meeting.title,
    when,
    summary: meeting.summary,
    summaryHtml: escapeHtml(meeting.summary).replace(/\n/g, "<br>"),
    actionItemsText,
    actionItemsBlock,
    linksText: "",
    linksBlock: "",
  })

  const result = await sendLeadEmail({
    leadId: meeting.leadId,
    to: meeting.leadEmail,
    subject: tpl.subject,
    body: tpl.text,
    html: tpl.html,
    metadata: { meeting_id: meeting.id, kind: "meeting_summary" },
  })
  return result.sent
}

/* ─── Create the Google Meet event for a meeting (best effort) ─── */

export async function attachGoogleMeet(
  meeting: MeetingRecord,
  opts: { sendUpdates?: boolean } = {},
): Promise<{ meetingLink: string; eventId: string } | null> {
  if (!meeting.scheduledAt) return null
  const g = await getGoogleSettings()
  if (!isGoogleConnected(g)) return null

  const start = new Date(meeting.scheduledAt)
  const end = new Date(start.getTime() + meeting.durationMinutes * 60_000)
  const who = [meeting.leadFullName, meeting.leadBusinessName].filter(Boolean).join(" · ")
  const event = await createMeetEvent({
    sendUpdates: opts.sendUpdates,
    summary: who ? `${meeting.title} — ${who}` : meeting.title,
    description: [
      meeting.leadFullName ? `Lead: ${meeting.leadFullName}` : null,
      meeting.leadBusinessName ? `Business: ${meeting.leadBusinessName}` : null,
      meeting.leadEmail ? `Email: ${meeting.leadEmail}` : null,
      meeting.leadPhone ? `Phone: ${meeting.leadPhone}` : null,
      ``,
      `Booking page: ${meetingPageUrl(meeting.customerToken)}`,
    ]
      .filter((l) => l !== null)
      .join("\n"),
    start,
    end,
    timezone: meeting.timezone,
    attendeeEmail: meeting.leadEmail || undefined,
    attendeeName: meeting.leadFullName || undefined,
  })
  return { meetingLink: event.meetLink, eventId: event.eventId }
}

/* ─── Confirm a slot (used by the public booking page) ─── */

export async function confirmMeetingSlot(
  meeting: MeetingRecord,
  slotIso: string,
  leadTimezone?: string | null,
): Promise<{ ok: true; meeting: MeetingRecord; meetError?: string } | { ok: false; error: string; status: number }> {
  if (meeting.status !== "PENDING") return { ok: false, error: "This invitation has already been used.", status: 409 }
  if (meeting.expiresAt && new Date(meeting.expiresAt) < new Date()) {
    return { ok: false, error: "This invitation has expired. Please contact us for a new one.", status: 410 }
  }

  const slot = new Date(slotIso)
  if (Number.isNaN(slot.getTime())) return { ok: false, error: "Invalid time slot.", status: 400 }

  const open = await computeAvailableSlots(meeting)
  if (!open.includes(slot.toISOString())) {
    return { ok: false, error: "That time is no longer available. Please pick another slot.", status: 409 }
  }

  const now = new Date().toISOString()
  const scheduled: MeetingRecord = {
    ...meeting,
    scheduledAt: slot.toISOString(),
    leadTimezone: leadTimezone || null,
    selectedAt: now,
    status: "SCHEDULED",
  }

  let meetError: string | undefined
  let meet: { meetingLink: string; eventId: string } | null = null
  try {
    // Suppress Google's own invite — our branded confirmation email (with .ics)
    // is sent below instead, so the lead doesn't get an "unknown sender" invite.
    meet = await attachGoogleMeet(scheduled, { sendUpdates: false })
  } catch (err) {
    meetError = err instanceof Error ? err.message : "Failed to create Google Meet"
    console.error("[meetings] Google Meet creation failed:", meetError)
  }

  const g = await getGoogleSettings()
  const { data, error } = await supabase
    .from("lead_meetings")
    .update({
      scheduled_at: scheduled.scheduledAt,
      lead_timezone: scheduled.leadTimezone,
      selected_at: now,
      status: "SCHEDULED",
      meeting_link: meet?.meetingLink ?? meeting.meetingLink,
      provider: meet ? "Google Meet" : meeting.provider,
      google_event_id: meet?.eventId ?? null,
      google_calendar_id: meet ? g.calendarId : null,
      updated_at: now,
    })
    .eq("id", meeting.id)
    .eq("status", "PENDING") // optimistic guard against double submit
    .select(MEETING_SELECT)
    .single()

  if (error || !data) {
    // Roll back the calendar event if the row was already claimed.
    if (meet) await deleteCalendarEvent(meet.eventId).catch(() => undefined)
    return { ok: false, error: "This invitation has already been used.", status: 409 }
  }

  const updated = mapMeeting(data as Record<string, unknown>)
  await sendMeetingConfirmationEmails(updated).catch((err) => console.error("[meetings] confirmation email failed:", err))
  return { ok: true, meeting: updated, meetError }
}

/* ─── Cancel ─── */

export async function cancelMeeting(meeting: MeetingRecord): Promise<MeetingRecord | null> {
  if (meeting.googleEventId) {
    await deleteCalendarEvent(meeting.googleEventId).catch((err) =>
      console.warn("[meetings] failed to delete Google event:", err instanceof Error ? err.message : err),
    )
  }
  const { data, error } = await supabase
    .from("lead_meetings")
    .update({ status: "CANCELLED", google_event_id: null, updated_at: new Date().toISOString() })
    .eq("id", meeting.id)
    .select(MEETING_SELECT)
    .single()
  if (error || !data) return null
  return mapMeeting(data as Record<string, unknown>)
}
