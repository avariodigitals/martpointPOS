import { resolveProfileSignature } from "@/lib/profile-signature"
import { NextResponse } from "next/server"
import crypto from "crypto"
import { z } from "zod"
import { authorizeAdmin, getUserById } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { REPLY_TO, getEmailSettings, sendEmail } from "@/lib/email"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { renderCreatorEmail } from "@/lib/creator-email"
import { emailComposerFields } from "@/lib/email-correspondence"

const schema = z.object({
  ...emailComposerFields,
  subject: z.string().trim().min(1, "Subject is required").max(500),
  body: z.string().trim().min(1, "Message is required").max(20000),
})

async function getApplication(id: string) {
  return supabase.from("creator_applications")
    .select("id, full_name, email, reference_number")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
}

function mapEmail(row: Record<string, unknown>) {
  return {
    id: String(row.id), direction: String(row.direction), fromEmail: row.from_email || null,
    toEmail: row.to_email || null, subject: String(row.subject || ""),
    bodyText: row.body_text || "", status: String(row.status || "sent"),
    sentByName: row.sent_by_name || null, createdAt: row.created_at,
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  const { id } = await params
  const { data: application, error: applicationError } = await getApplication(id)
  if (applicationError || !application) return NextResponse.json({ error: "Creator application not found" }, { status: 404 })

  const { data, error } = await supabase.from("creator_application_emails")
    .select("id, direction, from_email, to_email, subject, body_text, status, sent_by_name, created_at")
    .eq("application_id", id).order("created_at", { ascending: true })
  if (error) {
    console.error("[creator emails GET]", error.message)
    return NextResponse.json({ error: "Could not load creator email history. Apply the creator email migration and retry." }, { status: 500 })
  }
  return NextResponse.json({ emails: (data || []).map((row) => mapEmail(row as Record<string, unknown>)), recipient: application.email })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("creator.application.review")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  const { id } = await params

  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const { data: application, error: applicationError } = await getApplication(id)
    if (applicationError || !application) return NextResponse.json({ error: "Creator application not found" }, { status: 404 })
    if (!application.email) return NextResponse.json({ error: "This application has no email address" }, { status: 400 })

    const [settings, actor] = await Promise.all([getEmailSettings(), getUserById(session.userId)])
    const from = settings.fromEmail || process.env.RESEND_FROM_EMAIL || "MartPoint Creators <creators@martpoint.com.ng>"
    const signatureHtml = (await resolveProfileSignature(actor)) || "<p><strong>MartPoint Creator Team</strong></p>"
    const { text, html } = await renderCreatorEmail(parsed.data.body, signatureHtml, parsed.data.layout, parsed.data.bodyHtml)
    const messageId = `<creator-${crypto.randomUUID()}@martpoint.com.ng>`
    const sent = await sendEmail({
      to: String(application.email), subject: parsed.data.subject, text, html, from,
      replyTo: REPLY_TO.creators, route: "creator_application", useRouteRecipients: false,
      headers: { "Message-ID": messageId },
      skipBranding: true,
    })

    const { data: row, error: insertError } = await supabase.from("creator_application_emails").insert({
      application_id: id, direction: "outbound", from_email: from, to_email: application.email,
      subject: parsed.data.subject, body_text: text, body_html: html,
      status: sent ? "sent" : "failed", provider: settings.provider,
      provider_message_id: messageId, sent_by: session.userId,
      sent_by_name: session.name || session.username,
      metadata: { reply_to: "creators@martpoint.com.ng", layout: parsed.data.layout || "branded" },
    }).select("id, direction, from_email, to_email, subject, body_text, status, sent_by_name, created_at").single()

    if (insertError || !row) {
      console.error("[creator emails POST] save failed:", insertError?.message)
      return NextResponse.json({ error: sent ? "Email sent, but its history could not be saved." : "Email was not sent and its history could not be saved." }, { status: 500 })
    }

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_APPLICATION_EMAIL_SENT,
      entityType: AUDIT_ENTITIES.CREATOR_APPLICATION,
      entityId: id,
      metadata: { emailSent: sent, subject: parsed.data.subject, recipient: application.email },
    })
    return NextResponse.json({ success: true, sent, email: mapEmail(row as Record<string, unknown>), warning: sent ? null : "Email saved in history but delivery failed. Check Email Settings." })
  } catch (error) {
    console.error("[creator emails POST]", error)
    return NextResponse.json({ error: "Could not send creator email" }, { status: 500 })
  }
}
