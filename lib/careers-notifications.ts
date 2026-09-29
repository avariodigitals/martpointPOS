/* ───────────────────────────  Careers notifications  ───────────────────────────
 * Sends careers email through the existing email service (lib/email.ts +
 * lib/email-templates.ts) and records every attempt in career_notification_log
 * with its delivery status. The channel abstraction (`channel` column) leaves
 * room for a WhatsApp provider later — no WhatsApp sending is implemented.
 */

import { sendEmail, type EmailAttachment } from "./email"
import { renderEmailTemplate } from "./email-templates"
import { supabase, isSupabaseConfigured } from "./supabase"

export type CareerNotificationTemplate =
  | "career_application_received"
  | "career_application_admin"
  | "career_shortlisted"
  | "career_under_review"
  | "career_assessment_invite"
  | "career_interview_invite"
  | "career_selected"
  | "career_offer_letter"
  | "career_reserve"
  | "career_rejection"
  | "career_deployment_invite"
  | "career_deployment_reminder"
  | "career_talent_pool_welcome"

export interface CareerNotifyInput {
  template: CareerNotificationTemplate
  to: string
  vars: Record<string, string | number | null | undefined>
  applicationId?: string | null
  candidateId?: string | null
  /** Route key for internal notifications (goes to configured route recipients). */
  route?: string
  /** File attachments (e.g. an .ics calendar invite for interviews). */
  attachments?: EmailAttachment[]
}

async function logNotification(input: {
  template: string
  recipient: string
  subject: string
  status: "QUEUED" | "SENT" | "FAILED" | "SKIPPED"
  applicationId?: string | null
  candidateId?: string | null
  errorMessage?: string | null
}): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase.from("career_notification_log").insert({
      application_id: input.applicationId ?? null,
      candidate_id: input.candidateId ?? null,
      template_key: input.template,
      channel: "EMAIL",
      recipient: input.recipient,
      subject: input.subject,
      status: input.status,
      error_message: input.errorMessage ?? null,
      sent_at: input.status === "SENT" ? new Date().toISOString() : null,
    })
  } catch (err) {
    console.error("[careers-notify] log failed:", err)
  }
}

/** Send a careers notification email and persist its delivery status. */
export async function sendCareerNotification(input: CareerNotifyInput): Promise<boolean> {
  let tpl
  try {
    tpl = await renderEmailTemplate(input.template, input.vars)
  } catch (err) {
    console.error("[careers-notify] template error:", err)
    await logNotification({
      template: input.template,
      recipient: input.to,
      subject: "",
      status: "FAILED",
      applicationId: input.applicationId,
      candidateId: input.candidateId,
      errorMessage: "template render failed",
    })
    return false
  }

  if (!input.to || !input.to.includes("@")) {
    await logNotification({
      template: input.template,
      recipient: input.to || "",
      subject: tpl.subject,
      status: "SKIPPED",
      applicationId: input.applicationId,
      candidateId: input.candidateId,
      errorMessage: "no recipient",
    })
    return false
  }

  const sent = await sendEmail({
    to: input.to,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
    route: input.route,
    attachments: input.attachments,
  })

  await logNotification({
    template: input.template,
    recipient: input.to,
    subject: tpl.subject,
    status: sent ? "SENT" : "FAILED",
    applicationId: input.applicationId,
    candidateId: input.candidateId,
    errorMessage: sent ? null : "provider rejected send",
  })
  return sent
}

/** Map an application status transition to the applicant-facing template. */
export function templateForStatusChange(status: string): CareerNotificationTemplate | null {
  switch (status) {
    case "SHORTLISTED":
      return "career_shortlisted"
    case "UNDER_REVIEW":
      return "career_under_review"
    case "ASSESSMENT_INVITED":
      return "career_assessment_invite"
    case "SELECTED":
      return "career_selected"
    case "RESERVE":
      return "career_reserve"
    case "REJECTED":
      return "career_rejection"
    default:
      return null
  }
}

/* ─── Interview calendar invite (.ics attachment) ───
 * Mirrors the lead-meeting ICS format so candidates get an
 * "Add to Calendar" card in their mail client. */

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

export function buildInterviewIcs(input: {
  id: string
  summary: string
  start: Date
  durationMinutes: number
  attendeeEmail?: string
  attendeeName?: string
  meetingLink?: string | null
  location?: string | null
}): EmailAttachment {
  const end = new Date(input.start.getTime() + input.durationMinutes * 60_000)
  const description = [
    input.meetingLink ? `Join: ${input.meetingLink}` : "",
    input.location ? `Location: ${input.location}` : "",
  ].filter(Boolean).join("\n")

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MartPoint//Careers//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${input.id}@careers.martpoint.com.ng`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(input.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(input.summary)}`,
    "ORGANIZER;CN=MartPoint Careers:mailto:hello@martpoint.com.ng",
    input.attendeeEmail
      ? `ATTENDEE;CN=${icsEscape(input.attendeeName || input.attendeeEmail)};RSVP=TRUE:mailto:${input.attendeeEmail}`
      : null,
    input.meetingLink || input.location
      ? `LOCATION:${icsEscape(input.meetingLink || input.location || "")}`
      : null,
    `DESCRIPTION:${icsEscape(description)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter((l): l is string => Boolean(l))
    .join("\r\n")

  return { filename: "interview.ics", content: Buffer.from(`${lines}\r\n`).toString("base64") }
}

/** Template variables for an interview invitation (with join button block). */
export function buildInterviewVars(input: {
  fullName: string
  reference: string
  vacancyTitle: string
  assessmentName: string
  scheduledAt: Date
  durationMinutes: number
  meetingLink?: string | null
  meetingLocation?: string | null
  instructions?: string | null
  statusUrl: string
}): Record<string, string | number> {
  const when = input.scheduledAt.toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
  const joinBlock = input.meetingLink
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;"><tr><td style="border-radius:8px; background-color:#0057FF; text-align:center;"><a href="${input.meetingLink}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Join Video Interview</a></td></tr></table>`
    : ""
  const joinLine = input.meetingLink ? `Join link: ${input.meetingLink}\n` : ""
  const locationLine = input.meetingLocation ? `Location: ${input.meetingLocation}\n` : ""
  const locationBlock = input.meetingLocation
    ? `<p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Location</p>
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0;">${input.meetingLocation}</p>`
    : ""

  return {
    fullName: input.fullName,
    reference: input.reference,
    vacancyTitle: input.vacancyTitle,
    assessmentName: input.assessmentName,
    interviewWhen: when,
    durationMinutes: input.durationMinutes,
    joinLine,
    joinBlock,
    locationLine,
    locationBlock,
    notes: input.instructions || "",
    statusUrl: input.statusUrl,
  }
}
