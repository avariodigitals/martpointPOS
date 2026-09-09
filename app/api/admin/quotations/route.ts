import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recalculateQuote, buildQuotePublicUrl, buildQuoteEmailHtml } from "@/lib/quotations"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import type { Quotation, QuotationItem } from "@/lib/quotations"

async function guardQuotationsAccess() {
  return authorizeAdmin("quotations")
}

/* ─── GET: list quotations with lead info and items ─── */
export async function GET(request: Request) {
  const { denied } = await guardQuotationsAccess()
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ quotations: [] })
  }

  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get("leadId")
    const status = searchParams.get("status")

    let q = supabase
      .from("lead_quotations")
      .select("*, lead:leads (full_name, business_name, email, phone, product_interest), items:lead_quotation_items(*)")
      .order("created_at", { ascending: false })

    if (leadId) q = q.eq("lead_id", leadId)
    if (status) q = q.eq("status", status)

    const { data, error } = await q
    if (error) throw error

    const quotations = (data || []).map((row: Record<string, unknown>) => mapQuotation(row))

    const [{ data: products }, { data: services }] = await Promise.all([
      supabase.from("commercial_products").select("id, name, description, default_price, currency").eq("status", "ACTIVE").order("name"),
      supabase.from("services").select("id, name, description, default_price, currency").eq("active", true).order("name"),
    ])

    return NextResponse.json({
      quotations,
      products: products || [],
      services: services || [],
    })
  } catch (e) {
    console.error("[admin/quotations] GET", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

/* ─── POST: create a quotation and optional items, optionally send email ─── */
export async function POST(request: Request) {
  const { session, denied } = await guardQuotationsAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const {
      leadId,
      title,
      validUntil,
      notesPublic,
      notesInternal,
      paymentTerms,
      items,
      sendEmail: shouldSend,
      allowChanges,
      allowCounterOffer,
    } = body as {
      leadId: string
      title?: string
      validUntil?: string
      notesPublic?: string
      notesInternal?: string
      paymentTerms?: string
      items: Array<{ description: string; quantity: number; unitPrice: number; discount?: number; tax?: number }>
      sendEmail?: boolean
      allowChanges?: boolean
      allowCounterOffer?: boolean
    }

    if (!leadId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Lead and at least one item are required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const leadRes = await supabase
      .from("leads")
      .select("id, full_name, business_name, email, phone, product_interest")
      .eq("id", leadId)
      .single()

    if (leadRes.error || !leadRes.data) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const totals = recalculateQuote(items.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      discount: Number(it.discount) || 0,
      tax: Number(it.tax) || 0,
    })))

    const year = new Date().getFullYear()
    const { data: quoteNumberData, error: quoteNumberError } = await supabase.rpc("next_lead_quote_number", { p_year: year })
    if (quoteNumberError || !quoteNumberData) {
      console.error("[admin/quotations] quote number error", quoteNumberError)
      return NextResponse.json({ error: "Failed to generate quote number" }, { status: 500 })
    }

    const quoteNumber = String(quoteNumberData)

    const { data: created, error: insertError } = await supabase
      .from("lead_quotations")
      .insert({
        lead_id: leadId,
        quote_number: quoteNumber,
        title: title || "",
        status: shouldSend ? "SENT" : "DRAFT",
        currency: "NGN",
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        valid_until: validUntil || null,
        notes_public: notesPublic || null,
        notes_internal: notesInternal || null,
        payment_terms: paymentTerms || null,
        created_by: session?.username || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sent_at: shouldSend ? new Date().toISOString() : null,
        allow_changes: Boolean(allowChanges),
        allow_counter_offer: Boolean(allowChanges) && Boolean(allowCounterOffer),
      })
      .select("*")
      .single()

    if (insertError || !created) {
      console.error("[admin/quotations] insert error", insertError)
      return NextResponse.json({ error: "Failed to create quotation" }, { status: 500 })
    }

    const itemRows = totals.items.map((it) => ({
      quotation_id: created.id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      discount: it.discount,
      tax: it.tax,
      line_total: it.lineTotal,
    }))

    const { error: itemsError } = await supabase.from("lead_quotation_items").insert(itemRows)
    if (itemsError) {
      console.error("[admin/quotations] items insert error", itemsError)
      return NextResponse.json({ error: "Failed to save quote items" }, { status: 500 })
    }

    const { data: fullQuote, error: fullError } = await supabase
      .from("lead_quotations")
      .select("*, lead:leads (full_name, business_name, email, phone, product_interest), items:lead_quotation_items(*)")
      .eq("id", created.id)
      .single()

    if (fullError || !fullQuote) {
      return NextResponse.json({ error: "Quotation created but could not be loaded" }, { status: 500 })
    }

    const quotation = mapQuotation(fullQuote)

    if (shouldSend && leadRes.data.email) {
      const publicUrl = buildQuotePublicUrl(quotation.public_token)
      const quoteSubjectTpl = await renderEmailTemplate("quotation_subject", {
        quoteNumber: quotation.quote_number,
        titleBlock: quotation.title ? ` — ${quotation.title}` : "",
      })
      await sendEmail({
        to: leadRes.data.email,
        subject: quoteSubjectTpl.subject,
        text: buildPlainTextEmail(quotation, leadRes.data as { full_name: string; business_name: string; email: string; phone: string; product_interest: string }, publicUrl),
        html: buildQuoteEmailHtml(
          quotation,
          {
            id: leadRes.data.id as string,
            fullName: leadRes.data.full_name as string,
            businessName: leadRes.data.business_name as string,
            email: leadRes.data.email as string,
            phone: leadRes.data.phone as string,
            productInterest: leadRes.data.product_interest as string,
          },
          publicUrl
        ),
      })
    }

    return NextResponse.json({ success: true, quotation })
  } catch (e) {
    console.error("[admin/quotations] POST", e)
    return NextResponse.json({ error: "Failed to create quotation" }, { status: 500 })
  }
}

