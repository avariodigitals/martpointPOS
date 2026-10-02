/* ───────────────────────────  Creator learning + onboarding  ───────────────────────────
 * Learning Centre data access: content CRUD (admin), progress tracking,
 * onboarding recalculation and creator readiness. Content is fully CMS-driven —
 * nothing here hard-codes lessons, guides or assessments.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { trackCreatorEvent } from "./creator-analytics"
import { pushCreatorNotification } from "./creator-notifications"
import type { AssessmentQuestionType, ContentStatus, CreatorReadiness, LearningCategory, LearningType } from "./creator-constants"

export interface LearningContent {
  id: string
  title: string
  slug: string
  type: LearningType
  category: LearningCategory
  description: string | null
  body: string | null
  videoUrl: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
  externalUrl: string | null
  businessType: string | null
  businessTypes: string[]
  features: string[]
  required: boolean
  isOnboardingStep: boolean
  onboardingOrder: number | null
  sortOrder: number
  relatedLinks: { label: string; url: string }[]
  status: ContentStatus
  publishedAt: string | null
  assessmentConfig: { passingScore?: number; maxAttempts?: number; showIncorrect?: boolean }
  questionCount?: number
}

export interface LearningProgress {
  contentId: string
  status: "IN_PROGRESS" | "COMPLETED"
  progressPct: number
  score: number | null
  startedAt: string | null
  completedAt: string | null
}

export interface OnboardingState {
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"
  progressPct: number
  assessmentPassed: boolean
  assessmentScore: number | null
  startedAt: string | null
  completedAt: string | null
  readyAt: string | null
  readiness: CreatorReadiness
  requiredTotal: number
  requiredCompleted: number
  /** The next incomplete required step the creator should do. */
  nextStep: LearningContent | null
}

export function mapLearning(row: Record<string, unknown>): LearningContent {
  return {
    id: row.id as string,
    title: row.title as string,
    slug: row.slug as string,
    type: row.type as LearningType,
    category: row.category as LearningCategory,
    description: (row.description as string) ?? null,
    body: (row.body as string) ?? null,
    videoUrl: (row.video_url as string) ?? null,
    thumbnailUrl: (row.thumbnail_url as string) ?? null,
    durationSeconds: (row.duration_seconds as number) ?? null,
    externalUrl: (row.external_url as string) ?? null,
    businessType: (row.business_type as string) ?? null,
    businessTypes: (row.business_types as string[]) ?? [],
    features: (row.features as string[]) ?? [],
    required: !!row.required,
    isOnboardingStep: !!row.is_onboarding_step,
    onboardingOrder: (row.onboarding_order as number) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
    relatedLinks: (row.related_links as { label: string; url: string }[]) ?? [],
    status: row.status as ContentStatus,
    publishedAt: (row.published_at as string) ?? null,
    assessmentConfig: (row.assessment_config as LearningContent["assessmentConfig"]) ?? {},
  }
}

function mapProgress(row: Record<string, unknown>): LearningProgress {
  return {
    contentId: row.content_id as string,
    status: row.status as LearningProgress["status"],
    progressPct: Number(row.progress_pct) || 0,
    score: (row.score as number) ?? null,
    startedAt: (row.started_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
  }
}

const LEARNING_SELECT =
  "id, title, slug, type, category, description, body, video_url, thumbnail_url, " +
  "duration_seconds, external_url, business_type, business_types, features, " +
  "required, is_onboarding_step, onboarding_order, sort_order, related_links, " +
  "status, published_at, assessment_config"

/* ─── Reads ─── */

export async function listPublishedLearning(): Promise<LearningContent[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("creator_learning_content")
    .select(LEARNING_SELECT)
    .eq("status", "PUBLISHED")
    .order("is_onboarding_step", { ascending: false })
    .order("onboarding_order", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true })
  return (((data || []) as unknown as Record<string, unknown>[])).map(mapLearning)
}

export async function listAllLearning(): Promise<LearningContent[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("creator_learning_content")
    .select(LEARNING_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
  const items = (((data || []) as unknown as Record<string, unknown>[])).map(mapLearning)
  const { data: qs } = await supabase.from("creator_assessment_questions").select("content_id")
  const counts = new Map<string, number>()
  for (const q of qs || []) counts.set(q.content_id as string, (counts.get(q.content_id as string) ?? 0) + 1)
  for (const it of items) it.questionCount = counts.get(it.id) ?? 0
  return items
}

export async function getLearningBySlug(
  slug: string,
  opts: { includeUnpublished?: boolean } = {}
): Promise<LearningContent | null> {
  if (!isSupabaseConfigured()) return null
  let q = supabase.from("creator_learning_content").select(LEARNING_SELECT).eq("slug", slug)
  if (!opts.includeUnpublished) q = q.eq("status", "PUBLISHED")
  const { data } = await q.maybeSingle()
  return data ? mapLearning(data as unknown as Record<string, unknown>) : null
}

export async function getLearningById(id: string): Promise<LearningContent | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("creator_learning_content")
    .select(LEARNING_SELECT)
    .eq("id", id)
    .maybeSingle()
  return data ? mapLearning(data as unknown as Record<string, unknown>) : null
}

