import { NextResponse } from "next/server"
import { createPartnerPasswordReset } from "@/lib/partner-service"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "partner-password-forgot", max: 5, windowSeconds: 600 })
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
  }

  try {
    const { email, captchaToken } = await request.json()
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const captcha = await verifyCaptchaToken(captchaToken ?? null, request)
    if (!captcha.success) {
      return NextResponse.json({ error: captcha.error }, { status: 403 })
    }

    // Always return generic success to prevent email enumeration.
    await createPartnerPasswordReset(email.trim().toLowerCase())
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}
