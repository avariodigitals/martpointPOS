import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import {
  listCityRequests,
  approveCityRequest,
  rejectCityRequest,
} from "@/lib/city-requests"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
    const requests = await listCityRequests(status ? { status: status as "pending" | "approved" | "rejected" } : undefined)
    return NextResponse.json({ success: true, requests })
  } catch (e) {
    console.error("[admin/city-requests] GET", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { action, id, correctedCity } = body as { action?: string; id?: string; correctedCity?: string }

    if (action === "approve" && id) {
      await approveCityRequest({ id, correctedCity, resolvedBy: session.userId })
    } else if (action === "reject" && id) {
      await rejectCityRequest({ id, resolvedBy: session.userId })
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[admin/city-requests] POST", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
