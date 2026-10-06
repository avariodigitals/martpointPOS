import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail, REPLY_TO } from "@/lib/email"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(10).max(240),
  meetingLink: z.string().trim().max(1000).optional().default("").refine((value) => !value || /^https?:\/\//i.test(value), "Meeting link must use http or https"),
  message: z.string().trim().max(3000).optional().default(""),
})

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!)
}

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")
}

function toIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
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
  const formatted = new Intl.DateTimeFormat("en-NG", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos" }).format(start)
  const details = [
    `Meeting invitation: ${input.title}`,
    `Application: ${application.reference_number}`,
    `When: ${formatted} WAT`,
    `Duration: ${input.durationMinutes} minutes`,
    input.meetingLink ? `Join: ${input.meetingLink}` : "",
    input.message,
  ].filter(Boolean).join("\n")
  const event = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MartPoint//Partner Application//EN", "CALSCALE:GREGORIAN", "METHOD:REQUEST",
    "BEGIN:VEVENT", `UID:${crypto.randomUUID()}@martpoint.com.ng`, `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`, `DTEND:${toIcsDate(end)}`, `SUMMARY:${icsEscape(input.title)}`,
    `ORGANIZER;CN=MartPoint Partners:mailto:${REPLY_TO.partners.match(/<([^>]+)>/)?.[1] || "partners@martpoint.com.ng"}`,
    `ATTENDEE;CN=${icsEscape(application.full_name || application.email)};RSVP=TRUE:mailto:${application.email}`,
    input.meetingLink ? `LOCATION:${icsEscape(input.meetingLink)}` : null,
    `DESCRIPTION:${icsEscape(details)}`, "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n") + "\r\n"

  const sent = await sendEmail({
    to: application.email,
    subject: `Meeting invitation: ${input.title}`,
    text: `Hello ${application.full_name || "there"},\n\n${details}\n\nRegards,\nMartPoint Partners`,
    html: `<p>Hello ${escapeHtml(application.full_name || "there")},</p><p>You are invited to a meeting about your MartPoint partner application.</p><p><strong>${escapeHtml(input.title)}</strong><br>${escapeHtml(formatted)} WAT · ${input.durationMinutes} minutes</p>${input.meetingLink ? `<p><a href="${escapeHtml(input.meetingLink)}">Join meeting</a></p>` : ""}${input.message ? `<p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>` : ""}<p>Application reference: ${escapeHtml(application.reference_number)}</p><p>Regards,<br>MartPoint Partners</p>`,
    replyTo: REPLY_TO.partners,
    route: "partners",
    attachments: [{ filename: "meeting-invitation.ics", content: Buffer.from(event).toString("base64") }],
  })

  const historyText = `${input.title}\nScheduled: ${formatted} WAT · ${input.durationMinutes} minutes${input.meetingLink ? `\nJoin: ${input.meetingLink}` : ""}${input.message ? `\nMessage: ${input.message}` : ""}\nInvitation email ${sent ? "sent" : "could not be sent"} to ${application.email}.`
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
    metadata: { reference: application.reference_number, eventType: sent ? "MEETING_INVITED" : "MEETING_EMAIL_FAILED" },
  })
  return NextResponse.json({ success: true, emailSent: sent })
}
