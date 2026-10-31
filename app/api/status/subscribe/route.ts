import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  const rate = await checkRateLimit(request, { key: "status-subscribe", max: 5, windowSeconds: 600 })
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
  }

  try {
    const body = await request.json()
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 })
    }

    const captcha = await verifyCaptchaToken(body.captchaToken, request)
    if (!captcha.success) {
      return NextResponse.json({ error: captcha.error || "Verification failed" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Subscriptions are temporarily unavailable." }, { status: 503 })
    }

    const { data: existing } = await supabase
      .from("status_subscribers")
      .select("email, unsubscribed_at")
      .eq("email", email)
      .maybeSingle()

    if (existing) {
      await supabase.from("status_subscribers").update({
        ...(existing.unsubscribed_at ? { unsubscribed_at: null } : {}),
        ...(body.newsletter === true ? { newsletter_opt_in_at: new Date().toISOString(), newsletter_unsubscribed_at: null } : {}),
      }).eq("email", email)
      // Return success either way — do not leak subscription state.
      return NextResponse.json({ success: true })
    }

    const { error } = await supabase.from("status_subscribers").insert({ email, newsletter_opt_in_at: body.newsletter === true ? new Date().toISOString() : null })
    if (error) {
      console.error("[status/subscribe] insert", error)
      return NextResponse.json({ error: "Failed to subscribe. Please try again." }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
