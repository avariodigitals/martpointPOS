import { NextResponse } from "next/server"
import { requirePartnerSession, authorizePartner, getPartnerById } from "@/lib/partner-auth"
import { listPartnerBrandingRequests, createPartnerBrandingRequest } from "@/lib/partner-service"

export async function GET() {
  const session = await requirePartnerSession()
  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) return auth.response!

  const requests = await listPartnerBrandingRequests(session.partnerId)
  return NextResponse.json({ requests })
}

export async function POST(request: Request) {
  const session = await requirePartnerSession()
  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) return auth.response!

  const partner = await getPartnerById(session.partnerId)
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 })

  try {
    const body = await request.json()
    const { title, description } = body
    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 })
    }

    const result = await createPartnerBrandingRequest(
      session.partnerId,
      title.trim(),
      description.trim(),
      session.partnerUserId
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ success: true, request: result.request })
  } catch {
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
  }
}
