import { NextResponse } from "next/server"
import { resetPartnerPassword } from "@/lib/partner-service"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "partner-password-reset", max: 5, windowSeconds: 300 })
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
  }

  try {
    const { token, password } = await request.json()
    if (!token || !password || password.length < 10) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const result = await resetPartnerPassword(token, password)
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Invalid or expired token" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 })
  }
}
