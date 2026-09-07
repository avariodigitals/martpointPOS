import { NextResponse } from "next/server"
import { getLeadByInviteToken } from "@/lib/partner-leads"
import { getPartnerProspectByToken } from "@/lib/partner-prospects"

/* GET /api/partners/invite?token=... — returns prefill data for an invited lead or prospect */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token") || ""
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 })
  }

  const lead = await getLeadByInviteToken(token)
  if (lead) {
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

  const prospect = await getPartnerProspectByToken(token)
  if (prospect) {
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
