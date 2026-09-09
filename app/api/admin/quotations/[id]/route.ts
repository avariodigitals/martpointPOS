import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recalculateQuote } from "@/lib/quotations"

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
  const { session, denied } = await authorizeAdmin("quotations")
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
    } = body as {
      title?: string
      validUntil?: string
      notesPublic?: string
      notesInternal?: string
      paymentTerms?: string
      status?: string
      items: Array<{ description: string; quantity: number; unitPrice: number; discount?: number; tax?: number; taxRate?: number }>
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabase.from("lead_quotations").select("id, quote_number").eq("id", id).single()
    if (existingError || !existing) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }

    const totals = recalculateQuote(items.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      discount: Number(it.discount) || 0,
      taxRate: Number(it.taxRate) || 0,
      tax: Number(it.tax) || 0,
    })))

    const allowedStatuses = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED", "CONVERTED", "CHANGE_REQUESTED", "COUNTER_OFFERED", "REVISED"]
    const updatePayload: Record<string, unknown> = {
      title: title || "",
      valid_until: validUntil || null,
      notes_public: notesPublic || null,
      notes_internal: notesInternal || null,
      payment_terms: paymentTerms || null,
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      tax_amount: totals.taxAmount,
      total_amount: totals.total,
      updated_at: new Date().toISOString(),
    }
    if (status && allowedStatuses.includes(status as string)) {
      updatePayload.status = status
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
      tax_rate: it.taxRate || null,
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

    return NextResponse.json({ success: true, quotation })
  } catch (e) {
    console.error("[admin/quotations/[id]] PUT", e)
    return NextResponse.json({ error: "Failed to update quotation" }, { status: 500 })
  }
}
