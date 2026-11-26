import { NextResponse } from "next/server"
import { requirePartnerSession } from "@/lib/partner-auth"
import { getPerformanceTrack, partnerTypesFor } from "@/lib/partner-performance-grading"
import { supabase } from "@/lib/supabase"

export async function GET() {
  const session = await requirePartnerSession()
  const { data: partner } = await supabase.from("partners").select("partner_type").eq("id", session.partnerId).maybeSingle()
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 })
  const types = partnerTypesFor(String(partner.partner_type || ""))
  const tracks = await Promise.all(types.map((type) => getPerformanceTrack(session.partnerId, type)))
  return NextResponse.json({ tracks, activityMonitoringDays: 90, policyStatus: tracks[0]?.policyStatus || "DRAFT" })
}
