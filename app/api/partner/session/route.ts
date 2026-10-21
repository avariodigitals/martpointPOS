import { NextResponse } from "next/server"
import { destroyPartnerSession, getPartnerSession, getPartnerSessionTimeoutMs, refreshPartnerSessionActivity } from "@/lib/partner-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getPartnerSession()
  return NextResponse.json({ authenticated: session !== null, timeoutMs: getPartnerSessionTimeoutMs() })
}

export async function POST() {
  const session = await refreshPartnerSessionActivity()
  if (!session) {
    await destroyPartnerSession()
    return NextResponse.json({ error: "Session expired" }, { status: 401 })
  }
  return NextResponse.json({ success: true, timeoutMs: getPartnerSessionTimeoutMs() })
}
