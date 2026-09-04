import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ─── GET: dashboard stats + applications list + partners list ─── */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ stats: {}, applications: [], partners: [] })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const partnerType = searchParams.get("partnerType")
  const country = searchParams.get("country")

  let appQuery = supabase
    .from("partner_applications")
    .select("id, reference_number, applicant_type, requested_partner_type, full_name, business_name, email, country, state, city, status, submitted_at, created_at")
    .order("created_at", { ascending: false })

  if (status) appQuery = appQuery.eq("status", status)
  if (partnerType) appQuery = appQuery.eq("requested_partner_type", partnerType)
  if (country) appQuery = appQuery.eq("country", country)

  const { data: applications, error: appErr } = await appQuery
  if (appErr) {
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 })
  }

  const { data: partners } = await supabase
    .from("partners")
    .select("id, partner_id, business_name, display_name, partner_type, status, country, state, city, partner_since, public_profile_enabled, created_at")
    .order("created_at", { ascending: false })

  // Stats
  const allApps = applications || []
  const allPartners = partners || []
  const stats = {
    applications: allApps.length,
    awaitingReview: allApps.filter((a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW").length,
    informationRequired: allApps.filter((a) => a.status === "MORE_INFORMATION_REQUIRED").length,
    approved: allApps.filter((a) => a.status === "APPROVED" || a.status === "APPROVED_CONDITIONAL").length,
    activePartners: allPartners.filter((p) => p.status === "ACTIVE").length,
    suspendedPartners: allPartners.filter((p) => p.status === "SUSPENDED").length,
  }

  return NextResponse.json({ stats, applications: allApps, partners: allPartners })
}
