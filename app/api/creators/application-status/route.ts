import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"
import { publicCreatorApplicationStatus, type CreatorApplicationStatus } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

/* Public status lookup: reference + email verification.
 * Returns only a safe, simplified status — never internal notes, AI scores
 * or workflow detail (per spec: internal AI data stays private). */
export async function POST(request: Request) {
  try {
    const rl = await checkRateLimit(request, { key: "creator_status", max: 20, windowSeconds: 3600 })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const reference = String(body.reference || "").trim().toUpperCase()
    const email = String(body.email || "").trim().toLowerCase()

    const captcha = await verifyCaptchaToken(body.captchaToken ?? null, request)
    if (!captcha.success) {
      return NextResponse.json({ error: captcha.error }, { status: 403 })
    }

    if (!reference || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter your application reference and email." }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Status lookup is temporarily unavailable." }, { status: 503 })
    }

    const { data } = await supabase
      .from("creator_applications")
      .select("id, reference_number, email, status, submitted_at")
      .eq("reference_number", reference)
      .maybeSingle()

    // Uniform failure — do not reveal whether reference or email exists.
    if (!data || String(data.email).toLowerCase() !== email) {
      return NextResponse.json({ error: "No application found for those details." }, { status: 404 })
    }

    return NextResponse.json({
      application: {
        reference: data.reference_number,
        submittedAt: data.submitted_at,
        statusLabel: publicCreatorApplicationStatus(data.status as CreatorApplicationStatus),
      },
    })
  } catch (err) {
    console.error("[creators] status lookup error:", err)
    return NextResponse.json({ error: "Lookup failed. Please try again." }, { status: 500 })
  }
}
