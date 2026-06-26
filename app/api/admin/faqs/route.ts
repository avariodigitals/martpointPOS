import { NextRequest, NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

// GET — return all FAQs
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ faqs: [] })
  }
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("[Supabase FAQs Error]", error)
    return NextResponse.json({ faqs: [] })
  }

  const faqs = (data || []).map((row) => ({ id: row.id, question: row.question, answer: row.answer }))
  return NextResponse.json({ faqs })
}

// POST — save all FAQs (replace entire array)
export async function POST(request: NextRequest) {
  try {
    const { faqs } = await request.json()

    if (!Array.isArray(faqs)) {
      return NextResponse.json({ error: "Invalid data: faqs must be an array" }, { status: 400 })
    }

    for (const faq of faqs) {
      if (!faq.id || !faq.question || !faq.answer) {
        return NextResponse.json(
          { error: "Each FAQ must have id, question, and answer" },
          { status: 400 }
        )
      }
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    // Delete existing and insert new
    await supabase.from("faqs").delete().neq("id", "")
    const rows = faqs.map((f: Record<string, unknown>, i: number) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      sort_order: i,
    }))
    const { error } = await supabase.from("faqs").insert(rows)

    if (error) {
      console.error("[Supabase FAQs Save Error]", error)
      return NextResponse.json({ error: "Failed to save FAQs" }, { status: 500 })
    }

    return NextResponse.json({ success: true, faqs })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
