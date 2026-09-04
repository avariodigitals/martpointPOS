import { NextResponse } from "next/server"
import { acceptPartnerInvitation } from "@/lib/partner-service"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "partner-invite-accept", max: 10, windowSeconds: 300 })
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
  }

  try {
    const { token, password } = await request.json()

    if (!token || !password || password.length < 10) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const user = await acceptPartnerInvitation(token, password)
    if (!user) {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    })
  } catch {
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 })
  }
}
