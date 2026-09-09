import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getPublicSiteSettings } from "@/lib/settings"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import { formatNgnFull } from "@/lib/quotations"

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

    const [siteSettings, changeReqRes] = await Promise.all([
      getPublicSiteSettings(),
      supabase
        .from("lead_quote_change_requests")
        .select("id, request_type, status, created_at, resolved_at")
        .eq("quotation_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const changeRequest = changeReqRes.data
      ? {
          id: changeReqRes.data.id as string,
          request_type: changeReqRes.data.request_type as "scope" | "counter_offer",
          status: changeReqRes.data.status as "pending" | "approved" | "declined",
          created_at: changeReqRes.data.created_at as string,
          resolved_at: (changeReqRes.data.resolved_at as string | null) || null,
        }
      : null

    const quotation = {
      ...data,
      subtotal: Number(data.subtotal) || 0,
      discount_amount: Number(data.discount_amount) || 0,
      tax_amount: Number(data.tax_amount) || 0,
      total_amount: Number(data.total_amount) || 0,
      payment_terms: (data.payment_terms as string | null) || null,
      converted_business_id: (data.converted_business_id as string | null) || null,
      converted_invoice_id: (data.converted_invoice_id as string | null) || null,
      allow_changes: Boolean(data.allow_changes),
      allow_counter_offer: Boolean(data.allow_counter_offer),
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
        tax_rate: it.tax_rate != null ? Number(it.tax_rate) : null,
        line_total: Number(it.line_total) || 0,
      })),
    }

    return NextResponse.json({ quotation, settings: siteSettings, changeRequest })
  } catch (e) {
    console.error("[quotations] GET", e)
    return NextResponse.json({ error: "Failed to load quotation" }, { status: 500 })
  }
}

