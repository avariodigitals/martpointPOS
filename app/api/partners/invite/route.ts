import { NextResponse } from "next/server"
import { getLeadByInviteToken } from "@/lib/partner-leads"
import { getPartnerProspectByToken } from "@/lib/partner-prospects"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* GET /api/partners/invite?token=... — returns prefill data for an invited lead/prospect,
 * or { submitted: true } if an application has already been submitted from this invite.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token") || ""
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  }

  // 1. Partner lead invite
  const lead = await getLeadByInviteToken(token)
  if (lead) {
    const { data: app } = await supabase
      .from("partner_applications")
      .select("reference_number")
      .eq("partner_lead_id", lead.id)
      .maybeSingle()
    if (app) {
      return NextResponse.json({ submitted: true, reference: app.reference_number as string })
    }
    return NextResponse.json({
      prefill: {
        fullName: lead.contactName,
        businessName: lead.businessName,
        email: lead.email || "",
        phone: lead.phone || "",
        country: lead.country,
        state: lead.state,
        city: lead.city,
      },
    })
  }

  // 2. Partner prospect invite
  const prospect = await getPartnerProspectByToken(token)
  if (prospect) {
    if (prospect.linkedApplicationId || prospect.status === "APPLICATION_SUBMITTED" || prospect.status === "CONVERTED") {
      const { data: app } = prospect.linkedApplicationId
        ? await supabase.from("partner_applications").select("reference_number").eq("id", prospect.linkedApplicationId).maybeSingle()
        : { data: null }
      return NextResponse.json({ submitted: true, reference: (app?.reference_number as string) || undefined })
    }
    return NextResponse.json({
      prefill: {
        fullName: prospect.fullName,
        businessName: prospect.businessName || "",
        email: prospect.email || "",
        phone: prospect.phone || "",
        country: prospect.country || "",
        state: prospect.state || "",
        city: prospect.city || "",
      },
    })
  }

  return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 })
}
