import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { updatePartnerUserStatus } from "@/lib/partner-service"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:users:manage" })
  if (!auth.authorized) return auth.response!

  const { id } = await params
  if (id === session.partnerUserId) {
    return NextResponse.json({ error: "You cannot change your own status" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { status } = body
    if (!["ACTIVE", "SUSPENDED", "DISABLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const result = await updatePartnerUserStatus(id, status, {
      id: session.partnerUserId,
      type: "PARTNER",
    })

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
