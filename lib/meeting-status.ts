import { supabase, isSupabaseConfigured } from "@/lib/supabase"

type MeetingTable = "lead_meetings" | "partner_meetings"

export interface MeetingLifecycleResult {
  leadCompleted: string[]
  partnerCompleted: string[]
}

/**
 * Mark meetings as completed once their scheduled slot has ended.
 *
 * A meeting is only transitioned from SCHEDULED, so a manual COMPLETED,
 * NO_SHOW, or CANCELLED decision is never overwritten. The update is also
 * guarded by the same status to make repeated cron runs idempotent.
 */
export async function completeExpiredMeetings(now = new Date()): Promise<MeetingLifecycleResult> {
  const result: MeetingLifecycleResult = { leadCompleted: [], partnerCompleted: [] }
  if (!isSupabaseConfigured()) return result

  const iso = now.toISOString()
  for (const table of ["lead_meetings", "partner_meetings"] as MeetingTable[]) {
    const { data, error } = await supabase
      .from(table)
      .select("id, scheduled_at, duration_minutes")
      .eq("status", "SCHEDULED")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", iso)

    if (error) {
      console.error(`[meeting-lifecycle] ${table} query failed`, error)
      continue
    }

    for (const meeting of data || []) {
      const start = new Date(meeting.scheduled_at as string)
      const duration = Number(meeting.duration_minutes) || 0
      if (!Number.isFinite(start.getTime()) || start.getTime() + duration * 60_000 > now.getTime()) continue

      const { error: updateError } = await supabase
        .from(table)
        .update({ status: "COMPLETED", updated_at: iso })
        .eq("id", meeting.id)
        .eq("status", "SCHEDULED")

      if (!updateError) {
        if (table === "lead_meetings") result.leadCompleted.push(meeting.id as string)
        else result.partnerCompleted.push(meeting.id as string)
      }
    }
  }

  return result
}
