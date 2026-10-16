import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendLeadEmail, mapLeadEmail, leadTemplateBrandedHtml } from "@/lib/lead-email-outbound"
import { LEAD_EMAIL_STAGE_KEYS } from "@/lib/lead-email-templates"
import { z } from "zod"

const attachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  /** base64-encoded file content. */
  content: z.string().min(1).max(10_000_000),
})

const postSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Message body is required"),
  /** Packaged industry template to render as a branded HTML email. Only sent
   *  when the composer copy is untouched — edited copy goes out as text. */
  template: z
    .object({
      key: z.enum(LEAD_EMAIL_STAGE_KEYS),
      industry: z.string().trim().max(120).optional(),
    })
    .optional(),
  attachments: z.array(attachmentSchema).max(5, "Up to 5 attachments per email").optional(),
})

/* ─── GET email thread for a lead ─── */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ emails: [] })
  }

  const { data, error } = await supabase
    .from("lead_emails")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[Lead Emails GET]", error)
    // Surface the underlying cause (e.g. missing/mismatched table) so the
    // admin Email tab isn't left with only a generic message when the schema
    // is out of sync. Keep the stable message for the common case.
    return NextResponse.json(
      { error: "Failed to load email thread", detail: error.message },
      { status: 500 },
    )
  }

  const emails = (data || []).map((row) => mapLeadEmail(row as Record<string, unknown>))
  return NextResponse.json({ emails })
}

/* ─── POST send an email to the lead ─── */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, email, additional_email, full_name, business_name, business_type, industry")
      .eq("id", id)
      .single()

    if (leadError || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    if (!lead.email) return NextResponse.json({ error: "Lead has no email address" }, { status: 400 })

    // A packaged template renders the branded HTML edition; the composer body
    // travels as the plain-text part and lands in the thread as usual.
    const template = parsed.data.template
    let html: string | undefined
    let noSignature = false
    if (template) {
      html = leadTemplateBrandedHtml(template, lead)
      // The branded shell signs off ("Best regards, MartPoint Sales") and
      // carries the contact footer, so the mailbox signature would duplicate it.
      noSignature = true
    }

    const result = await sendLeadEmail({
      leadId: id,
      to: [...new Set([lead.email as string, lead.additional_email as string | null].filter((email): email is string => Boolean(email)))],
      subject: parsed.data.subject,
      body: parsed.data.body,
      html,
      noSignature,
      attachments: parsed.data.attachments,
      // "Send as": the customer sees the salesperson's name, but the address
      // stays the shared mailbox so the reply lands in the synced inbox.
      senderName: auth.session.name,
      metadata: template ? { template: template.key, industry: template.industry || (lead.industry as string | null) || null } : undefined,
    })

    if (!result.email) {
      return NextResponse.json({ error: result.error || "Failed to send email" }, { status: 500 })
    }

    await recordAudit(auditContextFromSession(auth.session, request), {
      action: AUDIT_ACTIONS.LEAD_UPDATED,
      entityType: AUDIT_ENTITIES.LEAD,
      entityId: id,
      metadata: {
        emailSent: result.sent,
        subject: parsed.data.subject,
        to: lead.email,
        template: parsed.data.template?.key || null,
        attachments: parsed.data.attachments?.map((a) => a.filename) || [],
      },
    })

    return NextResponse.json({ success: true, sent: result.sent, email: result.email })
  } catch {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
