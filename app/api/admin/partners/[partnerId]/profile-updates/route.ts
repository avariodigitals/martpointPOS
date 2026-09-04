import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import {
  listPartnerProfileUpdateRequests,
  approvePartnerProfileUpdateRequest,
  rejectPartnerProfileUpdateRequest,
} from "@/lib/partner-service"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { partnerId } = await params
  const requests = await listPartnerProfileUpdateRequests(partnerId)
  return NextResponse.json({ requests })
}

export async function POST(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { params: _params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  try {
    const body = await request.json()
    const { requestId, action } = body
    if (!requestId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const result =
      action === "approve"
        ? await approvePartnerProfileUpdateRequest(requestId, session!.userId)
        : await rejectPartnerProfileUpdateRequest(requestId, session!.userId)

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
