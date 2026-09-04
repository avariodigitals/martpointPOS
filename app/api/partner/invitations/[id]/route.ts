import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { resendPartnerInvitation, revokePartnerInvitation } from "@/lib/partner-service"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:users:invite" })
  if (!auth.authorized) return auth.response!

  const { id } = await params
  const result = await resendPartnerInvitation(id, session.partnerUserId, "PARTNER")
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:users:manage" })
  if (!auth.authorized) return auth.response!

  const { id } = await params
  const result = await revokePartnerInvitation(id, session.partnerUserId, "PARTNER")
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ success: true })
}
