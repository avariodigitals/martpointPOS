import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { getLearningById } from "@/lib/creator-learning"
import { getAssessmentQuestionsAdmin, saveAssessmentQuestions } from "@/lib/creator-assessment"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { ASSESSMENT_QUESTION_TYPES } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: Params) {
  const { denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied
  const { id } = await params
  const questions = await getAssessmentQuestionsAdmin(id)
  return NextResponse.json({ questions })
}

const questionSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().trim().min(3).max(1000),
  type: z.enum(ASSESSMENT_QUESTION_TYPES),
  options: z.array(z.object({ key: z.string().max(10), text: z.string().max(500) })),
  correctKeys: z.array(z.string().max(10)).min(1),
  feedback: z.string().max(2000).nullish(),
})

const bodySchema = z.object({ questions: z.array(questionSchema) })

export async function PUT(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.assessment.manage")
  if (denied) return denied
  const { id } = await params

  const content = await getLearningById(id)
  if (!content || content.type !== "ASSESSMENT") {
    return NextResponse.json({ error: "Not an assessment" }, { status: 404 })
  }

  try {
    const { questions } = bodySchema.parse(await request.json())
    for (const q of questions) {
      const optionKeys = new Set(q.options.map((o) => o.key))
      const validKeys = q.type === "TRUE_FALSE" ? new Set(["true", "false"]) : optionKeys
      if (q.type !== "TRUE_FALSE" && q.options.length < 2) {
        return NextResponse.json({ error: `Question "${q.question.slice(0, 40)}" needs at least 2 options` }, { status: 400 })
      }
      for (const k of q.correctKeys) {
        if (!validKeys.has(k)) {
          return NextResponse.json({ error: `Correct key "${k}" not in options for "${q.question.slice(0, 40)}"` }, { status: 400 })
        }
      }
      if (q.type === "SINGLE" && q.correctKeys.length !== 1) {
        return NextResponse.json({ error: `"${q.question.slice(0, 40)}": single-choice needs exactly 1 correct answer` }, { status: 400 })
      }
    }
    const { error } = await saveAssessmentQuestions(id, questions)
    if (error) return NextResponse.json({ error }, { status: 500 })
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_ASSESSMENT_QUESTIONS_SAVED,
      entityType: "creator_learning_content",
      entityId: id,
      metadata: { count: questions.length },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save questions" }, { status: 500 })
  }
}