export async function getProgressMap(creatorId: string): Promise<Map<string, LearningProgress>> {
  const map = new Map<string, LearningProgress>()
  if (!isSupabaseConfigured()) return map
  const { data } = await supabase
    .from("creator_learning_progress")
    .select("content_id, status, progress_pct, score, started_at, completed_at")
    .eq("creator_id", creatorId)
  for (const row of data || []) map.set(row.content_id as string, mapProgress(row))
  return map
}

/* ─── Admin writes ─── */

export interface LearningInput {
  title: string
  slug: string
  type: LearningType
  category: LearningCategory
  description?: string | null
  body?: string | null
  videoUrl?: string | null
  thumbnailUrl?: string | null
  durationSeconds?: number | null
  externalUrl?: string | null
  businessType?: string | null
  businessTypes?: string[]
  features?: string[]
  required?: boolean
  isOnboardingStep?: boolean
  onboardingOrder?: number | null
  sortOrder?: number
  relatedLinks?: { label: string; url: string }[]
  status?: ContentStatus
  assessmentConfig?: LearningContent["assessmentConfig"]
}

export async function saveLearning(
  input: LearningInput,
  userId: string | null,
  id?: string
): Promise<{ id?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const row = {
    title: input.title.trim(),
    slug: input.slug.trim().toLowerCase(),
    type: input.type,
    category: input.category,
    description: input.description ?? null,
    body: input.body ?? null,
    video_url: input.videoUrl ?? null,
    thumbnail_url: input.thumbnailUrl ?? null,
    duration_seconds: input.durationSeconds ?? null,
    external_url: input.externalUrl ?? null,
    business_type: input.businessType ?? null,
    business_types: input.businessTypes ?? [],
    features: input.features ?? [],
    required: !!input.required,
    is_onboarding_step: !!input.isOnboardingStep,
    onboarding_order: input.onboardingOrder ?? null,
    sort_order: input.sortOrder ?? 0,
    related_links: input.relatedLinks ?? [],
    status: input.status ?? "DRAFT",
    published_at: input.status === "PUBLISHED" ? new Date().toISOString() : null,
    assessment_config: input.assessmentConfig ?? {},
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }
  const query = id
    ? supabase.from("creator_learning_content").update(row).eq("id", id)
    : supabase.from("creator_learning_content").insert({ ...row, created_by: userId })
  const { data, error } = await query.select("id").single()
  if (error) return { error: error.message.includes("duplicate") ? "Slug already in use" : error.message }
  return { id: data?.id as string }
}

export async function deleteLearning(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("creator_learning_content").delete().eq("id", id)
  return error ? { error: error.message } : {}
}

export async function reorderLearning(orderedIds: string[]): Promise<{ error?: string }> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("creator_learning_content")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
    if (error) return { error: error.message }
  }
  return {}
}

/* ─── Progress + onboarding ─── */

/** Required items = published content flagged as onboarding steps or required. */
async function listRequiredContent(): Promise<LearningContent[]> {
  const all = await listPublishedLearning()
  return all
    .filter((c) => c.required || c.isOnboardingStep)
    .sort((a, b) => (a.onboardingOrder ?? a.sortOrder) - (b.onboardingOrder ?? b.sortOrder))
}

export async function markLessonStarted(creatorId: string, contentId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  const { data: existing } = await supabase
    .from("creator_learning_progress")
    .select("id")
    .eq("creator_id", creatorId)
    .eq("content_id", contentId)
    .maybeSingle()
  if (existing) return
  await supabase.from("creator_learning_progress").insert({
    creator_id: creatorId,
    content_id: contentId,
    status: "IN_PROGRESS",
    progress_pct: 0,
  })
  void trackCreatorEvent(creatorId, "LEARNING_STARTED", { type: "learning_content", id: contentId })
}

