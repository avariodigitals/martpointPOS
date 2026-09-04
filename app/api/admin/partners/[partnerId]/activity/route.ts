import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { getPartnerActivity } from "@/lib/partner-service"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { partnerId } = await params
  const activity = await getPartnerActivity(partnerId)
  return NextResponse.json({ activity })
}
