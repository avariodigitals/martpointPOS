import { NextResponse } from "next/server"
import { getCreatorByEmail } from "@/lib/creators"
import { createCreatorAuthToken } from "@/lib/creator-auth"
import { sendCreatorNotification } from "@/lib/creator-notifications"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "creator-password-forgot", max: 5, windowSeconds: 600 })
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
  }

  try {
    const { email, captchaToken } = await request.json()

    const captcha = await verifyCaptchaToken(captchaToken ?? null, request)
    if (!captcha.success) {
      return NextResponse.json({ error: captcha.error }, { status: 403 })
    }

    // Always generic success — no email enumeration.
    if (email && typeof email === "string") {
      const creator = await getCreatorByEmail(email)
      if (creator && creator.status === "ACTIVE") {
        const { ok, token } = await createCreatorAuthToken(creator.id, "RESET_PASSWORD")
        if (ok && token) {
          const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://martpoint.com.ng").replace(/\/$/, "")
          void sendCreatorNotification({
            template: "creator_password_reset",
            to: creator.email,
            creatorId: creator.id,
            vars: {
              fullName: creator.fullName,
              resetUrl: `${siteUrl}/creator/reset-password/${token}`,
            },
          })
        }
      }
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}
