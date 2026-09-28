import { supabase, isSupabaseConfigured } from "./supabase"

/* ───────────────────────  AI notetaker configuration  ───────────────────────
 * Which vendor feeds POST /api/webhooks/meeting-notes, plus the shared secret
 * vendors must send (x-webhook-secret header or ?secret=). Lives in
 * settings.data.meetingNotes — editable in Admin → Settings → AI Meeting Notes.
 *
 *   "disabled" — webhook rejects everything; manual admin notes still work
 *   "fireflies"— Fireflies ping-only webhook → we fetch the transcript via their
 *                GraphQL API using apiKey
 *   "fathom"   — Fathom webhook includes summary/action items inline
 *   "generic"  — anything else (tl;dv via Zapier/Make, custom scripts) that
 *                posts summary/actionItems/transcript fields directly
 */
export type MeetingNotesProvider = "disabled" | "fireflies" | "fathom" | "generic"

export interface MeetingNotesSettings {
  provider: MeetingNotesProvider
  apiKey: string
  webhookSecret: string
}

export const DEFAULT_MEETING_NOTES: MeetingNotesSettings = {
  provider: "disabled",
  apiKey: "",
  webhookSecret: "",
}

const PROVIDERS: MeetingNotesProvider[] = ["disabled", "fireflies", "fathom", "generic"]

export function normalizeMeetingNotes(raw: unknown): MeetingNotesSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  return {
    provider: PROVIDERS.includes(r.provider as MeetingNotesProvider) ? (r.provider as MeetingNotesProvider) : "disabled",
    apiKey: typeof r.apiKey === "string" ? r.apiKey : "",
    webhookSecret: typeof r.webhookSecret === "string" ? r.webhookSecret : "",
  }
}

export async function getMeetingNotesSettings(): Promise<MeetingNotesSettings> {
  if (!isSupabaseConfigured()) return DEFAULT_MEETING_NOTES
  try {
    const { data } = await supabase.from("settings").select("data").eq("id", 1).single()
    return normalizeMeetingNotes((data?.data as Record<string, unknown> | undefined)?.meetingNotes)
  } catch {
    return DEFAULT_MEETING_NOTES
  }
}
