import { NextResponse } from "next/server"
import {
  getPartnerSession,
  authorizePartner,
  getPartnerById,
} from "@/lib/partner-auth"
import {
  submitPartnerProfileUpdateRequest,
  listPartnerProfileUpdateRequests,
} from "@/lib/partner-service"

export async function GET() {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:profile:view" })
  if (!auth.authorized) return auth.response!

  const [partner, pendingRequests] = await Promise.all([
    getPartnerById(session.partnerId),
    listPartnerProfileUpdateRequests(session.partnerId, "PENDING"),
  ])

  return NextResponse.json({ partner, pendingRequests })
}

export async function PATCH(request: Request) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:profile:update" })
  if (!auth.authorized) return auth.response!

  try {
    const body = await request.json()
    const allowedFields = [
      "publicEmail",
      "publicPhone",
      "website",
      "logoUrl",
      "city",
      "state",
      "country",
      "displayName",
    ]
    const changes: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) changes[field] = body[field]
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const result = await submitPartnerProfileUpdateRequest(
      session.partnerId,
      session.partnerUserId,
      changes
    )

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to submit update request" }, { status: 500 })
  }
}
