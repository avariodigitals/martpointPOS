import { NextResponse } from "next/server"
import { getCitiesForState } from "@/lib/locations"
import { listApprovedCities } from "@/lib/city-requests"

export const runtime = "nodejs"

/** Public: full city list for a country+state (canonical + admin-adopted). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get("country") || ""
    const state = searchParams.get("state") || ""

    if (!country || !state) {
      return NextResponse.json({ success: true, cities: [] })
    }

    const canonical = getCitiesForState(country, state)
    const approved = await listApprovedCities(country, state)

    const merged = [...new Set([...canonical, ...approved])]
    return NextResponse.json({ success: true, cities: merged })
  } catch (e) {
    console.error("[api/locations/cities]", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