/** Video progress: only counts as complete at >= 90% watched — not on open. */
export async function updateVideoProgress(
  creatorId: string,
  contentId: string,
  pct: number
): Promise<void> {
  if (!isSupabaseConfigured()) return
  const clamped = Math.min(100, Math.max(0, Math.round(pct)))
  const { data: existing } = await supabase
    .from("creator_learning_progress")
    .select("id, status, progress_pct")
    .eq("creator_id", creatorId)
    .eq("content_id", contentId)
    .maybeSingle()
  if (!existing) {
    await supabase.from("creator_learning_progress").insert({
      creator_id: creatorId, content_id: contentId, status: "IN_PROGRESS", progress_pct: clamped,
    })
    void trackCreatorEvent(creatorId, "LEARNING_STARTED", { type: "learning_content", id: contentId })
    return
  }
  if (existing.status === "COMPLETED" || clamped <= (existing.progress_pct as number)) return
  const completed = clamped >= 90
  await supabase.from("creator_learning_progress").update({
    progress_pct: clamped,
    ...(completed ? { status: "COMPLETED", completed_at: new Date().toISOString() } : {}),
  }).eq("id", existing.id)
  if (completed) {
    void trackCreatorEvent(creatorId, "VIDEO_COMPLETED", { type: "learning_content", id: contentId })
    void recalcOnboarding(creatorId)
  }
}

export async function markLessonCompleted(
  creatorId: string,
  contentId: string,
  opts: { score?: number } = {}
): Promise<void> {
  if (!isSupabaseConfigured()) return
  const now = new Date().toISOString()
  await supabase.from("creator_learning_progress").upsert(
    {
      creator_id: creatorId,
      content_id: contentId,
      status: "COMPLETED",
      progress_pct: 100,
      score: opts.score ?? null,
      completed_at: now,
    },
    { onConflict: "creator_id,content_id" }
  )
  void trackCreatorEvent(creatorId, "LESSON_COMPLETED", { type: "learning_content", id: contentId })
  await recalcOnboarding(creatorId)
}

/** Recompute the creator_onboarding row + readiness after any progress change. */
export async function recalcOnboarding(creatorId: string): Promise<OnboardingState> {
  const required = await listRequiredContent()
  const progress = await getProgressMap(creatorId)
  const assessments = required.filter((c) => c.type === "ASSESSMENT")
  const lessons = required.filter((c) => c.type !== "ASSESSMENT")

  const lessonsDone = lessons.filter((c) => progress.get(c.id)?.status === "COMPLETED").length
  const total = required.length
  const done = required.filter((c) => progress.get(c.id)?.status === "COMPLETED").length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const bestAssessment = assessments
    .map((a) => progress.get(a.id))
    .filter(Boolean)
    .sort((a, b) => (b!.score ?? 0) - (a!.score ?? 0))[0]
  const passing = assessments.length > 0
    ? assessments.every((a) => {
        const cfg = a.assessmentConfig
        const threshold = cfg?.passingScore ?? 70
        return (progress.get(a.id)?.score ?? -1) >= threshold
      })
    : true

  const lessonsAllDone = lessonsDone === lessons.length
  const completed = total > 0 && done === total
  const ready = completed && passing

  const status: OnboardingState["status"] =
    done === 0 ? "NOT_STARTED" : completed ? "COMPLETED" : "IN_PROGRESS"
  const readiness: CreatorReadiness =
    ready ? "READY" : done === 0 ? "NOT_STARTED"
    : lessonsAllDone && !passing ? "ASSESSMENT_REQUIRED" : "IN_PROGRESS"

  const { data: existing } = await supabase
    .from("creator_onboarding")
    .select("id, started_at, ready_at, assessment_passed")
    .eq("creator_id", creatorId)
    .maybeSingle()

  const now = new Date().toISOString()
  await supabase.from("creator_onboarding").upsert(
    {
      ...(existing?.id ? { id: existing.id } : {}),
      creator_id: creatorId,
      status,
      progress_pct: pct,
      assessment_passed: passing,
      assessment_score: bestAssessment?.score ?? null,
      started_at: existing?.started_at ?? (done > 0 ? now : null),
      completed_at: completed ? (existing?.ready_at ?? now) : null,
      ready_at: ready ? (existing?.ready_at ?? now) : null,
      updated_at: now,
    },
    { onConflict: "creator_id" }
  )

  if (ready && !existing?.ready_at) {
    void trackCreatorEvent(creatorId, "ONBOARDING_COMPLETED")
    void pushCreatorNotification({
      creatorId,
      type: "ONBOARDING_COMPLETED",
      title: "Onboarding complete — you're Creator Ready",
      body: "You've finished the required onboarding. You can now participate in Creator Challenges.",
      link: "/creator/challenges",
    })
  }

  const nextStep =
    required.find((c) => progress.get(c.id)?.status !== "COMPLETED") ?? null

  return {
    status,
    progressPct: pct,
    assessmentPassed: passing,
    assessmentScore: bestAssessment?.score ?? null,
    startedAt: existing?.started_at ?? null,
    completedAt: completed ? now : null,
    readyAt: ready ? now : null,
    readiness,
    requiredTotal: total,
    requiredCompleted: done,
    nextStep,
  }
}