/* ─── POST: respond to a quotation by token ─── */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    const body = await request.json()
    const { action } = body as {
      action: "accept" | "decline" | "request_changes" | "counter_offer"
      items?: Array<{ item_id: string | null; description: string; quantity: number }>
      proposedBudget?: number | null
      proposedTotal?: number | null
      note?: string
    }

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    if (!["accept", "decline", "request_changes", "counter_offer"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data: quote, error } = await supabase
      .from("lead_quotations")
      .select("id, status, quote_number, title, total_amount, public_token, token_expires_at, allow_changes, allow_counter_offer, lead:leads (full_name, business_name, email)")
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

    // ── accept / decline ──
    if (action === "accept" || action === "decline") {
      const newStatus = action === "accept" ? "ACCEPTED" : "DECLINED"
      const { error: updateError } = await supabase
        .from("lead_quotations")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", quote.id)
      if (updateError) {
        console.error("[quotations] POST update", updateError)
        return NextResponse.json({ error: "Failed to update quotation" }, { status: 500 })
      }

      // Notify on decline.
      if (action === "decline") {
        try {
          const leadRawMaybe = quote.lead as unknown as Record<string, unknown> | Record<string, unknown>[] | undefined
          const leadRaw = Array.isArray(leadRawMaybe) ? leadRawMaybe[0] : leadRawMaybe
          const fullName = (leadRaw?.full_name as string) || ""
          const businessName = (leadRaw?.business_name as string) || ""
          const email = (leadRaw?.email as string) || ""

          const clientTpl = await renderEmailTemplate("quote_declined_client", {
            fullName: fullName || businessName || "there",
            quoteNumber: quote.quote_number as string,
            title: (quote.title as string) || "",
            total: formatNgnFull(Number(quote.total_amount) || 0),
            publicUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"}/quote/${quote.public_token}`,
          })

          if (email) {
            await sendEmail({ to: email, subject: clientTpl.subject, text: clientTpl.text, html: clientTpl.html })
          }

          const teamTpl = await renderEmailTemplate("quote_declined_team", {
            quoteNumber: quote.quote_number as string,
            title: (quote.title as string) || "",
            fullName,
            businessName,
            email: email || "—",
            adminUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"}/admin/quotations`,
          })

          await sendEmail({
            to: "",
            route: "quote_declined",
            subject: teamTpl.subject,
            text: teamTpl.text,
            html: teamTpl.html,
          })
        } catch (notifyErr) {
          console.error("[quotations] decline notify", notifyErr)
        }
      }

      return NextResponse.json({ success: true, status: newStatus })
    }

    // ── request_changes / counter_offer ──
    if (!quote.allow_changes) {
      return NextResponse.json({ error: "Change requests are not enabled for this quotation" }, { status: 403 })
    }
    if (action === "counter_offer" && !quote.allow_counter_offer) {
      return NextResponse.json({ error: "Counter-offers are not enabled for this quotation" }, { status: 403 })
    }

    // One round only: reject if there is already a change request on this quote.
    const { data: existing, error: existingErr } = await supabase
      .from("lead_quote_change_requests")
      .select("id")
      .eq("quotation_id", quote.id)
      .limit(1)
      .maybeSingle()
    if (existingErr) {
      console.error("[quotations] change request check", existingErr)
      return NextResponse.json({ error: "Failed to verify change request" }, { status: 500 })
    }
    if (existing) {
      return NextResponse.json({ error: "A change request has already been submitted for this quotation" }, { status: 409 })
    }

    const requestType = action === "counter_offer" ? "counter_offer" : "scope"
    const payload: Record<string, unknown> = {}
    if (requestType === "scope") {
      const scopeItemsIn = (body.items || []) as Array<{ item_id: string | null; description: string; quantity: number }>
      payload.items = scopeItemsIn
        .filter((it) => it && it.description && Number(it.quantity) > 0)
        .map((it) => ({
          item_id: it.item_id || null,
          description: String(it.description).slice(0, 500),
          quantity: Math.max(0, Number(it.quantity) || 0),
        }))
      if (body.proposedBudget != null && !Number.isNaN(Number(body.proposedBudget))) {
        payload.proposed_budget = Math.max(0, Number(body.proposedBudget) || 0)
      }
    } else {
      payload.proposed_total = Math.max(0, Number(body.proposedTotal) || 0)
    }

    const { error: insertErr } = await supabase
      .from("lead_quote_change_requests")
      .insert({
        quotation_id: quote.id,
        request_type: requestType,
        payload,
        client_note: (body.note || "").toString().slice(0, 2000) || null,
        status: "pending",
      })
    if (insertErr) {
      console.error("[quotations] change request insert", insertErr)
      return NextResponse.json({ error: "Failed to submit change request" }, { status: 500 })
    }

    const newStatus = requestType === "counter_offer" ? "COUNTER_OFFERED" : "CHANGE_REQUESTED"
    const { error: updateError } = await supabase
      .from("lead_quotations")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", quote.id)
    if (updateError) {
      console.error("[quotations] POST status update", updateError)
    }

    // Notify the sales team (best-effort; never block the response).
    try {
      const leadRawMaybe = quote.lead as unknown as Record<string, unknown> | Record<string, unknown>[] | undefined
      const leadRaw = Array.isArray(leadRawMaybe) ? leadRawMaybe[0] : leadRawMaybe
      const adminUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"}/admin/quotations`
      const tpl = await renderEmailTemplate("quote_change_request_received", {
        quoteNumber: quote.quote_number as string,
        leadName: (leadRaw?.full_name as string) || "",
        businessName: (leadRaw?.business_name as string) || "",
        requestType: requestType === "counter_offer" ? "Counter-offer" : "Scope change",
        clientNote: (body.note || "").toString() || "—",
        adminUrl,
      })
      await sendEmail({
        to: "",
        route: "quote_change_request",
        subject: tpl.subject,
        text: tpl.text,
      })
    } catch (notifyErr) {
      console.error("[quotations] change request notify", notifyErr)
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (e) {
    console.error("[quotations] POST", e)
    return NextResponse.json({ error: "Failed to respond to quotation" }, { status: 500 })
  }
}
