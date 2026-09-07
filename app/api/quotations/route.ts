import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getPublicSiteSettings } from "@/lib/settings"

/* ─── GET: public quotation by secret token ─── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("lead_quotations")
      .select("*, lead:leads (full_name, business_name, email, phone, product_interest), items:lead_quotation_items(*)")
      .eq("public_token", token)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }

    if (data.token_expires_at && new Date(data.token_expires_at as string) < new Date()) {
      return NextResponse.json({ error: "Quotation link has expired" }, { status: 410 })
    }

    if (data.status === "EXPIRED") {
      return NextResponse.json({ error: "Quotation has expired" }, { status: 410 })
    }

    await supabase.from("lead_quotations").update({ viewed_at: new Date().toISOString() }).eq("id", data.id)

    const leadRaw = Array.isArray(data.lead) ? data.lead[0] : (data.lead as Record<string, unknown> | undefined)
    const itemsRaw = Array.isArray(data.items) ? data.items : []

    const [siteSettings] = await Promise.all([getPublicSiteSettings()])

    const quotation = {
      ...data,
      subtotal: Number(data.subtotal) || 0,
      discount_amount: Number(data.discount_amount) || 0,
      tax_amount: Number(data.tax_amount) || 0,
      total_amount: Number(data.total_amount) || 0,
      payment_terms: (data.payment_terms as string | null) || null,
      converted_business_id: (data.converted_business_id as string | null) || null,
      converted_invoice_id: (data.converted_invoice_id as string | null) || null,
      lead: leadRaw ? {
        full_name: leadRaw.full_name,
        business_name: leadRaw.business_name,
        email: leadRaw.email,
        phone: leadRaw.phone,
        product_interest: leadRaw.product_interest,
      } : null,
      items: itemsRaw.map((it: Record<string, unknown>) => ({
        ...it,
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
        discount: Number(it.discount) || 0,
        tax: Number(it.tax) || 0,
        line_total: Number(it.line_total) || 0,
      })),
    }

    return NextResponse.json({ quotation, settings: siteSettings })
  } catch (e) {
    console.error("[quotations] GET", e)
    return NextResponse.json({ error: "Failed to load quotation" }, { status: 500 })
  }
}

/* ─── POST: accept or decline a quotation by token ─── */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    const body = await request.json()
    const { action } = body as { action: "accept" | "decline" }

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    if (!["accept", "decline"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data: quote, error } = await supabase
      .from("lead_quotations")
      .select("id, status, token_expires_at")
      .eq("public_token", token)
      .single()

    if (error || !quote) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }

    if ((quote.token_expires_at as string | null) && new Date(quote.token_expires_at as string) < new Date()) {
      return NextResponse.json({ error: "Quotation link has expired" }, { status: 410 })
    }

    if (quote.status === "EXPIRED") {
      return NextResponse.json({ error: "Quotation has expired" }, { status: 410 })
    }

    const newStatus = action === "accept" ? "ACCEPTED" : "DECLINED"
    const { error: updateError } = await supabase
      .from("lead_quotations")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", quote.id)

    if (updateError) {
      console.error("[quotations] POST update", updateError)
      return NextResponse.json({ error: "Failed to update quotation" }, { status: 500 })
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (e) {
    console.error("[quotations] POST", e)
    return NextResponse.json({ error: "Failed to respond to quotation" }, { status: 500 })
  }
}