export async function getOnboardingState(creatorId: string): Promise<OnboardingState> {
  if (!isSupabaseConfigured()) {
    return {
      status: "NOT_STARTED", progressPct: 0, assessmentPassed: false,
      assessmentScore: null, startedAt: null, completedAt: null, readyAt: null,
      readiness: "NOT_STARTED", requiredTotal: 0, requiredCompleted: 0, nextStep: null,
    }
  }
  const required = await listRequiredContent()
  const progress = await getProgressMap(creatorId)
  const { data: ob } = await supabase
    .from("creator_onboarding")
    .select("status, progress_pct, assessment_passed, assessment_score, started_at, completed_at, ready_at")
    .eq("creator_id", creatorId)
    .maybeSingle()

  const done = required.filter((c) => progress.get(c.id)?.status === "COMPLETED").length
  const pct = required.length > 0 ? Math.round((done / required.length) * 100) : 0
  const lessons = required.filter((c) => c.type !== "ASSESSMENT")
  const lessonsAllDone = lessons.every((c) => progress.get(c.id)?.status === "COMPLETED")
  const passing = ob?.assessment_passed ?? false
  const ready = !!ob?.ready_at || (required.length > 0 && done === required.length && passing)
  const readiness: CreatorReadiness = ready
    ? "READY"
    : done === 0 ? "NOT_STARTED"
    : lessonsAllDone && !passing ? "ASSESSMENT_REQUIRED" : "IN_PROGRESS"

  return {
    status: (ob?.status as OnboardingState["status"]) ?? "NOT_STARTED",
    progressPct: pct,
    assessmentPassed: passing,
    assessmentScore: (ob?.assessment_score as number) ?? null,
    startedAt: (ob?.started_at as string) ?? null,
    completedAt: (ob?.completed_at as string) ?? null,
    readyAt: (ob?.ready_at as string) ?? null,
    readiness,
    requiredTotal: required.length,
    requiredCompleted: done,
    nextStep: required.find((c) => progress.get(c.id)?.status !== "COMPLETED") ?? null,
  }
}

/** Admin: reset a creator's learning + assessment state. */
export async function resetCreatorLearning(creatorId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const { error } = await supabase
    .from("creator_learning_progress")
    .delete()
    .eq("creator_id", creatorId)
  if (error) return { error: error.message }
  await supabase.from("creator_assessment_attempts").delete().eq("creator_id", creatorId)
  await supabase.from("creator_onboarding").upsert(
    {
      creator_id: creatorId,
      status: "NOT_STARTED",
      progress_pct: 0,
      assessment_passed: false,
      assessment_score: null,
      started_at: null,
      completed_at: null,
      ready_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "creator_id" }
  )
  return {}
}

/* ─── Admin per-creator learning detail ─── */

export interface CreatorLearningDetail {
  onboarding: OnboardingState
  lessons: { content: LearningContent; progress: LearningProgress | null }[]
  attempts: {
    contentTitle: string
    attemptNo: number
    score: number | null
    passed: boolean | null
    submittedAt: string | null
  }[]
  resourceDownloads: number
}

export async function getCreatorLearningDetail(creatorId: string): Promise<CreatorLearningDetail> {
  const [onboarding, all, progressMap] = await Promise.all([
    getOnboardingState(creatorId),
    listPublishedLearning(),
    getProgressMap(creatorId),
  ])
  const { data: attempts } = isSupabaseConfigured()
    ? await supabase
        .from("creator_assessment_attempts")
        .select("content_id, attempt_no, score, passed, submitted_at, creator_learning_content(title)")
        .eq("creator_id", creatorId)
        .order("submitted_at", { ascending: false })
    : { data: [] }
  const { count: resourceDownloads } = isSupabaseConfigured()
    ? await supabase
        .from("creator_activity_events")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creatorId)
        .eq("event_type", "RESOURCE_DOWNLOADED")
    : { count: 0 }

  return {
    onboarding,
    lessons: all.map((content) => ({ content, progress: progressMap.get(content.id) ?? null })),
    attempts: (attempts || []).map((a) => ({
      contentTitle:
        ((a.creator_learning_content as unknown as { title: string } | null)?.title) || "Assessment",
      attemptNo: a.attempt_no as number,
      score: (a.score as number) ?? null,
      passed: (a.passed as boolean) ?? null,
      submittedAt: (a.submitted_at as string) ?? null,
    })),
    resourceDownloads: resourceDownloads || 0,
  }
}

export type { AssessmentQuestionType }
