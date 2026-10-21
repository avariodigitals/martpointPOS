import { NextResponse } from "next/server"
import { destroyCreatorSession, getCreatorSession, getCreatorSessionTimeoutMs, refreshCreatorSessionActivity } from "@/lib/creator-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getCreatorSession()
  return NextResponse.json({ authenticated: session !== null, timeoutMs: getCreatorSessionTimeoutMs() })
}

export async function POST() {
  const session = await refreshCreatorSessionActivity()
  if (!session) {
    await destroyCreatorSession()
    return NextResponse.json({ error: "Session expired" }, { status: 401 })
  }
  return NextResponse.json({ success: true, timeoutMs: getCreatorSessionTimeoutMs() })
}
