import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { ANSWER_TYPES } from "@/lib/careers"

export const dynamic = "force-dynamic"

interface QuestionInput {
  question_text: string
  answer_type: string
  required?: boolean
  knockout?: boolean
  correct_answer?: string | null
  options?: string[]
}

/* PUT: replace the screening-question set for a vacancy. */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { denied } = await authorizeAdmin("careers.vacancies.edit")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const questions = (body.questions || []) as QuestionInput[]

  for (const q of questions) {
    if (!q.question_text?.trim()) {
      return NextResponse.json({ error: "Every question needs text" }, { status: 400 })
    }
    if (!ANSWER_TYPES.includes(q.answer_type as never)) {
      return NextResponse.json({ error: `Invalid answer type: ${q.answer_type}` }, { status: 400 })
    }
    if ((q.answer_type === "SINGLE_CHOICE" || q.answer_type === "MULTIPLE_CHOICE") && (!q.options || q.options.filter(Boolean).length < 2)) {
      return NextResponse.json({ error: `Choice questions need at least 2 options: "${q.question_text.slice(0, 40)}"` }, { status: 400 })
    }
  }

  await supabase.from("career_screening_questions").delete().eq("vacancy_id", id)

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const { data: created, error } = await supabase
      .from("career_screening_questions")
      .insert({
        vacancy_id: id,
        question_text: q.question_text.trim(),
        answer_type: q.answer_type,
        required: q.required !== false,
        knockout: q.knockout === true,
        correct_answer: q.correct_answer || null,
        sort_order: (i + 1) * 10,
      })
      .select("id")
      .single()
    if (error) {
      console.error("[careers] question insert failed:", error.message)
      return NextResponse.json({ error: "Failed to save questions" }, { status: 500 })
    }
    const opts = (q.options || []).map((o) => o.trim()).filter(Boolean)
    if (opts.length > 0 && created) {
      await supabase.from("career_question_options").insert(
        opts.map((o, j) => ({ question_id: created.id, option_text: o, sort_order: (j + 1) * 10 }))
      )
    }
  }

  return NextResponse.json({ success: true })
}
