import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { convertLeadToBusiness } from "@/lib/businesses"
import { auditContextFromSession } from "@/lib/audit"
import { nextInvoiceNumber, recalculateInvoice } from "@/lib/finance-commercial"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("quotations")
  if (denied) return denied

  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { businessId, dueDate, paymentTerms } = body as { businessId?: string; dueDate?: string; paymentTerms?: string }

    const { data: quote, error } = await supabase
      .from("lead_quotations")
      .select("*, items:lead_quotation_items(*), lead:leads (*)")
      .eq("id", id)
      .single()

    if (error || !quote) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }

    if (["CONVERTED", "EXPIRED"].includes(quote.status as string)) {
      return NextResponse.json({ error: `Quotation is already ${quote.status}` }, { status: 400 })
    }

    let targetBusinessId = businessId
    const actor = auditContextFromSession(session, request)

    if (!targetBusinessId) {
      // Try to find an existing business created from this lead.
      const { data: existingBusiness } = await supabase
        .from("businesses")
        .select("id")
        .eq("source_lead_id", quote.lead_id)
        .maybeSingle()

      if (existingBusiness) {
        targetBusinessId = existingBusiness.id as string
      } else {
        // Convert the lead to a business (requires status Won).
        const conversion = await convertLeadToBusiness(quote.lead_id as string, actor)
        if (!conversion.ok || !conversion.business) {
          return NextResponse.json(
            { error: conversion.error || "Could not convert lead to business. Mark the lead as Won first." },
            { status: 400 }
          )
        }
        targetBusinessId = conversion.business.id
      }
    }

    if (!targetBusinessId) {
      return NextResponse.json({ error: "No business found or created for this lead" }, { status: 400 })
    }

    // Ensure target business exists.
    const { data: business } = await supabase.from("businesses").select("id").eq("id", targetBusinessId).single()
    if (!business) {
      return NextResponse.json({ error: "Selected business not found" }, { status: 404 })
    }

    const invoiceNumber = await nextInvoiceNumber()
    const today = new Date().toISOString().split("T")[0]
    const due = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

    const { data: inv, error: invError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        business_id: targetBusinessId,
        currency: (quote.currency as string) || "NGN",
        issue_date: today,
        due_date: due,
        subtotal: Number(quote.subtotal) || 0,
        discount_amount: Number(quote.discount_amount) || 0,
        tax_amount: Number(quote.tax_amount) || 0,
        total_amount: Number(quote.total_amount) || 0,
        amount_paid: 0,
        balance_due: Number(quote.total_amount) || 0,
        status: "DRAFT",
        notes_public: (quote.notes_public as string | null) || null,
        notes_internal: `Converted from lead quotation ${quote.quote_number}. ${(quote.notes_internal as string | null) || ""}`.trim(),
        created_by: session?.userId ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (invError || !inv) {
      console.error("[admin/quotations/convert] invoice insert error", invError)
      return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 })
    }

    const items = Array.isArray(quote.items) ? quote.items : []
    if (items.length > 0) {
      await supabase.from("invoice_items").insert(
        items.map((it: Record<string, unknown>) => ({
          invoice_id: inv.id,
          item_type: "CUSTOM",
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          discount: Number(it.discount) || 0,
          tax: Number(it.tax) || 0,
          line_total: Number(it.line_total) || 0,
        }))
      )
      await recalculateInvoice(inv.id)
    }

    const { data: updatedQuote, error: updateError } = await supabase
      .from("lead_quotations")
      .update({
        status: "CONVERTED",
        converted_business_id: targetBusinessId,
        converted_invoice_id: inv.id,
        payment_terms: paymentTerms || (quote.payment_terms as string | null) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.error("[admin/quotations/convert] quote update error", updateError)
    }

    return NextResponse.json({
      success: true,
      invoice: inv,
      quotation: updatedQuote || quote,
      businessId: targetBusinessId,
    })
  } catch (e) {
    console.error("[admin/quotations/convert] POST", e)
    return NextResponse.json({ error: "Failed to convert quotation" }, { status: 500 })
  }
}
