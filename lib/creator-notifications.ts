/* ───────────────────────────  Creator notifications  ───────────────────────────
 * Email goes through the shared email service (lib/email.ts +
 * lib/email-templates.ts) and every attempt is logged to
 * creator_notification_log. In-portal messages go to creator_notifications.
 * Mirrors lib/careers-notifications.ts. The `channel` column leaves room for
 * WhatsApp later — no WhatsApp sending is implemented.
 */

import { sendEmail, type EmailAttachment } from "./email"
import { renderEmailTemplate } from "./email-templates"
import { supabase, isSupabaseConfigured } from "./supabase"

export type CreatorNotificationTemplate =
  | "creator_application_received"
  | "creator_application_admin"
  | "creator_interview_invite"
  | "creator_approved"
  | "creator_waitlisted"
  | "creator_rejected"
  | "creator_set_password"
  | "creator_password_reset"
  | "creator_onboarding_reminder"
  | "creator_challenge_announced"
  | "creator_submission_received"
  | "creator_submission_decision"
  | "creator_deadline_reminder"
  | "creator_winner"
  | "creator_reward_approved"
  | "creator_reward_paid"

export interface CreatorNotifyInput {
  template: CreatorNotificationTemplate
  to: string
  vars: Record<string, string | number | null | undefined>
  creatorId?: string | null
  applicationId?: string | null
  /** Route key for internal notifications (configured route recipients). */
  route?: string
  attachments?: EmailAttachment[]
}

async function logNotification(input: {
  template: string
  recipient: string
  subject: string
  status: "QUEUED" | "SENT" | "FAILED" | "SKIPPED"
  creatorId?: string | null
  applicationId?: string | null
  errorMessage?: string | null
}): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase.from("creator_notification_log").insert({
      creator_id: input.creatorId ?? null,
      application_id: input.applicationId ?? null,
      template_key: input.template,
      channel: "EMAIL",
      recipient: input.recipient,
      subject: input.subject,
      status: input.status,
      error_message: input.errorMessage ?? null,
      sent_at: input.status === "SENT" ? new Date().toISOString() : null,
    })
  } catch (err) {
    console.error("[creator-notify] log failed:", err)
  }
}

/** Send a creator notification email and persist its delivery status. */
export async function sendCreatorNotification(input: CreatorNotifyInput): Promise<boolean> {
  let tpl
  try {
    tpl = await renderEmailTemplate(input.template, input.vars)
  } catch (err) {
    console.error("[creator-notify] template error:", err)
    await logNotification({
      template: input.template,
      recipient: input.to,
      subject: "",
      status: "FAILED",
      creatorId: input.creatorId,
      applicationId: input.applicationId,
      errorMessage: "template render failed",
    })
    return false
  }

  // A `route` supplies recipients server-side, so internal notifications may
  // legitimately have an empty `to`.
  if ((!input.to || !input.to.includes("@")) && !input.route) {
    await logNotification({
      template: input.template,
      recipient: input.to || "",
      subject: tpl.subject,
      status: "SKIPPED",
      creatorId: input.creatorId,
      applicationId: input.applicationId,
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
    creatorId: input.creatorId,
    applicationId: input.applicationId,
    errorMessage: sent ? null : "provider rejected send",
  })
  return sent
}

/* ─── In-portal notifications ─── */

export interface CreatorInAppNotification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

/** Insert an in-portal notification for a creator (best-effort). */
export async function pushCreatorNotification(input: {
  creatorId: string
  type: string
  title: string
  body?: string | null
  link?: string | null
}): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase.from("creator_notifications").insert({
      creator_id: input.creatorId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    })
  } catch (err) {
    console.error("[creator-notify] in-app insert failed:", err)
  }
}

export async function listCreatorNotifications(
  creatorId: string,
  limit = 30
): Promise<CreatorInAppNotification[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("creator_notifications")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data || []).map((r) => ({
    id: r.id as string,
    type: r.type as string,
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    link: (r.link as string | null) ?? null,
    readAt: (r.read_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }))
}

export async function markCreatorNotificationsRead(creatorId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase
      .from("creator_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("creator_id", creatorId)
      .is("read_at", null)
  } catch (err) {
    console.error("[creator-notify] mark read failed:", err)
  }
}

/* ─── Interview calendar invite (.ics attachment) ───
 * Same pattern as lib/careers-notifications.ts. */

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

export function buildCreatorInterviewIcs(input: {
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
    "PRODID:-//MartPoint//CreatorNetwork//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${input.id}@creators.martpoint.com.ng`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(input.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(input.summary)}`,
    "ORGANIZER;CN=MartPoint Creator Network:mailto:hello@martpoint.com.ng",
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
