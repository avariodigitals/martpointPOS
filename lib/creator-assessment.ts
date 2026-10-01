/* ───────────────────────────  Creator assessments  ───────────────────────────
 * Configurable onboarding assessments. Correct answers are NEVER sent to the
 * client — grading happens server-side against creator_assessment_questions.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { trackCreatorEvent } from "./creator-analytics"
import { pushCreatorNotification } from "./creator-notifications"
import type { AssessmentQuestionType } from "./creator-constants"
import { markLessonCompleted } from "./creator-learning"

export interface AssessmentQuestion {
  id: string
  question: string
  type: AssessmentQuestionType
  options: { key: string; text: string }[]
  sortOrder: number
}

export interface AssessmentQuestionAdmin extends AssessmentQuestion {
  correctKeys: string[]
  feedback: string | null
}

const PUBLIC_SELECT = "id, question, type, options, sort_order"
const ADMIN_SELECT = "id, question, type, options, correct_keys, feedback, sort_order"

function mapQuestion(row: Record<string, unknown>, admin: boolean) {
  const base: AssessmentQuestion = {
    id: row.id as string,
    question: row.question as string,
    type: row.type as AssessmentQuestionType,
    options: (row.options as { key: string; text: string }[]) ?? [],
    sortOrder: (row.sort_order as number) ?? 0,
  }
  if (!admin) return base
  return {
    ...base,
    correctKeys: (row.correct_keys as string[]) ?? [],
    feedback: (row.feedback as string) ?? null,
  } satisfies AssessmentQuestionAdmin
}

/** Creator-facing: questions WITHOUT correct answers. */
export async function getAssessmentQuestions(contentId: string): Promise<AssessmentQuestion[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("creator_assessment_questions")
    .select(PUBLIC_SELECT)
    .eq("content_id", contentId)
    .order("sort_order", { ascending: true })
  return (data || []).map((r) => mapQuestion(r, false))
}

export async function getAssessmentQuestionsAdmin(contentId: string): Promise<AssessmentQuestionAdmin[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("creator_assessment_questions")
    .select(ADMIN_SELECT)
    .eq("content_id", contentId)
    .order("sort_order", { ascending: true })
  return (data || []).map((r) => mapQuestion(r, true) as AssessmentQuestionAdmin)
}

export async function saveAssessmentQuestions(
  contentId: string,
  questions: {
    id?: string
    question: string
    type: AssessmentQuestionType
    options: { key: string; text: string }[]
    correctKeys: string[]
    feedback?: string | null
    sortOrder?: number
  }[]
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  // Replace strategy: delete questions not present in the payload, upsert rest.
  const keepIds = questions.map((q) => q.id).filter(Boolean) as string[]
  let del = supabase.from("creator_assessment_questions").delete().eq("content_id", contentId)
  if (keepIds.length > 0) del = del.not("id", "in", `(${keepIds.join(",")})`)
  const { error: delError } = await del
  if (delError) return { error: delError.message }

  const rows = questions.map((q, i) => ({
    ...(q.id ? { id: q.id } : {}),
    content_id: contentId,
    question: q.question.trim(),
    type: q.type,
    options: q.options,
    correct_keys: q.correctKeys,
    feedback: q.feedback ?? null,
    sort_order: q.sortOrder ?? i,
    updated_at: new Date().toISOString(),
  }))
  if (rows.length > 0) {
    const { error } = await supabase.from("creator_assessment_questions").upsert(rows)
    if (error) return { error: error.message }
  }
  return {}
}

export interface AttemptSummary {
  id: string
  attemptNo: number
  score: number | null
  passed: boolean | null
  submittedAt: string | null
}

export async function listAttempts(creatorId: string, contentId: string): Promise<AttemptSummary[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("creator_assessment_attempts")
    .select("id, attempt_no, score, passed, submitted_at")
    .eq("creator_id", creatorId)
    .eq("content_id", contentId)
    .not("submitted_at", "is", null)
    .order("attempt_no", { ascending: false })
  return (data || []).map((a) => ({
    id: a.id as string,
    attemptNo: a.attempt_no as number,
    score: (a.score as number) ?? null,
    passed: (a.passed as boolean) ?? null,
    submittedAt: (a.submitted_at as string) ?? null,
  }))
}

export interface AssessmentResult {
  score: number
  passed: boolean
  attemptNo: number
  maxAttempts: number
  attemptsLeft: number
  /** Question ids the creator got wrong — only when the assessment allows it. */
  incorrectQuestionIds: string[] | null
  error?: string
}

export async function submitAssessment(
  creatorId: string,
  contentId: string,
  answers: Record<string, string[]>,
  config: { passingScore?: number; maxAttempts?: number; showIncorrect?: boolean }
): Promise<AssessmentResult> {
  const fail = (error: string): AssessmentResult => ({
    score: 0, passed: false, attemptNo: 0, maxAttempts: 0, attemptsLeft: 0,
    incorrectQuestionIds: null, error,
  })
  if (!isSupabaseConfigured()) return fail("Supabase not configured")

  const [{ data: questions }, { data: prior }] = await Promise.all([
    supabase
      .from("creator_assessment_questions")
      .select("id, correct_keys, type")
      .eq("content_id", contentId),
    supabase
      .from("creator_assessment_attempts")
      .select("id")
      .eq("creator_id", creatorId)
      .eq("content_id", contentId)
      .not("submitted_at", "is", null),
  ])

  if (!questions || questions.length === 0) return fail("Assessment has no questions")

  const passingScore = config.passingScore ?? 70
  const maxAttempts = config.maxAttempts ?? 3
  const attemptNo = (prior?.length || 0) + 1
  if (attemptNo > maxAttempts) return fail(`Maximum attempts (${maxAttempts}) reached`)

  // Grade: all correct keys selected and no incorrect keys.
  const incorrect: string[] = []
  for (const q of questions) {
    const correct = new Set((q.correct_keys as string[]) || [])
    const chosen = new Set(answers[q.id as string] || [])
    const ok = correct.size === chosen.size && [...correct].every((k) => chosen.has(k))
    if (!ok) incorrect.push(q.id as string)
  }
  const score = Math.round(((questions.length - incorrect.length) / questions.length) * 100)
  const passed = score >= passingScore

  const { error } = await supabase.from("creator_assessment_attempts").insert({
    creator_id: creatorId,
    content_id: contentId,
    attempt_no: attemptNo,
    score,
    passed,
    answers,
    submitted_at: new Date().toISOString(),
  })
  if (error) return fail(error.message)

  void trackCreatorEvent(
    creatorId,
    passed ? "ASSESSMENT_PASSED" : "ASSESSMENT_COMPLETED",
    { type: "assessment", id: contentId },
    { score, attemptNo }
  )

  if (passed) {
    await markLessonCompleted(creatorId, contentId, { score })
    void pushCreatorNotification({
      creatorId,
      type: "ASSESSMENT_PASSED",
      title: "Assessment passed",
      body: `You scored ${score}% — well done.`,
      link: "/creator/learn",
    })
  } else {
    void pushCreatorNotification({
      creatorId,
      type: "ASSESSMENT_RETRY",
      title: "Assessment — try again",
      body: `You scored ${score}%. The passing score is ${passingScore}%. Review the lessons and retry.`,
      link: "/creator/learn",
    })
  }

  return {
    score,
    passed,
    attemptNo,
    maxAttempts,
    attemptsLeft: Math.max(0, maxAttempts - attemptNo),
    incorrectQuestionIds: config.showIncorrect === false ? null : incorrect,
  }
}
