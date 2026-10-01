/* ───────────────────────────  Creator learning/kit analytics  ───────────────────────────
 * Lightweight event tracking for creator portal interactions. Fire-and-forget —
 * tracking failures must never break the user action that triggered them.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import type { CreatorActivityEvent } from "./creator-constants"

export async function trackCreatorEvent(
  creatorId: string,
  eventType: CreatorActivityEvent,
  entity?: { type?: string; id?: string | null },
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase.from("creator_activity_events").insert({
      creator_id: creatorId,
      event_type: eventType,
      entity_type: entity?.type ?? null,
      entity_id: entity?.id ?? null,
      metadata: metadata ?? {},
    })
  } catch (err) {
    console.error("[creator-analytics] event failed:", err)
  }
}

export interface LearningAnalytics {
  totalCreators: number
  started: number
  completed: number
  completionRate: number
  avgCompletionDays: number | null
  assessmentAttempts: number
  assessmentPasses: number
  assessmentPassRate: number
  incompleteLessons: { contentId: string; title: string; incomplete: number }[]
}

/** Admin-facing learning analytics summary. */
export async function getLearningAnalytics(): Promise<LearningAnalytics> {
  const empty: LearningAnalytics = {
    totalCreators: 0, started: 0, completed: 0, completionRate: 0,
    avgCompletionDays: null, assessmentAttempts: 0, assessmentPasses: 0,
    assessmentPassRate: 0, incompleteLessons: [],
  }
  if (!isSupabaseConfigured()) return empty

  const [{ count: totalCreators }, { data: onboardings }, { data: attempts }, { data: progress }, { data: required }] =
    await Promise.all([
      supabase.from("creators").select("id", { count: "exact", head: true }).neq("status", "REMOVED"),
      supabase.from("creator_onboarding").select("creator_id, status, started_at, completed_at"),
      supabase.from("creator_assessment_attempts").select("passed").not("submitted_at", "is", null),
      supabase.from("creator_learning_progress").select("content_id, status"),
      supabase
        .from("creator_learning_content")
        .select("id, title")
        .eq("status", "PUBLISHED")
        .eq("required", true),
    ])

  const ob = onboardings || []
  const started = ob.filter((o) => o.status !== "NOT_STARTED").length
  const completed = ob.filter((o) => o.status === "COMPLETED").length
  const durations = ob
    .filter((o) => o.completed_at && o.started_at)
    .map((o) => (new Date(o.completed_at as string).getTime() - new Date(o.started_at as string).getTime()) / 86400000)
  const avgCompletionDays =
    durations.length > 0 ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null

  const submitted = (attempts || [])
  const passes = submitted.filter((a) => a.passed).length

  const completedByContent = new Map<string, number>()
  for (const p of progress || []) {
    if (p.status === "COMPLETED") {
      completedByContent.set(p.content_id, (completedByContent.get(p.content_id) || 0) + 1)
    }
  }
  const incompleteLessons = (required || [])
    .map((r) => ({
      contentId: r.id as string,
      title: r.title as string,
      incomplete: Math.max(0, started - (completedByContent.get(r.id as string) || 0)),
    }))
    .sort((a, b) => b.incomplete - a.incomplete)
    .slice(0, 5)

  return {
    totalCreators: totalCreators || 0,
    started,
    completed,
    completionRate: started > 0 ? Math.round((completed / started) * 100) : 0,
    avgCompletionDays,
    assessmentAttempts: submitted.length,
    assessmentPasses: passes,
    assessmentPassRate: submitted.length > 0 ? Math.round((passes / submitted.length) * 100) : 0,
    incompleteLessons,
  }
}
