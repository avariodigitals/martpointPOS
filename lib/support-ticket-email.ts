import crypto from "crypto"
import { getUserById } from "@/lib/admin-auth"
import { resolveProfileSignature } from "@/lib/profile-signature"
import { sendEmail, REPLY_TO, getEmailSettings } from "@/lib/email"
import { appendSignatureToHtml, bodyTextToHtml, htmlToText, escapeHtml } from "@/lib/email-html"
import { sanitizeSupportHtml } from "@/lib/support-html"
import { supabase } from "@/lib/supabase"
import { getSupportRequester } from "@/lib/support-requester"

export type TicketEmail = {
  id: string
  ticket_number: string
  subject: string
  business_id?: string | null
  creator_id?: string | null
  lead_id?: string | null
  requester_partner_id?: string | null
  requester_name?: string | null
  requester_email?: string | null
  resolution_actor_id?: string | null
  assigned_admin_user_id?: string | null
  auto_close_at?: string | null
}
export type TicketEmailResult = {
  sent: boolean
  skipped: boolean
  status: "accepted" | "failed" | "no_recipient"
  email: string
  error: string | null
  html: string
  signature: string
}

export async function ticketSender(actorId?: string | null) {
  const [settings, actor] = await Promise.all([
    getEmailSettings(),
    actorId ? getUserById(actorId) : Promise.resolve(null)
  ])
  const signature = actor
    ? (await resolveProfileSignature(actor)) ||
      `<p><strong>${escapeHtml(actor.name || actor.username)}</strong><br>MartPoint Support</p>`
    : settings.signatureHtml?.trim() ||
      (settings.signature
        ? bodyTextToHtml(settings.signature)
        : "<p><strong>MartPoint Support Team</strong></p>")
  return { signature: sanitizeSupportHtml(signature), name: actor?.name || "MartPoint Support", settings }
}

export async function sendTicketRequesterEmail(input: {
  ticket: TicketEmail
  message: string
  messageHtml?: string | null
  actorId?: string | null
  subjectPrefix?: string
  surveyUrl?: string
  messageId?: string
  attachments?: { filename: string; content: string }[]
}): Promise<TicketEmailResult> {
  let email = input.ticket.requester_email?.trim() || ""
  let name = input.ticket.requester_name?.trim() || ""
  if (!email) {
    const t = input.ticket
    const owner = t.lead_id
      ? await getSupportRequester("lead", t.lead_id)
      : t.creator_id
        ? await getSupportRequester("creator", t.creator_id)
        : t.requester_partner_id
          ? await getSupportRequester("partner", t.requester_partner_id)
          : t.business_id
            ? await getSupportRequester("business", t.business_id)
            : null
    if (owner && owner.name.toLowerCase() !== "martpoint support") {
      email = owner.email
      name ||= owner.name
    }
  }
  const { signature, settings } = await ticketSender(input.actorId)
  const textBody = `Hello ${name || "there"},\n\n${input.message}\n\nTicket: ${input.ticket.ticket_number} — ${input.ticket.subject}${input.surveyUrl ? `\n\nConfirm the resolution: ${input.surveyUrl}` : ""}`
  const richBody = input.messageHtml ? sanitizeSupportHtml(input.messageHtml) : bodyTextToHtml(input.message)
  const survey = input.surveyUrl
    ? `<p><a href="${escapeHtml(input.surveyUrl)}" style="display:inline-block;background:#155eef;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Confirm resolution / I still need help</a></p>`
    : ""
  const html = appendSignatureToHtml(
    `<p>Hello ${escapeHtml(name || "there")},</p>${richBody}${survey}<p style="font-size:12px;color:#667085">${escapeHtml(input.ticket.ticket_number)} · ${escapeHtml(input.ticket.subject)}</p>`,
    `<div style="margin-top:24px">--<br>${signature}</div>`
  )
  const result: TicketEmailResult = {
    sent: false,
    skipped: !email,
    status: email ? "failed" : "no_recipient",
    email,
    error: email ? null : "Add a requester email before sending updates.",
    html,
    signature
  }
  if (!email) return result
  try {
    result.sent = await sendEmail({
      to: email,
      subject: `${input.subjectPrefix || "Support ticket update"} — ${input.ticket.ticket_number}: ${input.ticket.subject}`,
      text: `${textBody}\n\n--\n${htmlToText(signature)}`,
      html,
      from:
        settings.fromEmail || process.env.RESEND_FROM_EMAIL || "MartPoint Support <support@martpoint.com.ng>",
      replyTo: REPLY_TO.support,
      route: "support_ticket",
      useRouteRecipients: false,
      attachments: input.attachments,
      headers: {
        "Message-ID": `<support-${input.ticket.id}-${input.messageId || crypto.randomUUID()}@martpoint.com.ng>`
      }
    })
    result.status = result.sent ? "accepted" : "failed"
    result.error = result.sent
      ? null
      : "Email provider did not accept this update. Check Email Logs and retry."
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Email could not be sent"
  }
  return result
}

