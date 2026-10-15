import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { leadTemplateBrandedHtml, renderLeadEmail } from "@/lib/lead-email-outbound"
import { LEAD_EMAIL_STAGE_KEYS } from "@/lib/lead-email-templates"
import { ensureBrandedHtml, type EmailFooterOptions } from "@/lib/email-templates"
import { getEmailFooterSettings } from "@/lib/settings"

const postSchema = z.object({
  subject: z.string().max(500).optional(),
  body: z.string().min(1, "Message body is required"),
  /** Same packaging rule as the send route: an unedited template previews as
   *  the branded HTML email, edited copy previews as a simple email. */
  template: z
    .object({
      key: z.enum(LEAD_EMAIL_STAGE_KEYS),
      industry: z.string().trim().max(120).optional(),
    })
    .optional(),
})

/* Renders the exact HTML/text the lead would receive — same branded template
 * shell, mailbox signature, and footer wrap as the send route — without sending
 * or filing anything. Used by the Email tab's Preview button. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  }

  try {
    const parsed = postSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("full_name, business_name, business_type, industry")
      .eq("id", id)
      .single()

    if (leadError || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    const template = parsed.data.template
    const html = template ? leadTemplateBrandedHtml(template, lead) : undefined
    const rendered = await renderLeadEmail({ body: parsed.data.body, html, noSignature: Boolean(template) })

    // sendEmail wraps every outgoing message in the branded shell with the
    // live footer settings; a full branded template passes through untouched,
    // while a simple (edited) email gets wrapped. Mirror that here so the
    // preview matches the delivered mail exactly.
    let footer: EmailFooterOptions | undefined
    try {
      const f = await getEmailFooterSettings()
      footer = {
        social: f.social,
        contactEmail: f.contactEmail,
        phone: f.phone,
        whatsappNumber: f.whatsappNumber,
        companyName: f.companyName,
        website: f.website,
      }
    } catch {
      footer = undefined
    }
    const finalHtml = ensureBrandedHtml(rendered.html, { text: rendered.text, footer })

    return NextResponse.json({ subject: parsed.data.subject || "", text: rendered.text, html: finalHtml })
  } catch {
    return NextResponse.json({ error: "Failed to render preview" }, { status: 500 })
  }
}
