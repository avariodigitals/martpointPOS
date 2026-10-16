import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { mapLeadEmail } from "@/lib/lead-email-outbound"

/* ─── Email history for a Business ───
 * Once a lead is converted, the thread belongs to the customer, not the sales
 * pipeline. It still lives on the originating lead row, so this reads the same
 * lead_emails rows through businesses.source_lead_id and shows them to any
 * admin with access to Businesses — so the whole sales team can read history
 * without owning the lead.
 *
 * Read-only by design: composing still happens on the lead thread so replies
 * keep landing in the one mailbox the IMAP sync reads.
 */
export async function GET(_: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const auth = await authorizeAdmin("businesses", "view")
  if (auth.denied) return auth.denied
  const { businessId } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ emails: [], leadId: null })
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, business_name, source_lead_id")
    .eq("id", businessId)
    .single()

  if (businessError || !business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 })
  }

  const leadId = (business.source_lead_id as string | null) || null
  if (!leadId) {
    return NextResponse.json({ emails: [], leadId: null })
  }

  const { data, error } = await supabase
    .from("lead_emails")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[Business Emails GET]", error)
    return NextResponse.json(
      { error: "Failed to load email history", detail: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    emails: (data || []).map((row) => mapLeadEmail(row as Record<string, unknown>)),
    leadId,
  })
}
