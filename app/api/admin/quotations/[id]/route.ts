import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recalculateQuote, buildQuotePublicUrl, buildQuoteEmailHtml } from "@/lib/quotations"
import { sendEmail, REPLY_TO } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import type { Quotation, LeadSummary } from "@/lib/quotations"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await authorizeAdmin("quotations")
  if (denied) return denied

  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const { data, error } = await supabase
      .from("lead_quotations")
      .select("*, lead:leads (full_name, business_name, email, phone, product_interest), items:lead_quotation_items(*)")
      .eq("id", id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }

    return NextResponse.json({ quotation: data })
  } catch (e) {
    console.error("[admin/quotations/[id]] GET", e)
    return NextResponse.json({ error: "Failed to load quotation" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await authorizeAdmin("quotations")
  if (denied) return denied

  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const { error } = await supabase.from("lead_quotations").delete().eq("id", id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[admin/quotations/[id]] DELETE", e)
    return NextResponse.json({ error: "Failed to delete quotation" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await authorizeAdmin("quotations")
  if (denied) return denied

  const { id } = await params
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const {
      title,
      validUntil,
      notesPublic,
      notesInternal,
      paymentTerms,
      status,
      items,
      discountType,
      discountValue,
      sendEmail: shouldSend,
      allowChanges,
      allowCounterOffer,
    } = body as {
      title?: string
      validUntil?: string
      notesPublic?: string
      notesInternal?: string
      paymentTerms?: string
      status?: string
      items: Array<{ description: string; quantity: number; unitPrice: number; discount?: number; tax?: number; taxRate?: number | null }>
      discountType?: string
      discountValue?: number
      sendEmail?: boolean
      allowChanges?: boolean
      allowCounterOffer?: boolean
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabase.from("lead_quotations").select("id, quote_number").eq("id", id).single()
    if (existingError || !existing) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }

    const quoteDiscountType = discountType === "percent" || discountType === "fixed" ? discountType : "none"
    const quoteDiscountValue = Math.max(0, Number(discountValue) || 0)

    const totals = recalculateQuote(items.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      discount: Number(it.discount) || 0,
      // null = fixed `tax` amount; a number (incl. 0) = percentage rate
      taxRate: it.taxRate == null ? null : Number(it.taxRate) || 0,
      tax: Number(it.tax) || 0,
    })), { type: quoteDiscountType, value: quoteDiscountValue })

    const allowedStatuses = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED", "CONVERTED", "CHANGE_REQUESTED", "COUNTER_OFFERED", "REVISED"]
    const updatePayload: Record<string, unknown> = {
      title: title || "",
      valid_until: validUntil || null,
      notes_public: notesPublic || null,
      notes_internal: notesInternal || null,
      payment_terms: paymentTerms || null,
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      discount_type: quoteDiscountType,
      discount_value: quoteDiscountType === "none" ? 0 : quoteDiscountValue,
      tax_amount: totals.taxAmount,
      total_amount: totals.total,
      updated_at: new Date().toISOString(),
    }
    if (status && allowedStatuses.includes(status as string)) {
      updatePayload.status = status
    }
    if (typeof allowChanges === "boolean") {
      updatePayload.allow_changes = allowChanges
      updatePayload.allow_counter_offer = allowChanges && Boolean(allowCounterOffer)
    }

    const { error: updateError } = await supabase.from("lead_quotations").update(updatePayload).eq("id", id)
    if (updateError) {
      console.error("[admin/quotations/[id]] PUT update", updateError)
      return NextResponse.json({ error: "Failed to update quotation" }, { status: 500 })
    }

    await supabase.from("lead_quotation_items").delete().eq("quotation_id", id)

    const itemRows = totals.items.map((it) => ({
      quotation_id: id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      discount: it.discount,
      tax_rate: it.taxRate ?? null,
      tax: it.tax,
      line_total: it.lineTotal,
    }))

    const { error: itemsError } = await supabase.from("lead_quotation_items").insert(itemRows)
    if (itemsError) {
      console.error("[admin/quotations/[id]] PUT items", itemsError)
      return NextResponse.json({ error: "Failed to update quote items" }, { status: 500 })
    }

    const { data: fullQuote, error: fullError } = await supabase
      .from("lead_quotations")
      .select("*, lead:leads (full_name, business_name, email, phone, product_interest), items:lead_quotation_items(*)")
      .eq("id", id)
      .single()

    if (fullError || !fullQuote) {
      return NextResponse.json({ error: "Quotation updated but could not be reloaded" }, { status: 500 })
    }

    const leadRaw = Array.isArray(fullQuote.lead) ? fullQuote.lead[0] : (fullQuote.lead as Record<string, unknown> | undefined)
    const itemsRaw = Array.isArray(fullQuote.items) ? (fullQuote.items as unknown as Record<string, unknown>[]) : []

    const quotation = {
      ...fullQuote,
      subtotal: Number(fullQuote.subtotal) || 0,
      discount_amount: Number(fullQuote.discount_amount) || 0,
      discount_type: (fullQuote.discount_type as string) || "none",
      discount_value: Number(fullQuote.discount_value) || 0,
      tax_amount: Number(fullQuote.tax_amount) || 0,
      total_amount: Number(fullQuote.total_amount) || 0,
      lead: leadRaw
        ? {
            id: fullQuote.lead_id as string,
            fullName: leadRaw.full_name as string,
            businessName: leadRaw.business_name as string,
            email: leadRaw.email as string,
            phone: leadRaw.phone as string,
            productInterest: leadRaw.product_interest as string,
          }
        : undefined,
      items: itemsRaw.map((it) => ({
        id: it.id as string,
        quotation_id: it.quotation_id as string,
        description: it.description as string,
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
        discount: Number(it.discount) || 0,
        tax: Number(it.tax) || 0,
        tax_rate: it.tax_rate != null ? Number(it.tax_rate) : null,
        line_total: Number(it.line_total) || 0,
      })),
    }

    let emailSent = false
    let emailError: string | null = null

    if (shouldSend) {
      const lead = quotation.lead
      if (!lead?.email) {
        emailError = "Lead has no email address"
      } else {
        const publicUrl = buildQuotePublicUrl(fullQuote.public_token as string)
        const quoteSubjectTpl = await renderEmailTemplate("quotation_subject", {
          quoteNumber: quotation.quote_number as string,
          titleBlock: quotation.title ? ` — ${quotation.title}` : "",
        })
        emailSent = await sendEmail({
          to: lead.email,
          subject: quoteSubjectTpl.subject,
          replyTo: REPLY_TO.sales,
          text: buildPlainText(quotation as unknown as Quotation, lead as LeadSummary, publicUrl),
          html: buildQuoteEmailHtml(
            {
              quote_number: quotation.quote_number as string,
              title: (quotation.title as string) || "",
              total_amount: Number(quotation.total_amount) || 0,
              valid_until: (quotation.valid_until as string | null) || null,
              notes_public: (quotation.notes_public as string | null) || null,
            },
            lead as LeadSummary,
            publicUrl
          ),
        })
        if (emailSent) {
          const sentAt = new Date().toISOString()
          await supabase
            .from("lead_quotations")
            .update({ status: "SENT", sent_at: sentAt, updated_at: sentAt })
            .eq("id", id)
          quotation.status = "SENT"
          quotation.sent_at = sentAt
        } else {
          emailError = "Email delivery failed (see email logs)"
        }
      }
    }

    return NextResponse.json({ success: true, quotation, emailSent, emailError })
  } catch (e) {
    console.error("[admin/quotations/[id]] PUT", e)
    return NextResponse.json({ error: "Failed to update quotation" }, { status: 500 })
  }
}

function buildPlainText(quote: Quotation, lead: LeadSummary, publicUrl: string): string {
  const validUntil = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })
    : "Not specified"

  return `Hello ${lead.fullName},\n\nPlease find your MartPoint quotation below.\n\nQuote: ${quote.quote_number}${quote.title ? `\nTitle: ${quote.title}` : ""}\nBusiness: ${lead.businessName}\nTotal: ₦${quote.total_amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}\nValid until: ${validUntil}\n\n${quote.notes_public || ""}\n\nView your quotation here:\n${publicUrl}\n\nIf you have any questions, reply to this email.`
}
