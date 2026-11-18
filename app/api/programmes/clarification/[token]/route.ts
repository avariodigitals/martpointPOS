import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { checkRateLimit } from "@/lib/rate-limit"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"
type Context = { params: Promise<{ token: string }> }

function tokenHash(token: string) { return crypto.createHash("sha256").update(token).digest("hex") }

export async function GET(request: Request, context: Context) {
  const limit = await checkRateLimit(request, { key: "business-growth-clarification", max: 15, windowSeconds: 3600 })
  if (!limit.allowed) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "This link is unavailable." }, { status: 503 })
  const { token } = await context.params
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ error: "This clarification link is invalid or expired." }, { status: 404 })
  const { data: app } = await supabase.from("business_growth_applications").select("id,applicant_name,clarification_expires_at,application_status").eq("clarification_token_hash", tokenHash(token)).maybeSingle()
  if (!app || app.application_status !== "NEEDS_CLARIFICATION" || !app.clarification_expires_at || new Date(app.clarification_expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "This clarification link is invalid or expired." }, { status: 404 })
  const { data: assessment } = await supabase.from("business_growth_assessments").select("clarification_questions").eq("application_id", app.id).eq("status", "COMPLETED").order("version", { ascending: false }).limit(1).maybeSingle()
  const questions = Array.isArray(assessment?.clarification_questions) ? assessment.clarification_questions : []
  if (!questions.length) return NextResponse.json({ error: "There are no questions awaiting a response." }, { status: 404 })
  return NextResponse.json({ applicantName: app.applicant_name, questions, expiresAt: app.clarification_expires_at })
}

const responseSchema = z.object({ responses: z.array(z.string().trim().min(1).max(1200)).min(1).max(8) })

export async function POST(request: Request, context: Context) {
  const limit = await checkRateLimit(request, { key: "business-growth-clarification-submit", max: 5, windowSeconds: 3600 })
  if (!limit.allowed) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "This link is unavailable." }, { status: 503 })
  const { token } = await context.params
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ error: "This clarification link is invalid or expired." }, { status: 404 })
  const parsed = responseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Please answer every clarification question." }, { status: 400 })
  const hash = tokenHash(token)
  const { data: app } = await supabase.from("business_growth_applications").select("id,programme_id,application_status,clarification_expires_at").eq("clarification_token_hash", hash).maybeSingle()
  if (!app || app.application_status !== "NEEDS_CLARIFICATION" || !app.clarification_expires_at || new Date(app.clarification_expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "This clarification link is invalid or expired." }, { status: 404 })
  const { data: assessment } = await supabase.from("business_growth_assessments").select("clarification_questions").eq("application_id", app.id).eq("status", "COMPLETED").order("version", { ascending: false }).limit(1).maybeSingle()
  const questions = Array.isArray(assessment?.clarification_questions) ? assessment.clarification_questions.map(String) : []
  if (questions.length !== parsed.data.responses.length) return NextResponse.json({ error: "The clarification questions changed. Please contact MartPoint for a new link." }, { status: 409 })
  const { error } = await supabase.rpc("submit_business_growth_clarification", { p_token_hash: hash, p_responses: parsed.data.responses.map((answer, index) => ({ question: questions[index], answer })) })
  if (error) return NextResponse.json({ error: "This link has expired or was already used. Please contact MartPoint if you need help." }, { status: 409 })
  return NextResponse.json({ success: true })
}
