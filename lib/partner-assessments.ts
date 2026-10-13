/* ───────────────────────────  Partner knowledge assessments  ───────────────────────────
 * Tiered, timed knowledge checks for partner applicants and active partners.
 * Correct answers and keywords are NEVER sent to the client — grading happens
 * here, server-side.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, REPLY_TO } from "./email"
import { escapeHtml } from "./email-templates"

/* ───────────────────────────  Types  ─────────────────────────── */

export const ASSESSMENT_QUESTION_TYPES = [
  "SINGLE", "MULTI", "TRUE_FALSE", "DROPDOWN", "SHORT_TEXT", "LONG_TEXT",
] as const
export type AssessmentQuestionType = (typeof ASSESSMENT_QUESTION_TYPES)[number]

export const OBJECTIVE_TYPES: AssessmentQuestionType[] = ["SINGLE", "MULTI", "TRUE_FALSE", "DROPDOWN"]
export const TEXT_TYPES: AssessmentQuestionType[] = ["SHORT_TEXT", "LONG_TEXT"]

export type AssessmentAudience = "APPLICANT" | "PARTNER" | "BOTH"
export type AssessmentOutcome = "PASS" | "CONDITIONAL" | "FAIL"
export type AttemptOutcome = AssessmentOutcome | "PENDING_REVIEW"
export type AssignmentStatus =
  | "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "EXPIRED" | "WAIVED" | "CANCELLED"

export interface AssessmentOption { key: string; text: string }

export interface AssessmentTier {
  id: string
  code: string
  name: string
  description: string
  level: number
  audience: AssessmentAudience
  requiredForApproval: boolean
  active: boolean
}

export interface AssessmentTemplate {
  id: string
  tierId: string
  name: string
  description: string
  instructions: string
  timeLimitMinutes: number
  passingScore: number
  conditionalScore: number
  maxAttempts: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  questionSampleCount: number | null
  showResultImmediately: boolean
  showCorrectAnswers: boolean
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
}

export interface AssessmentQuestion {
  id: string
  templateId: string
  prompt: string
  type: AssessmentQuestionType
  options: AssessmentOption[]
  /** Admin-only. Never included in the payload sent to an applicant. */
  correctKeys: string[]
  acceptedKeywords: string[]
  keywordMode: "ANY" | "ALL"
  points: number
  requiresReview: boolean
  explanation: string | null
  helpText: string
  required: boolean
  sortOrder: number
}

export interface AnswerGrade {
  awarded: number
  max: number
  correct: boolean
  needsReview: boolean
  source: "AUTO" | "KEYWORD" | "MANUAL" | "PENDING"
  note?: string
}

export interface GradingResult {
  grading: Record<string, AnswerGrade>
  score: number
  maxScore: number
  percent: number
  needsReview: boolean
  outcome: AttemptOutcome
}

export interface AssessmentAssignment {
  id: string
  templateId: string
  audience: AssessmentAudience
  applicationId: string | null
  partnerId: string | null
  assigneeName: string
  assigneeEmail: string
  token: string
  status: AssignmentStatus
  dueAt: string | null
  expiresAt: string | null
  attemptsUsed: number
  bestScore: number | null
  bestPercent: number | null
  finalOutcome: AssessmentOutcome | null
  waivedReason: string | null
  assignedByName: string | null
  assignedAt: string
  completedAt: string | null
  /** Frozen at assign time so template edits never rewrite a live paper. */
  template: AssessmentTemplate
  tier: AssessmentTier
}

export interface AssessmentAttempt {
  id: string
  assignmentId: string
  attemptNo: number
  startedAt: string
  deadlineAt: string
  submittedAt: string | null
  answers: Record<string, string[] | string>
  grading: Record<string, AnswerGrade>
  score: number | null
  maxScore: number | null
  percent: number | null
  outcome: AttemptOutcome | null
  needsReview: boolean
  reviewedBy: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  reviewNotes: string | null
}

/* ───────────────────────────  Row mappers  ─────────────────────────── */

function mapTier(row: Record<string, unknown>): AssessmentTier {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    description: (row.description as string) || "",
    level: (row.level as number) ?? 1,
    audience: row.audience as AssessmentAudience,
    requiredForApproval: (row.required_for_approval as boolean) ?? true,
    active: (row.active as boolean) ?? true,
  }
}

function mapTemplate(row: Record<string, unknown>): AssessmentTemplate {
  return {
    id: row.id as string,
    tierId: row.tier_id as string,
    name: row.name as string,
    description: (row.description as string) || "",
    instructions: (row.instructions as string) || "",
    timeLimitMinutes: (row.time_limit_minutes as number) ?? 20,
    passingScore: (row.passing_score as number) ?? 70,
    conditionalScore: (row.conditional_score as number) ?? 50,
    maxAttempts: (row.max_attempts as number) ?? 3,
    shuffleQuestions: (row.shuffle_questions as boolean) ?? false,
    shuffleOptions: (row.shuffle_options as boolean) ?? false,
    questionSampleCount: (row.question_sample_count as number | null) ?? null,
    showResultImmediately: (row.show_result_immediately as boolean) ?? true,
    showCorrectAnswers: (row.show_correct_answers as boolean) ?? false,
    status: row.status as AssessmentTemplate["status"],
  }
}

function mapQuestion(row: Record<string, unknown>): AssessmentQuestion {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    prompt: row.prompt as string,
    type: row.type as AssessmentQuestionType,
    options: (row.options as AssessmentOption[]) ?? [],
    correctKeys: (row.correct_keys as string[]) ?? [],
    acceptedKeywords: (row.accepted_keywords as string[]) ?? [],
    keywordMode: (row.keyword_mode as "ANY" | "ALL") ?? "ANY",
    points: (row.points as number) ?? 1,
    requiresReview: (row.requires_review as boolean) ?? false,
    explanation: (row.explanation as string | null) ?? null,
    helpText: (row.help_text as string) || "",
    required: (row.required as boolean) ?? true,
    sortOrder: (row.sort_order as number) ?? 0,
  }
}

