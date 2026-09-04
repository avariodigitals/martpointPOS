import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { updatePartnerUserStatus } from "@/lib/partner-service"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partnerId: string; userId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { userId } = await params
  try {
    const body = await request.json()
    const { status } = body
    if (!["ACTIVE", "SUSPENDED", "DISABLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const result = await updatePartnerUserStatus(userId, status, {
      id: session!.userId,
      type: "ADMIN",
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
