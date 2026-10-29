import { resolveProfileSignature } from "@/lib/profile-signature"
import { NextResponse } from "next/server"
import { createHash, randomUUID } from "crypto"
import { z } from "zod"
import { authorizeAdmin, getUserById } from "@/lib/admin-auth"
import { authorize } from "@/lib/admin-types"
import { auditContextFromSession, recordAudit } from "@/lib/audit"
import { REPLY_TO, getEmailSettings, sendEmail, type EmailMessage } from "@/lib/email"
import { sendEmailViaSmtp } from "@/lib/email-smtp"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { checkRateLimit } from "@/lib/rate-limit"
import { htmlToText } from "@/lib/email-html"
import { sanitizeSupportHtml } from "@/lib/support-html"
import { EMAIL_LAYOUTS } from "@/lib/email-layout"
import {
  loadPartnerEmailContext,
  mapPartnerEmail,
  PARTNER_EMAIL_FIELDS,
  renderPartnerEmail
} from "@/lib/partner-email"

type Context = { params: Promise<{ partnerId: string }> }
const schema = z.object({
  layout: z.enum(EMAIL_LAYOUTS).optional(),
  recipient: z.email().transform((email) => email.toLowerCase()),
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .max(500)
    .refine((s) => !/[\r\n]/.test(s), "Subject must be one line"),
  bodyHtml: z.string().trim().min(1, "Message is required").max(50000),
  requestId: z.uuid()
})

export async function GET(request: Request, { params }: Context) {
  const { session, denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { partnerId } = await params
  if (!z.uuid().safeParse(partnerId).success)
    return NextResponse.json({ error: "Invalid partner" }, { status: 400 })
  try {
    const context = await loadPartnerEmailContext(partnerId)
    if (!context) return NextResponse.json({ error: "Partner not found" }, { status: 404 })
    const offset = Number(new URL(request.url).searchParams.get("offset") || 0)
    if (!Number.isSafeInteger(offset) || offset < 0)
      return NextResponse.json({ error: "Invalid history page" }, { status: 400 })
    const { data, error } = await supabase
      .from("partner_emails")
      .select(PARTNER_EMAIL_FIELDS)
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 50)
    if (error) throw error
    return NextResponse.json({
      emails: (data || []).slice(0, 50).map(mapPartnerEmail),
      recipients: context.recipients,
      hasMore: (data || []).length > 50,
      canSend: authorize(session, "partners", "manage")
    })
  } catch (error) {
    console.error("[partner emails GET]", error)
    return NextResponse.json(
      { error: "Could not load partner email history. Check that migration 151 has been applied." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: Context) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { partnerId } = await params
  if (!z.uuid().safeParse(partnerId).success)
    return NextResponse.json({ error: "Invalid partner" }, { status: 400 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const input = parsed.data
  if (!htmlToText(sanitizeSupportHtml(input.bodyHtml)).trim())
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([session.userId, input.recipient, input.subject, input.bodyHtml, ...(input.layout ? [input.layout] : [])]))
    .digest("hex")
  try {
    // A network retry must never send the same message twice.
    const existing = await supabase
      .from("partner_emails")
      .select(`${PARTNER_EMAIL_FIELDS}, request_hash`)
      .eq("partner_id", partnerId)
      .eq("client_request_id", input.requestId)
      .maybeSingle()
    if (existing.error) throw existing.error
    if (existing.data) {
      if (existing.data.request_hash !== fingerprint)
        return NextResponse.json(
          { error: "This send request belongs to a different message. Refresh before sending." },
          { status: 409 }
        )
      return NextResponse.json({
        email: mapPartnerEmail(existing.data),
        sent: existing.data.status === "accepted"
      })
    }
    const context = await loadPartnerEmailContext(partnerId)
    if (!context) return NextResponse.json({ error: "Partner not found" }, { status: 404 })
    if (!context.recipients.some((recipient) => recipient.email === input.recipient)) {
      return NextResponse.json(
        { error: "Choose an email address saved on this partner or their users." },
        { status: 400 }
      )
    }
    const limit = await checkRateLimit(request, {
      key: `partner-email:${session.userId}`,
      max: 20,
      windowSeconds: 60
    })
    if (!limit.allowed)
      return NextResponse.json({ error: "Please wait a minute before sending more emails." }, { status: 429 })
    const [settings, actor] = await Promise.all([getEmailSettings(), getUserById(session.userId)])
    const from = settings.provider === "smtp"
      ? settings.smtp.fromEmail || settings.smtp.user || settings.fromEmail || REPLY_TO.partners
      : settings.fromEmail || process.env.RESEND_FROM_EMAIL || REPLY_TO.partners
    const senderName = actor?.name || session.name || session.username
    const content = await renderPartnerEmail(input.bodyHtml, await resolveProfileSignature(actor), senderName, input.layout)
    const messageId = `<partner-${randomUUID()}@martpoint.com.ng>`
    // Persist first: no mail leaves if the history cannot be recorded.
    const saved = await supabase
      .from("partner_emails")
      .insert({
        partner_id: partnerId,
        direction: "outbound",
        from_email: from,
        to_email: input.recipient,
        subject: input.subject,
        body_text: content.text,
        body_html: content.html,
        status: "pending",
        provider: settings.provider,
        provider_message_id: messageId,
        client_request_id: input.requestId,
        request_hash: fingerprint,
        sent_by: session.userId,
        sent_by_name: senderName,
        metadata: { reply_to: "partners@martpoint.com.ng", layout: input.layout || "branded" }
      })
      .select(PARTNER_EMAIL_FIELDS)
      .single()
    if (saved.error || !saved.data) {
      if (saved.error?.code === "23505")
        return NextResponse.json(
          { error: "This message is already being processed. Refresh history before retrying." },
          { status: 409 }
        )
      throw saved.error || new Error("History save failed")
    }
    let sent = false
    try {
      const message: EmailMessage = {
        to: input.recipient,
        subject: input.subject,
        ...content,
        from,
        replyTo: REPLY_TO.partners,
        route: "partner_correspondence",
        useRouteRecipients: false,
        headers: { "Message-ID": messageId },
        skipBranding: true
      }
      sent = settings.provider === "smtp"
        ? await sendEmailViaSmtp(message, settings, from, [input.recipient])
        : await sendEmail({ ...message, provider: settings.provider })
    } catch (error) {
      console.error("[partner emails provider]", error)
    }
    const status = sent ? "accepted" : "failed"
    const errorMessage = sent
      ? null
      : "The email provider could not accept this message. Check Email Settings."
    const updated = await supabase
      .from("partner_emails")
      .update({ status, error_message: errorMessage })
      .eq("id", saved.data.id)
      .select(PARTNER_EMAIL_FIELDS)
      .single()
    await recordAudit(auditContextFromSession(session, request), {
      action: "PARTNER_EMAIL_SENT",
      entityType: "partner",
      entityId: partnerId,
      metadata: { emailId: saved.data.id, recipient: input.recipient, subject: input.subject, accepted: sent }
    })
    return NextResponse.json({
      sent,
      email: mapPartnerEmail(updated.data || { ...saved.data, status, error_message: errorMessage }),
      warning: updated.error
        ? "Email processed, but the history status could not be updated. Do not resend; verify Email Logs."
        : errorMessage
    })
  } catch (error) {
    console.error("[partner emails POST]", error)
    return NextResponse.json(
      { error: "Could not prepare the email. Check that migration 151 has been applied." },
      { status: 500 }
    )
  }
}
