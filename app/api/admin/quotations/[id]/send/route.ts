import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import { buildQuoteEmailHtml, buildQuotePublicUrl } from "@/lib/quotations"
import type { Quotation, LeadSummary } from "@/lib/quotations"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await authorizeAdmin("quotations")
  if (denied) return denied

  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const { data: quote, error } = await supabase
      .from("lead_quotations")
      .select("*, lead:leads (full_name, business_name, email, phone, product_interest)")
      .eq("id", id)
      .single()

    if (error || !quote) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
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

    const { error: updateError } = await supabase
      .from("lead_quotations")
      .update({ status: "SENT", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)

    if (updateError) {
      console.error("[admin/quotations/send] update error", updateError)
    }

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

  return `Hello ${lead.fullName},\n\nPlease find your MartPoint quotation below.\n\nQuote: ${quote.quote_number}${quote.title ? `\nTitle: ${quote.title}` : ""}\nBusiness: ${lead.businessName}\nTotal: ₦${quote.total_amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}\nValid until: ${validUntil}\n\n${quote.notes_public || ""}\n\nView your quotation here:\n${publicUrl}\n\nIf you have any questions, reply to this email.`
}
