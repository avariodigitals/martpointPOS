import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

const STEPS = ["deployment", "configuration", "testing", "training", "handover"]

function averageRating(ratings: Record<string, number>) {
  const values = STEPS.map((s) => Number(ratings[s])).filter((n) => !Number.isNaN(n))
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function relationshipFromRating(avg: number): string {
  if (avg >= 4) return "pleased"
  if (avg >= 3) return "neutral"
  return "unhappy"
}

/* ─── GET: fetch record by feedback token ─── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("leads")
      .select("id, full_name, business_name, product_interest, status, feedback, updated_at")
      .eq("feedback_token", token)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Feedback link not found" }, { status: 404 })
    }

    if (data.status !== "Won") {
      return NextResponse.json({ error: "Feedback is not open for this record" }, { status: 403 })
    }

    return NextResponse.json({
      customer: {
        id: data.id,
        fullName: data.full_name,
        businessName: data.business_name,
        productInterest: data.product_interest,
        feedback: data.feedback || {},
        updatedAt: data.updated_at,
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch feedback link" }, { status: 500 })
  }
}

/* ─── POST: submit feedback by token ─── */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    const body = await request.json()
    const { ratings, comment, mood } = body

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data: existing } = await supabase
      .from("leads")
      .select("id, status, feedback")
      .eq("feedback_token", token)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "Feedback link not found" }, { status: 404 })
    }

    if (existing.status !== "Won") {
      return NextResponse.json({ error: "Feedback is not open for this record" }, { status: 403 })
    }

    const avg = averageRating(ratings || {})
    const relationship = mood && ["pleased", "neutral", "unhappy"].includes(mood) ? mood : relationshipFromRating(avg)

    const feedback = {
      ...existing.feedback,
      ratings: ratings || {},
      comment: comment || "",
      mood: mood || "",
      submittedAt: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("leads")
      .update({
        feedback,
        relationship,
        updated_at: new Date().toISOString(),
      })
      .eq("feedback_token", token)
      .select()
      .single()

    if (error || !data) {
      console.error("[Customer Feedback Update Error]", error)
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 })
    }

    return NextResponse.json({ success: true, customer: data })
  } catch {
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 })
  }
}
