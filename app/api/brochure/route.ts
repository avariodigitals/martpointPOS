import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"
import { createBrochureLead, getActiveBrochure, getBrochureSignedUrl } from "@/lib/brochure"

export const dynamic = "force-dynamic"

export async function GET() {
  const brochure = await getActiveBrochure()
  return NextResponse.json({ available: !!brochure, brochure })
}

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, {
    key: "brochure_download",
    max: 5,
    windowSeconds: 3600,
  })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const { fullName, businessName, email, phone, businessType } = body

    const turnstile = await verifyCaptchaToken(body.captchaToken, request)
    if (!turnstile.success) {
      return NextResponse.json({ error: turnstile.error }, { status: 403 })
    }

    if (
      !fullName?.trim() ||
      !businessName?.trim() ||
      !email?.trim() ||
      !phone?.trim() ||
      !businessType?.trim()
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const trimmedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      )
    }

    const leadOk = await createBrochureLead({
      fullName: fullName.trim(),
      businessName: businessName.trim(),
      email: trimmedEmail,
      phone: phone.trim(),
      businessType: businessType.trim(),
    })

    if (!leadOk) {
      return NextResponse.json(
        { error: "Failed to save your details. Please try again." },
        { status: 500 }
      )
    }

    const signedUrl = await getBrochureSignedUrl()
    if (!signedUrl) {
      return NextResponse.json(
        { error: "Brochure not available at the moment" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      signedUrl,
      title: "MartPoint Brochure",
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to process your request" },
      { status: 500 }
    )
  }
}
