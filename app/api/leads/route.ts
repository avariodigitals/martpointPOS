import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"
import { processLead } from "@/lib/process-lead"
import { readCreatorRef } from "@/lib/creator-attribution"

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "leads", max: 5, windowSeconds: 3600 })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()

    const turnstile = await verifyCaptchaToken(body.captchaToken, request)
    if (!turnstile.success) {
      return NextResponse.json({ error: turnstile.error }, { status: 403 })
    }

    const {
      fullName,
      businessName,
      email,
      phone,
      businessType,
      productInterest,
      branches,
      staffSize,
      challenge,
      message,
      source,
      partnerCode,
    } = body

    // Validate required fields
    if (!fullName || !businessName || !email || !phone || !businessType || !productInterest || !branches || !staffSize) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Creator attribution via the ?ref= cookie (if the visitor arrived through
    // a creator tracking link). Explicit creatorCode in the body wins.
    const ref = await readCreatorRef()

    const result = await processLead({
      fullName,
      businessName,
      email,
      phone,
      businessType,
      productInterest,
      branches,
      staffSize,
      challenge,
      message,
      source: source || "website",
      partnerCode,
      creatorCode: body.creatorCode || ref?.code || null,
      creatorSubmissionToken: ref?.submissionToken ?? null,
      utm: ref
        ? { source: ref.utmSource, medium: ref.utmMedium, campaign: ref.utmCampaign, content: ref.utmContent }
        : null,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(
      {
        success: true,
        message: "Lead submitted successfully",
        pipeline: productInterest,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to process submission" },
      { status: 500 }
    )
  }
}
