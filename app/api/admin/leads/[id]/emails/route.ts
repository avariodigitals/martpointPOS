import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail, getEmailSettings } from "@/lib/email"
import { z } from "zod"

const postSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Message body is required"),
})

interface LeadEmail {
  id: string
  leadId: string
  direction: "inbound" | "outbound"
  fromEmail: string | null
  toEmail: string | null
  subject: string | null
  bodyText: string | null
  bodyHtml: string | null
  status: string
  provider: string | null
  createdAt: string
}

function mapLeadEmail(row: Record<string, unknown>): LeadEmail {
  return {
    id: row.id as string,
    leadId: row.lead_id as string,
    direction: row.direction as LeadEmail["direction"],
    fromEmail: (row.from_email as string) ?? null,
    toEmail: (row.to_email as string) ?? null,
    subject: (row.subject as string) ?? null,
    bodyText: (row.body_text as string) ?? null,
    bodyHtml: (row.body_html as string) ?? null,
    status: (row.status as string) ?? "sent",
    provider: (row.provider as string) ?? null,
    createdAt: row.created_at as string,
  }
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
    return NextResponse.json({ error: "Failed to load email thread" }, { status: 500 })
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
      .select("id, email, full_name")
      .eq("id", id)
      .single()

    if (leadError || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    if (!lead.email) return NextResponse.json({ error: "Lead has no email address" }, { status: 400 })

    const settings = await getEmailSettings()
    const from = settings.fromEmail || process.env.RESEND_FROM_EMAIL || "MartPoint <hello@martpoint.com.ng>"

    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827;white-space:pre-wrap;">${escapeHtml(parsed.data.body)}</div>`

    const sent = await sendEmail({
      to: lead.email as string,
      subject: parsed.data.subject,
      text: parsed.data.body,
      html,
    })

    const { data: row, error } = await supabase
      .from("lead_emails")
      .insert({
        lead_id: id,
        direction: "outbound",
        from_email: from,
        to_email: lead.email,
        subject: parsed.data.subject,
        body_text: parsed.data.body,
        body_html: html,
        status: sent ? "sent" : "failed",
        provider: settings.provider,
      })
      .select()
      .single()

    if (error) {
      console.error("[Lead Emails POST]", error)
      return NextResponse.json({ error: sent ? "Email sent but failed to save to thread" : "Failed to send email" }, { status: 500 })
    }

    await recordAudit(auditContextFromSession(auth.session, request), {
      action: AUDIT_ACTIONS.LEAD_UPDATED,
      entityType: AUDIT_ENTITIES.LEAD,
      entityId: id,
      metadata: { emailSent: sent, subject: parsed.data.subject, to: lead.email },
    })

    return NextResponse.json({ success: true, sent, email: mapLeadEmail(row) })
  } catch {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}
