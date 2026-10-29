import { NextResponse } from "next/server"
import { authorizeAdmin, getUserById } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendLeadEmail, mapLeadEmail, leadTemplateBrandedHtml, resolveLeadSenders } from "@/lib/lead-email-outbound"
import { getEmailSettings } from "@/lib/email"
import { LEAD_EMAIL_STAGE_KEYS } from "@/lib/lead-email-templates"
import { z } from "zod"
import { leadEmailAttachmentsSchema } from "@/lib/lead-email-attachments"

const postSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(500),
  body: z.string().trim().min(1, "Message body is required").max(50000),
  /** Packaged industry template to render as a branded HTML email. Only sent
   *  when the composer copy is untouched — edited copy goes out as text. */
  template: z
    .object({
      key: z.enum(LEAD_EMAIL_STAGE_KEYS),
      industry: z.string().trim().max(120).optional(),
    })
    .optional(),
  attachments: leadEmailAttachmentsSchema.optional(),
  replyToEmailId: z.string().uuid().optional(),
  replyAll: z.boolean().optional(),
})

function extractAddresses(value: unknown): string[] {
  if (typeof value !== "string") return []
  return [...new Set((value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((address) => address.toLowerCase()))]
}

function metadataValue(metadata: unknown, key: string): unknown {
  return metadata && typeof metadata === "object" && key in metadata ? (metadata as Record<string, unknown>)[key] : null
}

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

    let recipients = [lead.email as string, lead.additional_email as string | null].filter(
      (email): email is string => Boolean(email),
    )
    let cc: string[] = []
    let headers: Record<string, string> | undefined
    let subject = parsed.data.subject
    let replyMetadata: Record<string, unknown> | undefined

    if (parsed.data.replyToEmailId) {
      const { data: original, error: originalError } = await supabase
        .from("lead_emails")
        .select("*")
        .eq("id", parsed.data.replyToEmailId)
        .eq("lead_id", id)
        .maybeSingle()

      if (originalError || !original) return NextResponse.json({ error: "Original email not found" }, { status: 404 })

      const settings = await getEmailSettings()
      const sender = resolveLeadSenders(settings, auth.session.name)
      const ownAddresses = new Set([
        ...extractAddresses(sender.from),
        ...extractAddresses(sender.replyTo),
        ...extractAddresses(settings.fromEmail),
        ...extractAddresses(settings.smtp.fromEmail),
        ...extractAddresses(settings.smtp.user),
      ])
      const originalTo = extractAddresses(original.to_email)
      const originalFrom = extractAddresses(original.from_email)
      const originalCc = extractAddresses(metadataValue(original.metadata, "cc"))

      recipients = original.direction === "inbound" ? originalFrom : originalTo
      if (parsed.data.replyAll) {
        cc = [
          ...originalTo,
          ...originalCc,
          ...(lead.email ? [lead.email as string] : []),
          ...(lead.additional_email ? [lead.additional_email as string] : []),
        ]
          .flatMap((value) => extractAddresses(value))
          .filter((address) => !ownAddresses.has(address) && !recipients.some((to) => to.toLowerCase() === address))
      }

      if (recipients.length === 0) {
        recipients = [lead.email as string, lead.additional_email as string | null].filter(
          (email): email is string => Boolean(email),
        )
      }

      const originalSubject = String(original.subject || "").trim()
      subject = originalSubject && /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject || parsed.data.subject}`

      const parentMessageId = String(original.provider_message_id || "").trim()
      if (parentMessageId && /^<[^>]+>$/.test(parentMessageId)) {
        headers = { "In-Reply-To": parentMessageId }
        const previousReferences = String(metadataValue(original.metadata, "references") || "").trim()
        headers.References = [previousReferences, parentMessageId].filter(Boolean).join(" ")
      }
      replyMetadata = {
        reply_to_email_id: parsed.data.replyToEmailId,
        reply_all: Boolean(parsed.data.replyAll),
        references: headers?.References || parentMessageId || null,
      }
    }

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
      to: [...new Set(recipients)],
      cc: [...new Set(cc)],
      subject,
      body: parsed.data.body,
      html,
      noSignature,
      attachments: parsed.data.attachments,
      // "Send as": the customer sees the salesperson's name, but the address
      // stays the shared mailbox so the reply lands in the synced inbox.
      senderName: auth.session.name,
      signatureHtml: (await getUserById(auth.session.userId))?.signatureHtml || "<p><strong>MartPoint Sales Team</strong></p>",
      metadata: {
        ...(template ? { template: template.key, industry: template.industry || (lead.industry as string | null) || null } : {}),
        ...(replyMetadata || {}),
      },
      headers,
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
        subject,
        to: recipients.join(", "),
        cc: cc.join(", ") || null,
        replyToEmailId: parsed.data.replyToEmailId || null,
        template: parsed.data.template?.key || null,
        attachments: parsed.data.attachments?.map((a) => a.filename) || [],
      },
    })

    return NextResponse.json({ success: true, sent: result.sent, email: result.email })
  } catch {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
