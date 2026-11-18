import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { validateGrowthAnswers, type GrowthQuestion } from "@/lib/business-growth-programme"

export const dynamic = "force-dynamic"

const submissionSchema = z.object({
  applicantName: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(40),
  state: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().max(240).default(""),
  industry: z.string().trim().min(2).max(120),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  answers: z.record(z.string(), z.unknown()),
  termsAccepted: z.literal(true),
  accuracyConfirmed: z.literal(true),
  marketingConsent: z.boolean().default(false),
  captchaToken: z.string().optional().nullable(),
})

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const limit = await checkRateLimit(request, { key: "business-growth-programme", max: 5, windowSeconds: 3600 })
  if (!limit.allowed) return NextResponse.json({ error: "Too many applications from this connection. Please try again later." }, { status: 429 })
  const captcha = await verifyCaptchaToken((await request.clone().json().catch(() => ({}))).captchaToken, request)
  if (!captcha.success) return NextResponse.json({ error: captcha.error || "Security verification failed." }, { status: 403 })
  const parsed = submissionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check your application." }, { status: 400 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Applications are temporarily unavailable." }, { status: 503 })

  try {
    const { slug } = await context.params
    const { data: programme } = await supabase.from("business_growth_programmes")
      .select("id,status,opens_at,closes_at,questions")
      .eq("slug", slug).maybeSingle()
    const now = Date.now()
    if (!programme || !["OPEN", "SCHEDULED"].includes(programme.status) || (programme.opens_at && new Date(programme.opens_at).getTime() > now) || (programme.closes_at && new Date(programme.closes_at).getTime() <= now)) {
      return NextResponse.json({ error: "This application window is closed." }, { status: 410 })
    }
    const questions = Array.isArray(programme.questions) ? programme.questions as GrowthQuestion[] : []
    const validated = validateGrowthAnswers(questions, parsed.data.answers)
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 })
    const reference = `BGP-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
    const { data, error } = await supabase.rpc("submit_business_growth_application", {
      p_programme_id: programme.id,
      p_reference: reference,
      p_applicant_name: parsed.data.applicantName,
      p_business_name: parsed.data.businessName,
      p_email: parsed.data.email.trim().toLowerCase(),
      p_phone: parsed.data.phone,
      p_state: parsed.data.state,
      p_city: parsed.data.city,
      p_address: parsed.data.address,
      p_industry: parsed.data.industry,
      p_website: parsed.data.website || "",
      p_answers: validated.answers,
      p_marketing_consent: parsed.data.marketingConsent,
      p_public_announcement_consent: false,
    })
    if (error || !data?.[0]) {
      if (error?.message.includes("APPLICATION_WINDOW_CLOSED")) return NextResponse.json({ error: "This application window is closed." }, { status: 410 })
      console.error("[growth programme] application submit failed", error)
      return NextResponse.json({ error: "We could not save your application. Please try again." }, { status: 503 })
    }
    const result = data[0] as { application_id: string; reference: string; duplicate: boolean }
    return NextResponse.json({ success: true, reference: result.reference, duplicate: result.duplicate }, { status: 201 })
  } catch (error) {
    console.error("[growth programme] public application error", error)
    return NextResponse.json({ error: "We could not save your application. Please try again." }, { status: 503 })
  }
}
