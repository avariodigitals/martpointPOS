import { NextResponse } from "next/server"
import { requestCityAuthorization } from "@/lib/city-requests"

export const runtime = "nodejs"

/** Public: record a custom city submitted via "Other" so admins can authorise it. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { country, state, city } = body || {}

    if (!country || !state || !city) {
      return NextResponse.json({ success: false, error: "country, state and city are required" }, { status: 400 })
    }

    await requestCityAuthorization({ country, state, city })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[api/locations/city-request]", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
