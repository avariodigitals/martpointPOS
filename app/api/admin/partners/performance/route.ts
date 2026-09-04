import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { isSupabaseConfigured } from "@/lib/supabase"
import { getPartnerPerformanceRows, type PerformancePeriod } from "@/lib/partner-360"

/* ─── GET: aggregated partner performance rows ─── */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ rows: [] })
  }

  const { searchParams } = new URL(request.url)
  const period = (searchParams.get("period") || "ALL") as PerformancePeriod

  const rows = await getPartnerPerformanceRows({
    partnerType: searchParams.get("partnerType") || undefined,
    status: searchParams.get("status") || undefined,
    country: searchParams.get("country") || undefined,
    state: searchParams.get("state") || undefined,
    period,
  })

  return NextResponse.json({ rows })
}
