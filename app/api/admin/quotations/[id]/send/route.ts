import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail, REPLY_TO } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import { buildQuoteEmailHtml, buildQuotePublicUrl } from "@/lib/quotations"
import { enqueueAutomation } from "@/lib/automations"
import { enqueueCommunicationTrigger } from "@/lib/communication-events"
import type { Quotation, LeadSummary } from "@/lib/quotations"
import { SUPPORT_RECOVERY_NOTICE_TEXT } from "@/lib/support-recovery-notice"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("quotations")
  if (denied) return denied

  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  // Optional body: admin can toggle change-request flags at send time.
  let allowChanges: boolean | undefined
  let allowCounterOffer: boolean | undefined
  let emailClient = false
  try {
    const body = await request.json()
    emailClient = body.emailClient === true
    if (typeof body.allowChanges === "boolean") allowChanges = body.allowChanges
    if (typeof body.allowCounterOffer === "boolean") allowCounterOffer = body.allowCounterOffer
  } catch {
    // No JSON body (e.g. called without a body) — keep existing flags.
  }

  try {
    if (!emailClient) return NextResponse.json({ error: "Check Email client before sending this quotation" }, { status: 400 })

    const { data: loadedQuote, error } = await supabase
      .from("lead_quotations")
      .select("*, lead:leads (full_name, business_name, email, phone, product_interest)")
      .eq("id", id)
      .single()

    if (error || !loadedQuote) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }
    let quote = loadedQuote

    if (session.role !== "Admin") {
      if (quote.creator_id !== session.userId || quote.approval_status !== "APPROVED") return NextResponse.json({ error: "Only the quote creator can email it after approval" }, { status: 403 })
      const approved = await supabase.from("approval_requests").select("id,requested_by,details")
        .eq("action_key", "quotation.send").eq("entity_type", "LEAD_QUOTATION").eq("entity_id", id).eq("status", "APPROVED")
        .order("decided_at", { ascending: false }).limit(1).maybeSingle()
      if (approved.error || !approved.data || approved.data.requested_by !== session.userId || approved.data.details?.quote_updated_at !== quote.updated_at) return NextResponse.json({ error: "The approved quote has changed. Submit it for approval again." }, { status: 409 })
    }

    if (session.role === "Admin" && allowChanges !== undefined) {
      const patch: Record<string, unknown> = { allow_changes: allowChanges, updated_at: new Date().toISOString() }
      patch.allow_counter_offer = allowChanges && Boolean(allowCounterOffer)
      const updated = await supabase.from("lead_quotations").update(patch).eq("id", id).select("*").single()
      if (updated.error || !updated.data) return NextResponse.json({ error: "Could not save the client change-request settings" }, { status: 500 })
      quote = { ...quote, ...updated.data }
    }

    const leadRawMaybe = quote.lead as unknown as { full_name: string; business_name: string; email: string; phone: string; product_interest: string } | { full_name: string; business_name: string; email: string; phone: string; product_interest: string }[] | undefined
    const leadRaw = Array.isArray(leadRawMaybe) ? leadRawMaybe[0] : leadRawMaybe
    const lead = leadRaw ? {
      full_name: leadRaw.full_name,
      business_name: leadRaw.business_name,
      email: leadRaw.email,
      phone: leadRaw.phone,
      product_interest: leadRaw.product_interest,
    } : undefined
    if (!lead?.email) {
      return NextResponse.json({ error: "Lead has no email address" }, { status: 400 })
    }

    const publicUrl = buildQuotePublicUrl(quote.public_token as string)
    const quoteSubjectTpl = await renderEmailTemplate("quotation_subject", {
      quoteNumber: quote.quote_number as string,
      titleBlock: (quote.title as string) ? ` — ${quote.title as string}` : "",
    })

    const emailSent = await sendEmail({
      to: lead.email,
      subject: quoteSubjectTpl.subject,
      replyTo: REPLY_TO.sales,
      text: buildPlainText(quote as unknown as Quotation, lead as unknown as LeadSummary, publicUrl),
      html: buildQuoteEmailHtml(
        {
          quote_number: quote.quote_number as string,
          title: (quote.title as string) || "",
          total_amount: Number(quote.total_amount) || 0,
          valid_until: (quote.valid_until as string | null) || null,
          notes_public: (quote.notes_public as string | null) || null,
        },
        {
          id: quote.lead_id as string,
          fullName: lead.full_name,
          businessName: lead.business_name,
          email: lead.email,
          phone: lead.phone,
          productInterest: lead.product_interest,
        },
        publicUrl
      ),
    })

    if (emailSent) {
      const sentAt = new Date().toISOString()
      const { error: updateError } = await supabase.from("lead_quotations").update({ status: "SENT", sent_at: sentAt }).eq("id", id)
      if (updateError) console.error("[admin/quotations/send] update error", updateError)
    }

    // Schedule the 48h follow-up sequence for this quotation (best-effort).
    if (emailSent) await enqueueAutomation({
      automationKey: "quote_48h_reminder",
      subjectType: "quotation",
      subjectId: id,
      recipientEmail: lead.email,
    }).catch((err) => console.error("[quotations/send] enqueue reminder failed:", err))
    if (emailSent) await enqueueCommunicationTrigger("quote_sent", String(quote.lead_id)).catch((err) => console.error("[quotations/send] communication workflow enqueue failed:", err))

    return NextResponse.json({
      success: emailSent,
      publicUrl,
      message: emailSent ? "Quotation sent" : "Email delivery failed (see email logs)",
    })
  } catch (e) {
    console.error("[admin/quotations/send] POST", e)
    return NextResponse.json({ error: "Failed to send quotation" }, { status: 500 })
  }
}

function buildPlainText(quote: Quotation, lead: LeadSummary, publicUrl: string): string {
  const validUntil = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })
    : "Not specified"

  return `Hello ${lead.fullName},\n\nPlease find your MartPoint quotation below.\n\nQuote: ${quote.quote_number}${quote.title ? `\nTitle: ${quote.title}` : ""}\nBusiness: ${lead.businessName}\nTotal: ₦${quote.total_amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}\nValid until: ${validUntil}\n\n${quote.notes_public || ""}\n\n${SUPPORT_RECOVERY_NOTICE_TEXT}\n\nView your quotation here:\n${publicUrl}\n\nIf you have any questions, reply to this email.`
}