function mapAssignment(row: Record<string, unknown>): AssessmentAssignment {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    audience: row.audience as AssessmentAudience,
    applicationId: (row.application_id as string | null) ?? null,
    partnerId: (row.partner_id as string | null) ?? null,
    assigneeName: (row.assignee_name as string) || "",
    assigneeEmail: (row.assignee_email as string) || "",
    token: row.token as string,
    status: row.status as AssignmentStatus,
    dueAt: (row.due_at as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    attemptsUsed: (row.attempts_used as number) ?? 0,
    bestScore: row.best_score === null ? null : Number(row.best_score),
    bestPercent: (row.best_percent as number | null) ?? null,
    finalOutcome: (row.final_outcome as AssessmentOutcome | null) ?? null,
    waivedReason: (row.waived_reason as string | null) ?? null,
    assignedByName: (row.assigned_by_name as string | null) ?? null,
    assignedAt: row.assigned_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    template: mapTemplate((row.template_snapshot as Record<string, unknown>) || {}),
    tier: mapTier((row.tier_snapshot as Record<string, unknown>) || {}),
  }
}

function mapAttempt(row: Record<string, unknown>): AssessmentAttempt {
  return {
    id: row.id as string,
    assignmentId: row.assignment_id as string,
    attemptNo: row.attempt_no as number,
    startedAt: row.started_at as string,
    deadlineAt: row.deadline_at as string,
    submittedAt: (row.submitted_at as string | null) ?? null,
    answers: (row.answers as Record<string, string[] | string>) ?? {},
    grading: (row.grading as Record<string, AnswerGrade>) ?? {},
    score: row.score === null ? null : Number(row.score),
    maxScore: row.max_score === null ? null : Number(row.max_score),
    percent: (row.percent as number | null) ?? null,
    outcome: (row.outcome as AttemptOutcome | null) ?? null,
    needsReview: (row.needs_review as boolean) ?? false,
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    reviewedByName: (row.reviewed_by_name as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    reviewNotes: (row.review_notes as string | null) ?? null,
  }
}

const TEMPLATE_SELECT =
  "id, tier_id, name, description, instructions, time_limit_minutes, passing_score, conditional_score, max_attempts, shuffle_questions, shuffle_options, question_sample_count, show_result_immediately, show_correct_answers, status"
const QUESTION_SELECT =
  "id, template_id, prompt, type, options, correct_keys, accepted_keywords, keyword_mode, points, requires_review, explanation, help_text, required, sort_order"
const ASSIGNMENT_SELECT =
  "id, template_id, template_snapshot, tier_snapshot, audience, application_id, partner_id, assignee_name, assignee_email, token, status, due_at, expires_at, attempts_used, best_score, best_percent, final_outcome, waived_reason, assigned_by_name, assigned_at, completed_at"
const ATTEMPT_SELECT =
  "id, assignment_id, attempt_no, started_at, deadline_at, submitted_at, answers, grading, score, max_score, percent, outcome, needs_review, reviewed_by, reviewed_by_name, reviewed_at, review_notes"

/* ───────────────────────────  Grading (pure)  ─────────────────────────── */

function toKeyList(answer: string[] | string | undefined): string[] {
  if (Array.isArray(answer)) return answer.map((a) => String(a)).filter(Boolean)
  if (answer === undefined || answer === null || answer === "") return []
  return [String(answer)]
}

function keywordsMatched(answer: string, keywords: string[], mode: "ANY" | "ALL"): boolean {
  const haystack = answer.toLowerCase()
  const hits = keywords.map((k) => haystack.includes(k.trim().toLowerCase()))
  return mode === "ALL" ? hits.every(Boolean) : hits.some(Boolean)
}

/**
 * Mark one answer. Text questions without keywords stay pending — they must be
 * read by a person rather than auto-failed.
 */
export function gradeQuestion(
  question: Pick<AssessmentQuestion, "id" | "type" | "correctKeys" | "acceptedKeywords" | "keywordMode" | "points" | "requiresReview">,
  answer: string[] | string | undefined
): AnswerGrade {
  const max = question.points
  const keys = toKeyList(answer)
  const text = typeof answer === "string" ? answer : keys.join(" ")

  if (OBJECTIVE_TYPES.includes(question.type)) {
    const correct = new Set(question.correctKeys)
    const chosen = new Set(keys)
    const isCorrect =
      question.type === "MULTI"
        ? correct.size === chosen.size && [...correct].every((k) => chosen.has(k))
        : keys.length === 1 && correct.has(keys[0])
    return {
      awarded: isCorrect ? max : 0,
      max,
      correct: isCorrect,
      needsReview: false,
      source: "AUTO",
    }
  }

  // Text answers.
  if (question.requiresReview || question.acceptedKeywords.length === 0) {
    return { awarded: 0, max, correct: false, needsReview: true, source: "PENDING" }
  }
  const isCorrect = text.trim().length > 0 && keywordsMatched(text, question.acceptedKeywords, question.keywordMode)
  return { awarded: isCorrect ? max : 0, max, correct: isCorrect, needsReview: false, source: "KEYWORD" }
}

export function outcomeForPercent(
  percent: number,
  passingScore: number,
  conditionalScore: number
): AssessmentOutcome {
  if (percent >= passingScore) return "PASS"
  if (percent >= conditionalScore) return "CONDITIONAL"
  return "FAIL"
}

/**
 * Grade a whole attempt. Anything still awaiting a person yields
 * PENDING_REVIEW, so a partial score never silently passes or fails.
 */
export function gradeAttempt(
  questions: AssessmentQuestion[],
  answers: Record<string, string[] | string>,
  config: { passingScore: number; conditionalScore: number }
): GradingResult {
  const grading: Record<string, AnswerGrade> = {}
  let score = 0
  let maxScore = 0
  let needsReview = false

  for (const q of questions) {
    const grade = gradeQuestion(q, answers[q.id])
    grading[q.id] = grade
    score += grade.awarded
    maxScore += grade.max
    if (grade.needsReview) needsReview = true
  }

  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  return {
    grading,
    score,
    maxScore,
    percent,
    needsReview,
    outcome: needsReview ? "PENDING_REVIEW" : outcomeForPercent(percent, config.passingScore, config.conditionalScore),
  }
}

/** Re-grade after an admin has marked the pending answers by hand. */
export function applyManualMarks(
  questions: AssessmentQuestion[],
  base: GradingResult,
  marks: Record<string, { awarded: number; note?: string }>,
  config: { passingScore: number; conditionalScore: number }
): GradingResult {
  const grading: Record<string, AnswerGrade> = { ...base.grading }
  for (const q of questions) {
    const mark = marks[q.id]
    if (!mark) continue
    const awarded = Math.max(0, Math.min(q.points, Number(mark.awarded) || 0))
    grading[q.id] = {
      awarded,
      max: q.points,
      correct: awarded >= q.points,
      needsReview: false,
      source: "MANUAL",
      ...(mark.note ? { note: mark.note } : {}),
    }
  }

  const stillPending = questions.some((q) => grading[q.id]?.needsReview)
  let score = 0
  let maxScore = 0
  for (const q of questions) {
    score += grading[q.id]?.awarded ?? 0
    maxScore += grading[q.id]?.max ?? q.points
  }
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  return {
    grading,
    score,
    maxScore,
    percent,
    needsReview: stillPending,
    outcome: stillPending ? "PENDING_REVIEW" : outcomeForPercent(percent, config.passingScore, config.conditionalScore),
  }
}

/* ───────────────────────────  Deterministic shuffling  ─────────────────────────── */

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Same attempt number always yields the same paper — retries reload consistently. */
export function buildPaper(
  questions: AssessmentQuestion[],
  template: AssessmentTemplate,
  seed: string
): AssessmentQuestion[] {
  const rng = mulberry32(hashSeed(seed))
  let paper = questions.slice().sort((a, b) => a.sortOrder - b.sortOrder)

  if (template.questionSampleCount && template.questionSampleCount > 0 && template.questionSampleCount < paper.length) {
    paper = paper
      .map((q) => ({ q, k: rng() }))
      .sort((a, b) => a.k - b.k)
      .slice(0, template.questionSampleCount)
      .map((x) => x.q)
  }
  if (template.shuffleQuestions) {
    paper = paper.map((q) => ({ q, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.q)
  }
  if (template.shuffleOptions) {
    paper = paper.map((q) => ({ ...q, options: q.options.map((o) => ({ o, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.o) }))
  }
  return paper
}

/* ───────────────────────────  Tiers  ─────────────────────────── */

export async function listAssessmentTiers(opts?: { activeOnly?: boolean }): Promise<AssessmentTier[]> {
  if (!isSupabaseConfigured()) return []
  let query = supabase.from("partner_assessment_tiers").select("*").order("level", { ascending: true })
  if (opts?.activeOnly) query = query.eq("active", true)
  const { data, error } = await query
  return error ? [] : (data || []).map(mapTier)
}

export async function upsertTier(input: {
  id?: string
  code: string
  name: string
  description?: string
  level?: number
  audience?: AssessmentAudience
  requiredForApproval?: boolean
  active?: boolean
}): Promise<{ ok: boolean; tier?: AssessmentTier; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_")
  if (!code) return { ok: false, error: "Tier code is required" }
  if (!input.name.trim()) return { ok: false, error: "Tier name is required" }
  const now = new Date().toISOString()
  const row = {
    code,
    name: input.name.trim(),
    description: (input.description || "").trim(),
    level: Math.max(1, Math.round(Number(input.level) || 1)),
    audience: input.audience || "APPLICANT",
    required_for_approval: input.requiredForApproval ?? true,
    active: input.active ?? true,
    updated_at: now,
  }
  const { data, error } = input.id
    ? await supabase.from("partner_assessment_tiers").update(row).eq("id", input.id).select().maybeSingle()
    : await supabase.from("partner_assessment_tiers").insert(row).select().maybeSingle()
  if (error) {
    if (error.code === "23505") return { ok: false, error: `A tier with code ${code} already exists` }
    return { ok: false, error: error.message }
  }
  if (!data) return { ok: false, error: "Tier not found" }
  return { ok: true, tier: mapTier(data) }
}

export async function deleteTier(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: used } = await supabase
    .from("partner_assessment_templates").select("id").eq("tier_id", id).limit(1)
  if ((used || []).length > 0) {
    return { ok: false, error: "Move or delete this tier's templates first. Deactivating the tier hides it without deleting work." }
  }
  const { error } = await supabase.from("partner_assessment_tiers").delete().eq("id", id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/* ───────────────────────────  Templates  ─────────────────────────── */

export async function listTemplates(filter?: {
  tierId?: string
  status?: AssessmentTemplate["status"]
}): Promise<{ templates: AssessmentTemplate[]; questionCount: Record<string, number> }> {
  if (!isSupabaseConfigured()) return { templates: [], questionCount: {} }
  let query = supabase.from("partner_assessment_templates").select(TEMPLATE_SELECT).order("created_at", { ascending: true })
  if (filter?.tierId) query = query.eq("tier_id", filter.tierId)
  if (filter?.status) query = query.eq("status", filter.status)
  const { data, error } = await query
  if (error) return { templates: [], questionCount: {} }
  const templates = (data || []).map(mapTemplate)
  const counts: Record<string, number> = {}
  if (templates.length > 0) {
    const { data: qs } = await supabase
      .from("partner_assessment_questions")
      .select("template_id")
      .in("template_id", templates.map((t) => t.id))
    for (const row of qs || []) {
      const id = row.template_id as string
      counts[id] = (counts[id] || 0) + 1
    }
  }
  return { templates, questionCount: counts }
}

export async function getTemplate(id: string): Promise<{ template: AssessmentTemplate | null; questions: AssessmentQuestion[] }> {
  if (!isSupabaseConfigured()) return { template: null, questions: [] }
  const [{ data: tpl }, { data: rows }] = await Promise.all([
    supabase.from("partner_assessment_templates").select(TEMPLATE_SELECT).eq("id", id).maybeSingle(),
    supabase.from("partner_assessment_questions").select(QUESTION_SELECT).eq("template_id", id).order("sort_order", { ascending: true }),
  ])
  return {
    template: tpl ? mapTemplate(tpl) : null,
    questions: (rows || []).map(mapQuestion),
  }
}

const TEMPLATE_DEFAULTS: AssessmentTemplate = {
  id: "",
  tierId: "",
  name: "",
  description: "",
  instructions: "",
  timeLimitMinutes: 20,
  passingScore: 70,
  conditionalScore: 50,
  maxAttempts: 3,
  shuffleQuestions: false,
  shuffleOptions: false,
  questionSampleCount: null,
  showResultImmediately: true,
  showCorrectAnswers: false,
  status: "DRAFT",
}

/** Server-side guard: a template that can never pass is a misconfiguration, not a policy. */
export function validateTemplate(input: Partial<AssessmentTemplate>): string | null {
  const merged = { ...TEMPLATE_DEFAULTS, ...input }
  if (!merged.tierId) return "Choose a tier for this template"
  if (!merged.name.trim()) return "Template name is required"
  if (merged.timeLimitMinutes < 1 || merged.timeLimitMinutes > 480) return "Time limit must be between 1 and 480 minutes"
  if (merged.passingScore < 0 || merged.passingScore > 100) return "Pass mark must be between 0 and 100"
  if (merged.conditionalScore < 0 || merged.conditionalScore > 100) return "Conditional mark must be between 0 and 100"
  if (merged.conditionalScore > merged.passingScore) return "The conditional mark cannot be higher than the pass mark"
  if (merged.maxAttempts < 1 || merged.maxAttempts > 20) return "Maximum attempts must be between 1 and 20"
  if (merged.questionSampleCount !== null && merged.questionSampleCount < 1) return "Question sample count must be at least 1"
  return null
}

export async function upsertTemplate(input: Partial<AssessmentTemplate> & { id?: string; createdBy?: string }): Promise<{ ok: boolean; template?: AssessmentTemplate; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const invalid = validateTemplate(input)
  if (invalid) return { ok: false, error: invalid }
  const merged = { ...TEMPLATE_DEFAULTS, ...input }
  const now = new Date().toISOString()
  const row = {
    tier_id: merged.tierId,
    name: merged.name.trim(),
    description: merged.description.trim(),
    instructions: merged.instructions,
    time_limit_minutes: Math.round(merged.timeLimitMinutes),
    passing_score: Math.round(merged.passingScore),
    conditional_score: Math.round(merged.conditionalScore),
    max_attempts: Math.round(merged.maxAttempts),
    shuffle_questions: merged.shuffleQuestions,
    shuffle_options: merged.shuffleOptions,
    question_sample_count: merged.questionSampleCount === null ? null : Math.round(merged.questionSampleCount),
    show_result_immediately: merged.showResultImmediately,
    show_correct_answers: merged.showCorrectAnswers,
    status: merged.status,
    updated_at: now,
  }
  const { data, error } = merged.id
    ? await supabase.from("partner_assessment_templates").update(row).eq("id", merged.id).select().maybeSingle()
    : await supabase.from("partner_assessment_templates").insert({ ...row, created_by: input.createdBy ?? null }).select().maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "Template not found" }
  return { ok: true, template: mapTemplate(data) }
}

export async function deleteTemplate(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data: used } = await supabase.from("partner_assessment_assignments").select("id").eq("template_id", id).limit(1)
  if ((used || []).length > 0) return { ok: false, error: "This template has already been assigned. Archive it instead of deleting." }
  const { error } = await supabase.from("partner_assessment_templates").delete().eq("id", id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/* ───────────────────────────  Questions  ─────────────────────────── */

export interface QuestionInput {
  id?: string
  prompt: string
  type: AssessmentQuestionType
  options: AssessmentOption[]
  correctKeys: string[]
  acceptedKeywords: string[]
  keywordMode: "ANY" | "ALL"
  points: number
  requiresReview: boolean
  explanation?: string | null
  helpText?: string
  required?: boolean
  sortOrder?: number
}

export function validateQuestion(q: QuestionInput): string | null {
  if (!q.prompt.trim()) return "Every question needs a prompt"
  if (!ASSESSMENT_QUESTION_TYPES.includes(q.type)) return `Unknown question type: ${q.type}`
  if (OBJECTIVE_TYPES.includes(q.type)) {
    if (q.options.length < 2) return `"${q.prompt.trim().slice(0, 40)}" needs at least two options`
    if (q.correctKeys.length === 0) return `"${q.prompt.trim().slice(0, 40)}" needs a correct answer selected`
    const keys = new Set(q.options.map((o) => o.key))
    if (!q.correctKeys.every((k) => keys.has(k))) return `"${q.prompt.trim().slice(0, 40)}" has a correct answer that is not one of its options`
  }
  if (q.points < 1 || q.points > 50) return "Points must be between 1 and 50"
  return null
}

/**
 * Replace-style save, matching lib/creator-assessment.ts: rows absent from the
 * payload are deleted, the rest are upserted. Keeps ordering simple for the UI.
 */
export async function saveTemplateQuestions(templateId: string, questions: QuestionInput[]): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  for (const q of questions) {
    const invalid = validateQuestion(q)
    if (invalid) return { ok: false, error: invalid }
  }
  const keepIds = questions.map((q) => q.id).filter(Boolean) as string[]
  let del = supabase.from("partner_assessment_questions").delete().eq("template_id", templateId)
  if (keepIds.length > 0) del = del.not("id", "in", `(${keepIds.join(",")})`)
  const { error: delError } = await del
  if (delError) return { ok: false, error: delError.message }

  const now = new Date().toISOString()
  const rows = questions.map((q, i) => ({
    ...(q.id ? { id: q.id } : {}),
    template_id: templateId,
    prompt: q.prompt.trim(),
    type: q.type,
    options: q.options,
    correct_keys: q.correctKeys,
    accepted_keywords: q.acceptedKeywords,
    keyword_mode: q.keywordMode,
    points: Math.round(q.points),
    requires_review: q.requiresReview || (TEXT_TYPES.includes(q.type) && q.acceptedKeywords.length === 0),
    explanation: q.explanation ?? null,
    help_text: q.helpText || "",
    required: q.required ?? true,
    sort_order: q.sortOrder ?? i,
    updated_at: now,
  }))
  if (rows.length > 0) {
    const { error } = await supabase.from("partner_assessment_questions").upsert(rows)
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function loadTemplateQuestions(templateId: string): Promise<AssessmentQuestion[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("partner_assessment_questions").select(QUESTION_SELECT)
    .eq("template_id", templateId).order("sort_order", { ascending: true })
  return (data || []).map(mapQuestion)
}

/* ───────────────────────────  Assignments  ─────────────────────────── */

export function buildAssessmentPublicUrl(token: string, origin?: string): string {
  const base = (origin || process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng").replace(/\/$/, "")
  return `${base}/partners/assessment/${token}`
}

export async function assignAssessment(input: {
  templateId: string
  applicationId?: string | null
  partnerId?: string | null
  audience: AssessmentAudience
  dueAt?: string | null
  actorId: string
  actorName: string
  origin?: string
}): Promise<{ ok: boolean; assignment?: AssessmentAssignment; url?: string; emailSent?: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  if (!input.applicationId && !input.partnerId) return { ok: false, error: "Choose an application or a partner" }

  const [{ template, questions }, tiers] = await Promise.all([
    getTemplate(input.templateId),
    listAssessmentTiers(),
  ])
  if (!template) return { ok: false, error: "Template not found" }
  if (template.status !== "ACTIVE") return { ok: false, error: `"${template.name}" is ${template.status.toLowerCase()}. Activate it before assigning.` }
  if (questions.length === 0) return { ok: false, error: `"${template.name}" has no questions yet.` }
  const tier = tiers.find((t) => t.id === template.tierId)
  if (!tier) return { ok: false, error: "Template's tier is missing" }

  let assigneeName = ""
  let assigneeEmail = ""
  if (input.applicationId) {
    const { data: app } = await supabase
      .from("partner_applications").select("full_name, business_name, email").eq("id", input.applicationId).maybeSingle()
    if (!app) return { ok: false, error: "Application not found" }
    assigneeName = (app.full_name as string) || ""
    assigneeEmail = (app.email as string) || ""
  } else if (input.partnerId) {
    const { data: partner } = await supabase
      .from("partners").select("business_name, display_name, public_email").eq("id", input.partnerId).maybeSingle()
    if (!partner) return { ok: false, error: "Partner not found" }
    assigneeName = (partner.display_name as string) || (partner.business_name as string) || ""
    const { data: owner } = await supabase
      .from("partner_users").select("full_name, email").eq("partner_id", input.partnerId).eq("role", "OWNER").maybeSingle()
    assigneeEmail = (owner?.email as string) || (partner.public_email as string) || ""
  }
  if (!assigneeEmail) return { ok: false, error: "No email address to send the assessment to" }

  const now = new Date().toISOString()
  const { data: row, error } = await supabase.from("partner_assessment_assignments").insert({
    template_id: template.id,
    template_snapshot: template,
    tier_snapshot: tier,
    audience: input.audience,
    application_id: input.applicationId ?? null,
    partner_id: input.partnerId ?? null,
    assignee_name: assigneeName,
    assignee_email: assigneeEmail,
    status: "PENDING",
    due_at: input.dueAt || null,
    assigned_by: input.actorId,
    assigned_by_name: input.actorName,
    assigned_at: now,
    created_at: now,
    updated_at: now,
  }).select(ASSIGNMENT_SELECT).single()
  if (error) return { ok: false, error: error.message }

  const assignment = mapAssignment(row)
  const url = buildAssessmentPublicUrl(assignment.token, input.origin)
  const emailSent = await sendAssessmentInviteEmail(assignment, url)
  return { ok: true, assignment, url, emailSent }
}

async function sendAssessmentInviteEmail(assignment: AssessmentAssignment, url: string): Promise<boolean> {
  const tierName = assignment.tier.name
  const name = assignment.assigneeName || "there"
  return sendEmail({
    to: assignment.assigneeEmail,
    subject: `MartPoint product knowledge assessment — ${tierName}`,
    text:
      `Hello ${name},\n\n` +
      `Please complete "${assignment.template.name}" (${tierName}).\n\n` +
      `It is timed at ${assignment.template.timeLimitMinutes} minutes. ` +
      `You need ${assignment.template.passingScore}% to pass, and ${assignment.template.conditionalScore}% or above for conditional consideration.\n\n` +
      `Start here: ${url}\n\n` +
      `You have ${assignment.template.maxAttempts} attempt(s). The clock starts when you begin, so read each question carefully before answering.\n\n` +
      `MartPoint Partner Team`,
    html:
      `<p>Hello ${escapeHtml(name)},</p>` +
      `<p>Please complete <strong>${escapeHtml(assignment.template.name)}</strong> (${escapeHtml(tierName)}).</p>` +
      `<p>It is timed at <strong>${assignment.template.timeLimitMinutes} minutes</strong>. ` +
      `You need <strong>${assignment.template.passingScore}%</strong> to pass, and <strong>${assignment.template.conditionalScore}%</strong> or above for conditional consideration.</p>` +
      `<p><a href="${url}">Start the assessment</a></p>` +
      `<p>You have ${assignment.template.maxAttempts} attempt(s). The clock starts when you begin.</p>` +
      `<p>MartPoint Partner Team</p>`,
    replyTo: REPLY_TO.partners,
  })
}

export async function listAssignments(filter: {
  applicationId?: string
  partnerId?: string
  audience?: AssessmentAudience
  status?: AssignmentStatus
  needsReview?: boolean
  limit?: number
}): Promise<AssessmentAssignment[]> {
  if (!isSupabaseConfigured()) return []
  let query = supabase.from("partner_assessment_assignments").select(ASSIGNMENT_SELECT).order("assigned_at", { ascending: false })
  if (filter.applicationId) query = query.eq("application_id", filter.applicationId)
  if (filter.partnerId) query = query.eq("partner_id", filter.partnerId)
  if (filter.audience) query = query.eq("audience", filter.audience)
  if (filter.status) query = query.eq("status", filter.status)
  if (filter.needsReview) query = query.in("status", ["SUBMITTED"])
  const { data, error } = await query.limit(filter.limit ?? 200)
  if (error) return []
  const rows = (data || []).map(mapAssignment)
  if (!filter.needsReview) return rows
  // Only keep those whose latest attempt still awaits a marker.
  const pending = await Promise.all(rows.map(async (a) => {
    const { count } = await supabase.from("partner_assessment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", a.id).eq("needs_review", true).not("submitted_at", "is", null)
    return (count ?? 0) > 0 ? a : null
  }))
  return pending.filter((a): a is AssessmentAssignment => a !== null)
}

export async function getAssignmentById(id: string): Promise<AssessmentAssignment | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.from("partner_assessment_assignments")
    .select(ASSIGNMENT_SELECT).eq("id", id).maybeSingle()
  return data ? mapAssignment(data) : null
}

export async function getAssignmentByToken(token: string): Promise<AssessmentAssignment | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.from("partner_assessment_assignments")
    .select(ASSIGNMENT_SELECT).eq("token", token).maybeSingle()
  return data ? mapAssignment(data) : null
}

export async function listAttempts(assignmentId: string): Promise<AssessmentAttempt[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase.from("partner_assessment_attempts")
    .select(ATTEMPT_SELECT).eq("assignment_id", assignmentId).order("attempt_no", { ascending: false })
  return (data || []).map(mapAttempt)
}

export async function getAttemptById(id: string): Promise<AssessmentAttempt | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.from("partner_assessment_attempts")
    .select(ATTEMPT_SELECT).eq("id", id).maybeSingle()
  return data ? mapAttempt(data) : null
}

export async function getOpenAttempt(assignmentId: string): Promise<AssessmentAttempt | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.from("partner_assessment_attempts")
    .select(ATTEMPT_SELECT).eq("assignment_id", assignmentId).is("submitted_at", null)
    .order("attempt_no", { ascending: false }).limit(1).maybeSingle()
  return data ? mapAttempt(data) : null
}

/* ───────────────────────────  Sitting the paper  ─────────────────────────── */

export interface PaperResult {
  ok: boolean
  error?: string
  assignment?: AssessmentAssignment
  attempt?: AssessmentAttempt
  questions?: AssessmentQuestion[]
  serverNow?: string
  deadlineAt?: string
  secondsLeft?: number
}

/**
 * Start (or resume) an attempt. The deadline is computed from the server clock
 * and stored, so a refreshed browser cannot buy extra time.
 */
export async function startAttempt(assignment: AssessmentAssignment): Promise<PaperResult> {
  if (assignment.status === "WAIVED") return { ok: false, error: "This assessment has been waived." }
  if (assignment.status === "CANCELLED") return { ok: false, error: "This assessment has been cancelled." }
  if (assignment.status === "GRADED" || assignment.status === "SUBMITTED") {
    const open = await getOpenAttempt(assignment.id)
    if (open) return buildPaperResult(assignment, open)
    return { ok: false, error: "This assessment has already been completed." }
  }
  if (assignment.expiresAt && new Date(assignment.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "This assessment link has expired. Contact the MartPoint Partner Team." }
  }
  if (assignment.attemptsUsed >= assignment.template.maxAttempts) {
    return { ok: false, error: `All ${assignment.template.maxAttempts} attempts have been used.` }
  }

  const now = Date.now()
  const attemptNo = assignment.attemptsUsed + 1
  const deadline = new Date(now + assignment.template.timeLimitMinutes * 60_000).toISOString()
  const { data, error } = await supabase.from("partner_assessment_attempts").insert({
    assignment_id: assignment.id,
    attempt_no: attemptNo,
    started_at: new Date(now).toISOString(),
    deadline_at: deadline,
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  }).select(ATTEMPT_SELECT).single()
  if (error) return { ok: false, error: "Could not start the assessment" }

  await supabase.from("partner_assessment_assignments").update({
    status: "IN_PROGRESS",
    attempts_used: attemptNo,
    updated_at: new Date(now).toISOString(),
  }).eq("id", assignment.id)

  return buildPaperResult(assignment, mapAttempt(data))
}

/** Questions without answers, ordered and sampled for this attempt. */
async function buildPaperResult(assignment: AssessmentAssignment, attempt: AssessmentAttempt): Promise<PaperResult> {
  const all = await loadTemplateQuestions(assignment.templateId)
  const paper = buildPaper(all, assignment.template, `${assignment.id}:${attempt.attemptNo}`)
  const secondsLeft = Math.max(0, Math.floor((new Date(attempt.deadlineAt).getTime() - Date.now()) / 1000))
  return {
    ok: true,
    assignment,
    attempt,
    questions: paper.map(stripSecrets),
    serverNow: new Date().toISOString(),
    deadlineAt: attempt.deadlineAt,
    secondsLeft,
  }
}

/**
 * Resume an in-progress attempt, or report why there is nothing to show.
 * Used by the page load so a refresh returns the same paper and the same
 * server-side deadline rather than restarting the clock.
 */
export async function getPaperForAssignment(assignment: AssessmentAssignment): Promise<PaperResult> {
  const open = await getOpenAttempt(assignment.id)
  if (!open) {
    if (assignment.status === "PENDING") {
      return { ok: false, error: "The assessment has not been started yet." }
    }
    if (assignment.status === "WAIVED") return { ok: false, error: "This assessment has been waived." }
    return { ok: false, error: "There is no assessment in progress." }
  }
  return buildPaperResult(assignment, open)
}

/** Remove anything that would leak the marking scheme. */
export function stripSecrets(q: AssessmentQuestion): AssessmentQuestion {
  return { ...q, correctKeys: [], acceptedKeywords: [], explanation: null }
}

export interface SubmitResult {
  ok: boolean
  error?: string
  attempt?: AssessmentAttempt
  percent?: number
  outcome?: AttemptOutcome
  needsReview?: boolean
}

export async function submitAttempt(
  assignment: AssessmentAssignment,
  answers: Record<string, string[] | string>
): Promise<SubmitResult> {
  const open = await getOpenAttempt(assignment.id)
  if (!open) return { ok: false, error: "No assessment is in progress. Start the assessment first." }
  if (assignment.status === "WAIVED" || assignment.status === "CANCELLED") {
    return { ok: false, error: "This assessment is no longer active." }
  }

  const questions = await loadTemplateQuestions(assignment.templateId)
  // A sampled paper is a subset of the template. Grade only what was on this
  // attempt; unattempted questions would otherwise score as blank.
  const paper = buildPaper(questions, assignment.template, `${assignment.id}:${open.attemptNo}`)
  const config = {
    passingScore: assignment.template.passingScore,
    conditionalScore: assignment.template.conditionalScore,
  }
  const result = gradeAttempt(paper, answers, config)

  const missing = paper
    .filter((q) => q.required && isEmptyAnswer(answers[q.id]))
    .map((q) => q.prompt)
  if (missing.length > 0) {
    return { ok: false, error: `Please answer: ${missing[0]}` }
  }

  const now = new Date()
  const late = now.getTime() > new Date(open.deadlineAt).getTime() + 15_000
  const gradedAt = late ? new Date(open.deadlineAt) : now
  const timeSpent = Math.max(0, Math.floor((gradedAt.getTime() - new Date(open.startedAt).getTime()) / 1000))

  const { error } = await supabase.from("partner_assessment_attempts").update({
    answers,
    grading: result.grading,
    score: result.score,
    max_score: result.maxScore,
    percent: result.percent,
    outcome: result.outcome,
    needs_review: result.needsReview,
    submitted_at: gradedAt.toISOString(),
    time_spent_seconds: timeSpent,
    updated_at: now.toISOString(),
  }).eq("id", open.id)
  if (error) return { ok: false, error: "Could not save your answers" }

  const nextStatus: AssignmentStatus = result.needsReview ? "SUBMITTED" : "GRADED"
  const finalOutcome: AssessmentOutcome | null =
    result.needsReview ? assignment.finalOutcome : (result.outcome as AssessmentOutcome)

  const best = Math.max(assignment.bestPercent ?? -1, result.percent)
  await supabase.from("partner_assessment_assignments").update({
    status: nextStatus,
    best_score: Math.max(Number(assignment.bestScore ?? 0), result.score),
    best_percent: best,
    final_outcome: mergeOutcome(assignment.finalOutcome, finalOutcome),
    completed_at: nextStatus === "GRADED" ? now.toISOString() : null,
    updated_at: now.toISOString(),
  }).eq("id", assignment.id)

  const attempt = await getAttemptById(open.id)
  return {
    ok: true,
    attempt: attempt ?? undefined,
    percent: result.percent,
    outcome: result.outcome,
    needsReview: result.needsReview,
  }
}

function isEmptyAnswer(answer: string[] | string | undefined): boolean {
  if (answer === undefined || answer === null) return true
  if (Array.isArray(answer)) return answer.filter(Boolean).length === 0
  return String(answer).trim() === ""
}

/** PASS outranks CONDITIONAL outranks FAIL — the best attempt wins. */
function mergeOutcome(
  current: AssessmentOutcome | null,
  incoming: AssessmentOutcome | null
): AssessmentOutcome | null {
  if (!incoming) return current
  if (!current) return incoming
  const rank: Record<AssessmentOutcome, number> = { PASS: 3, CONDITIONAL: 2, FAIL: 1 }
  return rank[incoming] >= rank[current] ? incoming : current
}

export async function finalizeAttemptAfterReview(
  attempt: AssessmentAttempt,
  assignment: AssessmentAssignment,
  result: GradingResult,
  actor: { id: string; name: string },
  notes?: string
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString()
  const { error } = await supabase.from("partner_assessment_attempts").update({
    grading: result.grading,
    score: result.score,
    max_score: result.maxScore,
    percent: result.percent,
    outcome: result.outcome,
    needs_review: result.needsReview,
    reviewed_by: actor.id,
    reviewed_by_name: actor.name,
    reviewed_at: now,
    review_notes: notes ?? null,
    updated_at: now,
  }).eq("id", attempt.id)
  if (error) return { ok: false, error: error.message }

  if (!result.needsReview) {
    const outcome = result.outcome as AssessmentOutcome
    const bestPercent = Math.max(assignment.bestPercent ?? -1, result.percent)
    await supabase.from("partner_assessment_assignments").update({
      status: "GRADED",
      best_percent: bestPercent,
      best_score: Math.max(Number(assignment.bestScore ?? 0), result.score),
      final_outcome: mergeOutcome(assignment.finalOutcome, outcome),
      completed_at: now,
      updated_at: now,
    }).eq("id", assignment.id)
  }
  return { ok: true }
}

export async function waiveAssignment(
  assignmentId: string,
  reason: string,
  actor: { id: string; name: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!reason.trim()) return { ok: false, error: "A waiver needs a reason" }
  const now = new Date().toISOString()
  const { error } = await supabase.from("partner_assessment_assignments").update({
    status: "WAIVED",
    waived_reason: reason.trim(),
    final_outcome: "PASS",
    completed_at: now,
    updated_at: now,
  }).eq("id", assignmentId)
  if (error) return { ok: false, error: error.message }
  await recordAssignmentHistory(assignmentId, "WAIVED", `${reason.trim()} (waived by ${actor.name})`)
  return { ok: true }
}

export async function cancelAssignment(assignmentId: string, actorName: string): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString()
  const { error } = await supabase.from("partner_assessment_assignments").update({
    status: "CANCELLED",
    updated_at: now,
  }).eq("id", assignmentId)
  if (error) return { ok: false, error: error.message }
  await recordAssignmentHistory(assignmentId, "CANCELLED", `Assessment cancelled by ${actorName}`)
  return { ok: true }
}

/** Mirror the outcome into the application/partner timeline, best-effort. */
async function recordAssignmentHistory(assignmentId: string, status: string, reason: string): Promise<void> {
  const { data: row } = await supabase.from("partner_assessment_assignments")
    .select("application_id, partner_id").eq("id", assignmentId).maybeSingle()
  if (!row?.application_id) return
  const { data: app } = await supabase.from("partner_applications").select("status").eq("id", row.application_id).maybeSingle()
  await supabase.from("partner_status_history").insert({
    application_id: row.application_id,
    previous_status: app?.status ?? null,
    new_status: app?.status ?? "SUBMITTED",
    reason,
    changed_by: null,
    changed_by_name: "Assessment",
    event_type: status === "WAIVED" ? "ASSESSMENT_WAIVED" : "ASSESSMENT_CANCELLED",
  })
}

export async function resendAssignmentEmail(
  assignment: AssessmentAssignment,
  origin?: string
): Promise<boolean> {
  const url = buildAssessmentPublicUrl(assignment.token, origin)
  return sendAssessmentInviteEmail(assignment, url)
}

/* ───────────────────────────  Approval gate  ─────────────────────────── */

export interface TierGateRow {
  tierId: string
  tierName: string
  level: number
  required: boolean
  status: "PASSED" | "CONDITIONAL" | "FAILED" | "PENDING_REVIEW" | "NOT_TAKEN" | "WAIVED"
  bestPercent: number | null
  assignmentId: string | null
  detail: string
}

export interface AssessmentGate {
  /** False when no active applicant tier exists — the feature is not in force. */
  enforced: boolean
  canApprove: boolean
  canApproveConditional: boolean
  rows: TierGateRow[]
  blocking: string[]
  summary: string
}

/**
 * Approval needs every required applicant tier cleared in the pass band;
 * conditional approval needs each required tier at least in the conditional
 * band. Optional tiers are reported but never block.
 */
export function buildGate(tiers: AssessmentTier[], assignments: AssessmentAssignment[], attempts: AssessmentAttempt[]): AssessmentGate {
  const applicable = tiers.filter((t) => t.active && (t.audience === "APPLICANT" || t.audience === "BOTH"))
  const rows: TierGateRow[] = applicable.map((tier) => {
    const forTier = assignments.filter((a) => a.tier.id === tier.id)
    const best = rankAssignments(forTier, attempts)
    return {
      tierId: tier.id,
      tierName: tier.name,
      level: tier.level,
      required: tier.requiredForApproval,
      status: best.status,
      bestPercent: best.bestPercent,
      assignmentId: best.assignmentId,
      detail: best.detail,
    }
  })

  const required = rows.filter((r) => r.required)
  const blockingApprove = required.filter((r) => r.status !== "PASSED" && r.status !== "WAIVED")
  const blockingConditional = required.filter(
    (r) => r.status !== "PASSED" && r.status !== "WAIVED" && r.status !== "CONDITIONAL"
  )

  const enforced = required.length > 0
  return {
    enforced,
    canApprove: !enforced || blockingApprove.length === 0,
    canApproveConditional: !enforced || blockingConditional.length === 0,
    rows,
    blocking: blockingApprove.map((r) =>
      r.status === "NOT_TAKEN" ? `${r.tierName} — not taken yet`
      : r.status === "PENDING_REVIEW" ? `${r.tierName} — awaiting your review`
      : r.status === "FAILED" ? `${r.tierName} — failed${r.bestPercent !== null ? ` (${r.bestPercent}%)` : ""}`
      : r.status === "CONDITIONAL" ? `${r.tierName} — conditional band (${r.bestPercent}%)`
      : `${r.tierName} — ${r.detail}`
    ),
    summary: !enforced
      ? "No required applicant tiers are active, so assessments do not gate approval."
      : blockingApprove.length === 0
        ? "All required tiers cleared — full approval allowed."
        : blockingConditional.length === 0
          ? "Required tiers cleared at the conditional band or above."
          : "Required tiers still outstanding.",
  }
}

type RankedTier = {
  status: TierGateRow["status"]
  bestPercent: number | null
  assignmentId: string | null
  detail: string
}

function rankAssignments(assignments: AssessmentAssignment[], attempts: AssessmentAttempt[]): RankedTier {
  if (assignments.length === 0) {
    return { status: "NOT_TAKEN", bestPercent: null, assignmentId: null, detail: "not assigned" }
  }
  const byRank: Record<AssessmentOutcome, number> = { PASS: 3, CONDITIONAL: 2, FAIL: 1 }
  let best: RankedTier | null = null
  let sawPendingReview = false
  let sawNotSubmitted = false

  for (const a of assignments) {
    if (a.status === "WAIVED") {
      return { status: "WAIVED", bestPercent: a.bestPercent, assignmentId: a.id, detail: a.waivedReason || "waived" }
    }
    if (a.status === "CANCELLED") continue
    if (a.finalOutcome) {
      const candidate: RankedTier = {
        status: a.finalOutcome === "PASS" ? "PASSED" : a.finalOutcome === "CONDITIONAL" ? "CONDITIONAL" : "FAILED",
        bestPercent: a.bestPercent,
        assignmentId: a.id,
        detail: `${a.bestPercent ?? 0}%`,
      }
      if (!best || byRank[a.finalOutcome] > (byRank[(best.status === "PASSED" ? "PASS" : best.status === "CONDITIONAL" ? "CONDITIONAL" : "FAIL") as AssessmentOutcome])) {
        best = candidate
      }
      continue
    }
    const latest = attempts.find((at) => at.assignmentId === a.id && at.submittedAt)
    if (latest?.needsReview) sawPendingReview = true
    else sawNotSubmitted = true
  }

  if (best) return best
  if (sawPendingReview) return { status: "PENDING_REVIEW", bestPercent: null, assignmentId: assignments[0].id, detail: "awaiting review" }
  if (sawNotSubmitted) return { status: "NOT_TAKEN", bestPercent: null, assignmentId: assignments[0].id, detail: "assigned, not completed" }
  return { status: "NOT_TAKEN", bestPercent: null, assignmentId: null, detail: "not completed" }
}

export async function evaluateApplicationAssessmentGate(applicationId: string): Promise<AssessmentGate> {
  const [tiers, assignments] = await Promise.all([
    listAssessmentTiers(),
    listAssignments({ applicationId }),
  ])
  const attempts = await Promise.all(assignments.map((a) => listAttempts(a.id)))
  return buildGate(tiers, assignments, attempts.flat())
}

/** Same evaluation for the partner-facing tiers. */
export async function evaluatePartnerAssessmentGate(partnerId: string): Promise<AssessmentGate> {
  const [tiers, assignments] = await Promise.all([
    listAssessmentTiers(),
    listAssignments({ partnerId }),
  ])
  const attempts = await Promise.all(assignments.map((a) => listAttempts(a.id)))
  return buildGate(tiers.filter((t) => t.audience !== "APPLICANT"), assignments, attempts.flat())
}

export const OUTCOME_LABELS: Record<AttemptOutcome, string> = {
  PASS: "Pass",
  CONDITIONAL: "Conditional",
  FAIL: "Fail",
  PENDING_REVIEW: "Awaiting review",
}

export const QUESTION_TYPE_LABELS: Record<AssessmentQuestionType, string> = {
  SINGLE: "Choose one",
  MULTI: "Choose all that apply",
  TRUE_FALSE: "True / false",
  DROPDOWN: "Dropdown",
  SHORT_TEXT: "Short answer",
  LONG_TEXT: "Long answer",
}