function buildPlainTextEmail(
  quote: Pick<Quotation, "quote_number" | "title" | "total_amount" | "valid_until" | "notes_public">,
  lead: { full_name: string; business_name: string; email: string; phone: string; product_interest: string },
  publicUrl: string
): string {
  const validUntil = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })
    : "Not specified"

  return `Hello ${lead.full_name},\n\nPlease find your MartPoint quotation below.\n\nQuote: ${quote.quote_number}${quote.title ? `\nTitle: ${quote.title}` : ""}\nBusiness: ${lead.business_name}\nTotal: ₦${quote.total_amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}\nValid until: ${validUntil}\n\n${quote.notes_public || ""}\n\nView your quotation here:\n${publicUrl}\n\nIf you have any questions, reply to this email.`
}

function mapQuotation(row: Record<string, unknown>): Quotation {
  const leadRawMaybe = row.lead as Record<string, unknown> | Record<string, unknown>[] | undefined
  const leadRaw = Array.isArray(leadRawMaybe) ? leadRawMaybe[0] : leadRawMaybe
  const itemsRaw = Array.isArray(row.items) ? (row.items as unknown as Record<string, unknown>[]) : []

  return {
    id: row.id as string,
    lead_id: row.lead_id as string,
    quote_number: row.quote_number as string,
    title: (row.title as string) || "",
    status: row.status as Quotation["status"],
    currency: (row.currency as string) || "NGN",
    subtotal: Number(row.subtotal) || 0,
    discount_amount: Number(row.discount_amount) || 0,
    tax_amount: Number(row.tax_amount) || 0,
    total_amount: Number(row.total_amount) || 0,
    valid_until: (row.valid_until as string | null) || null,
    notes_public: (row.notes_public as string | null) || null,
    notes_internal: (row.notes_internal as string | null) || null,
    payment_terms: (row.payment_terms as string | null) || null,
    converted_business_id: (row.converted_business_id as string | null) || null,
    converted_invoice_id: (row.converted_invoice_id as string | null) || null,
    public_token: row.public_token as string,
    token_expires_at: (row.token_expires_at as string | null) || null,
    viewed_at: (row.viewed_at as string | null) || null,
    sent_at: (row.sent_at as string | null) || null,
    created_by: (row.created_by as string | null) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    allow_changes: Boolean(row.allow_changes),
    allow_counter_offer: Boolean(row.allow_counter_offer),
    lead: leadRaw
      ? {
          id: row.lead_id as string,
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
      line_total: Number(it.line_total) || 0,
    })) as QuotationItem[],
  }
}
