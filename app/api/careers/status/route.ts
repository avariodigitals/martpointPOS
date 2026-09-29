import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"
import { publicApplicationStatus, type ApplicationStatus } from "@/lib/careers"

export const dynamic = "force-dynamic"

/* Public status lookup: reference + email verification.
 * Returns only a safe, simplified status — never internal notes, scores or
 * workflow detail. */
export async function POST(request: Request) {
  try {
    const rl = await checkRateLimit(request, { key: "careers_status", max: 20, windowSeconds: 3600 })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const reference = String(body.reference || "").trim().toUpperCase()
    const email = String(body.email || "").trim().toLowerCase()

    const turnstile = await verifyCaptchaToken(body.captchaToken ?? null, request)
    if (!turnstile.success) {
      return NextResponse.json({ error: turnstile.error }, { status: 403 })
    }

    if (!reference || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter your application reference and email." }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Status lookup is temporarily unavailable." }, { status: 503 })
    }

    const { data } = await supabase
      .from("career_applications")
      .select("id, reference_number, email, status, submitted_at, career_vacancies(title, status)")
      .eq("reference_number", reference)
      .maybeSingle()

    // Uniform failure message — do not reveal whether the reference or the email exists.
    if (!data || String(data.email).toLowerCase() !== email) {
      return NextResponse.json({ error: "No application found for those details." }, { status: 404 })
    }

    const vacancy = data.career_vacancies as { title?: string; status?: string } | null
    return NextResponse.json({
      application: {
        reference: data.reference_number,
        vacancyTitle: vacancy?.title || null,
        submittedAt: data.submitted_at,
        statusLabel: publicApplicationStatus(data.status as ApplicationStatus),
      },
    })
  } catch (err) {
    console.error("[careers] status lookup error:", err)
    return NextResponse.json({ error: "Lookup failed. Please try again." }, { status: 500 })
  }
}
