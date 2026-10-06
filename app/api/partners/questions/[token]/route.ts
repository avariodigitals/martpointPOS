import { NextResponse } from "next/server"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { checkRateLimit } from "@/lib/rate-limit"
import { submitApplicationQuestionResponses } from "@/lib/partner-application-questions"

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Service unavailable" }, { status: 503 })
  const { token } = await params
  const { data: round, error } = await supabase.from("partner_application_question_rounds")
    .select("title, fields, responses, status, application:application_id(full_name, business_name)").eq("token", token).single()
  if (error || !round) return NextResponse.json({ error: "This question link is invalid or has expired." }, { status: 404 })
  const applicant = round.application as unknown as { full_name: string; business_name: string | null } | null
  return NextResponse.json({
    title: round.title,
    fields: round.fields,
    responses: round.responses,
    status: round.status,
    applicant: { fullName: applicant?.full_name || "Applicant", businessName: applicant?.business_name || "Partner application" },
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await checkRateLimit(request, { key: "partner-application-question-answer", max: 10, windowSeconds: 600 })
  if (!limited.allowed) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })
  const { token } = await params
  const parsed = z.object({ responses: z.record(z.string(), z.unknown()) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid answers" }, { status: 400 })
  const result = await submitApplicationQuestionResponses(token, parsed.data.responses)
  return result.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: result.error }, { status: 400 })
}
