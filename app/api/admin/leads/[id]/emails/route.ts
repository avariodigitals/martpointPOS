import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendLeadEmail, mapLeadEmail } from "@/lib/lead-email-outbound"
import { z } from "zod"

const postSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Message body is required"),
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

    const result = await sendLeadEmail({
      leadId: id,
      to: lead.email as string,
      subject: parsed.data.subject,
      body: parsed.data.body,
    })

    if (!result.email) {
      return NextResponse.json({ error: result.error || "Failed to send email" }, { status: 500 })
    }

    await recordAudit(auditContextFromSession(auth.session, request), {
      action: AUDIT_ACTIONS.LEAD_UPDATED,
      entityType: AUDIT_ENTITIES.LEAD,
      entityId: id,
      metadata: { emailSent: result.sent, subject: parsed.data.subject, to: lead.email },
    })

    return NextResponse.json({ success: true, sent: result.sent, email: result.email })
  } catch {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
