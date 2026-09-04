import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ─── GET: Won leads not yet linked to a business (eligible for conversion) ─── */
export async function GET() {
  const { denied } = await authorizeAdmin("businesses", "view")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ leads: [] })
  }

  const { data: wonLeads, error } = await supabase
    .from("leads")
    .select("id, full_name, business_name, email, phone, business_type, product_interest, source, status, submitted_at")
    .eq("status", "Won")
    .order("submitted_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 })
  }

  const { data: linked } = await supabase
    .from("businesses")
    .select("source_lead_id")
  const linkedSet = new Set((linked || []).map((b: { source_lead_id: string }) => b.source_lead_id))

  const leads = (wonLeads || [])
    .filter((l: { id: string }) => !linkedSet.has(l.id))
    .map((row: Record<string, unknown>) => ({
      id: row.id,
      fullName: row.full_name,
      businessName: row.business_name,
      email: row.email,
      phone: row.phone,
      businessType: row.business_type,
      productInterest: row.product_interest,
      source: row.source,
      submittedAt: row.submitted_at,
    }))

  return NextResponse.json({ leads })
}