export async function recordTicketEmail(
  ticket: TicketEmail,
  message: string,
  result: TicketEmailResult,
  actorId?: string | null,
  kind: "update"|"resolution"|"reminder"|"closure" = "update"
) {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .insert({
      ticket_id: ticket.id,
      author_type: "SYSTEM",
      author_id: actorId || null,
      author_name: "MartPoint Support",
      message,
      message_html: result.html,
      signature_html: result.signature,
      email_kind:kind,
      visibility: "PUBLIC",
      email_status: result.status,
      email_error: result.error,
      email_recipient: result.email || null,
      email_sent_at: result.sent ? new Date().toISOString() : null
    })
    .select("id")
    .single()
  if (error) throw new Error(`Could not record the support email: ${error.message}`)
  return data
}

async function sendSurvey(ticket: TicketEmail, reminder: boolean, actorId?: string | null) {
  const token = crypto.randomBytes(32).toString("base64url")
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  const { error } = await supabase
    .from("support_ticket_feedback_tokens")
    .insert({
      token_hash: tokenHash,
      ticket_id: ticket.id,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString()
    })
  if (error) throw new Error("Could not create the ticket confirmation link")
  const base = (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.martpoint.com.ng"
  ).replace(/\/$/, "")
  const message = reminder
    ? "We’re following up on your resolved support request. Is everything working now? Please confirm below or tell us that you still need help. If we do not hear from you within the confirmation period, we will send a final closure note."
    : "We believe your issue is resolved. Please confirm whether you are satisfied, or tell us that you still need help. We will check in after three days if we have not heard from you."
  const senderId = actorId || ticket.resolution_actor_id || ticket.assigned_admin_user_id
  const result = await sendTicketRequesterEmail({
    ticket,
    message,
    actorId: senderId,
    subjectPrefix: reminder ? "Please confirm your ticket resolution" : "Is your issue resolved?",
    surveyUrl: `${base}/support/satisfaction?ticket=${ticket.id}&token=${token}`
  })
  await recordTicketEmail(ticket, message, result, senderId,reminder ? "reminder" : "resolution")
  if (result.sent) {
    const stamp = new Date().toISOString()
    const { error: saveError } = await supabase
      .from("support_tickets")
      .update(
        reminder
          ? {
              satisfaction_reminder_sent_at: stamp,
              auto_close_at: new Date(
                Math.max(Date.parse(ticket.auto_close_at || stamp), Date.now() + 2 * 86400000)
              ).toISOString()
            }
          : {
              satisfaction_token_hash: tokenHash,
              satisfaction_sent_at: stamp,
              satisfaction_reminder_sent_at: null,
              auto_close_at: new Date(Date.now() + 5 * 86400000).toISOString()
            }
      )
      .eq("id", ticket.id)
      .eq("status", "RESOLVED")
    if (saveError) throw new Error("Confirmation email sent, but follow-up scheduling could not be saved")
  }
  return result
}

export function sendResolutionSatisfactionEmail(ticket: TicketEmail, actorId?: string | null) {
  return sendSurvey(ticket, false, actorId)
}
export function sendSatisfactionReminder(ticket: TicketEmail,actorId?: string | null) {
  return sendSurvey(ticket, true,actorId)
}

export async function sendFinalClosureEmail(ticket: TicketEmail) {
  const message =
    "We have not heard back after our resolution confirmation and follow-up. We are now closing this ticket. If the issue remains unresolved, please reply with your ticket number so our team can help you again. Thank you for giving us the opportunity to support you."
  const actorId = ticket.resolution_actor_id || ticket.assigned_admin_user_id
  const result = await sendTicketRequesterEmail({
    ticket,
    message,
    actorId,
    subjectPrefix: "Final note — ticket closure"
  })
  await recordTicketEmail(ticket, message, result, actorId,"closure")
  return result
}
