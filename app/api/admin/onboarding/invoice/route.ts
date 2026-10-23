import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

async function guardOnboardingAccess() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "onboarding")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function POST(request: Request) {
  const denied = await guardOnboardingAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const { recordId } = body
    if (!recordId) return NextResponse.json({ error: "Onboarding ID is required" }, { status: 400 })

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const { data: record, error: recordError } = await supabase
      .from("onboarding")
      .select("*")
      .eq("id", recordId)
      .single()

    if (recordError || !record) {
      return NextResponse.json({ error: "Onboarding record not found" }, { status: 404 })
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("source_lead_id", record.lead_id)
      .maybeSingle()

    if (!business?.id) {
      return NextResponse.json({
        error: "This client has no customer business yet. Accept the commercial quote and create the business from Finance first.",
      }, { status: 409 })
    }

    const [{ data: invoices }, { data: acceptedQuote }] = await Promise.all([
      supabase.from("invoices").select("id, invoice_number").eq("business_id", business.id).limit(1),
      supabase.from("quotes").select("id, quote_number").eq("business_id", business.id).eq("status", "ACCEPTED").limit(1).maybeSingle(),
    ])

    if ((invoices || []).length > 0) {
      return NextResponse.json({ error: "An invoice already exists for this customer. Use Commercial Finance → Payments; onboarding cannot create another invoice." }, { status: 409 })
    }
    if (!acceptedQuote) {
      return NextResponse.json({ error: "No accepted commercial quote exists. Create and accept the quote in Commercial Finance before invoicing." }, { status: 409 })
    }

    return NextResponse.json({
      error: `Use Commercial Finance → Quotes → Convert to Invoice for ${acceptedQuote.quote_number}. Onboarding no longer creates standalone invoices.`,
      quoteId: acceptedQuote.id,
    }, { status: 409 })
  } catch {
    return NextResponse.json({ error: "Unable to verify the commercial billing state" }, { status: 500 })
  }
}
