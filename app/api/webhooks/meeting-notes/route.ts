import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getMeetingNotesSettings } from "@/lib/meeting-notes"

/* ───────────────────────  Meeting-notes webhook  ───────────────────────
 * Receives AI minutes / transcripts from the notetaker configured in
 * Admin → Settings → AI Meeting Notes and files them onto the matching
 * lead_meetings row.
 *
 * Auth: requests must send the shared secret via the `x-webhook-secret`
 * header or `?secret=` query param. The secret is either the
 * MEETING_NOTES_WEBHOOK_SECRET env var or the one generated in settings —
 * either matches. If neither exists, all requests are rejected.
 *
 * Matching (any of):
 *   { "meetingId": "<lead_meetings.id>" }
 *   { "customerToken": "<lead_meetings.customer_token>" }
 *   { "meetingLink": "https://meet.google.com/abc-defg-hij" } — matched on the Meet code
 *
 * Providers:
 *   fireflies — ping-only webhook { meetingId, eventType }; we fetch the
 *               transcript via their GraphQL API using the stored API key
 *   fathom    — payload carries summary/action_items/transcript inline
 *   generic   — tl;dv via Zapier/Make or any tool posting the fields below
 *
 * Generic content fields (all optional):
 *   summary: string, actionItems: string[] | newline-separated string,
 *   transcript: string, transcriptUrl: string, recordingUrl: string
 */

interface NormalizedNotes {
  meetingId: string
  customerToken: string
  meetingLink: string
  summary: string | null
  actionItems: string[] | null
  transcript: string | null
  transcriptUrl: string | null
  recordingUrl: string | null
  provider: string
}

function pickStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return ""
}

function normalizeActionItems(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    const items = raw.map((i) => String(i).trim()).filter(Boolean)
    return items.length ? items : null
  }
  if (typeof raw === "string" && raw.trim()) {
    const items = raw.split(/\r?\n/).map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean)
    return items.length ? items : null
  }
  return null
}

function normalizeTranscript(raw: unknown): string {
  if (typeof raw === "string") return raw.trim()
  // Speaker-labelled segments (Fathom: [{ speaker, text, timestamp }])
  if (Array.isArray(raw)) {
    return raw
      .map((seg) => {
        const s = seg as Record<string, unknown>
        const who = pickStr(s, "speaker", "speaker_name", "name")
        const text = pickStr(s, "text", "content")
        return text ? (who ? `${who}: ${text}` : text) : ""
      })
      .filter(Boolean)
      .join("\n")
  }
  return ""
}

/** Generic normalization — also covers Fathom's inline field names. */
function normalize(payload: unknown, provider: string): NormalizedNotes {
  const raw = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>
  // Unwrap provider envelopes like { data: {...} } / { meeting: {...} }
  const data = (raw.data && typeof raw.data === "object" ? raw.data : raw.meeting && typeof raw.meeting === "object" ? raw.meeting : raw) as Record<string, unknown>

  // Fathom nests the summary under default_summary.markdown_formatted
  const defaultSummary = (data.default_summary && typeof data.default_summary === "object" ? data.default_summary : {}) as Record<string, unknown>

  return {
    meetingId: pickStr(data, "meetingId", "meeting_id", "leadMeetingId", "id"),
    customerToken: pickStr(data, "customerToken", "customer_token", "clientReferenceId", "token"),
    meetingLink: pickStr(data, "meetingLink", "meeting_link", "meetingUrl", "meeting_url", "meeting_join_url", "joinUrl", "join_url", "hangoutLink", "url"),
    summary: pickStr(data, "summary", "overview", "notes", "minutes") || pickStr(defaultSummary, "markdown_formatted", "summary") || null,
    actionItems: normalizeActionItems(data.actionItems ?? data.action_items),
    transcript: normalizeTranscript(data.transcript ?? data.transcriptText ?? data.full_transcript) || null,
    transcriptUrl: pickStr(data, "transcriptUrl", "transcript_url") || null,
    recordingUrl: pickStr(data, "recordingUrl", "recording_url", "share_url", "public_share_url", "videoUrl", "video_url") || null,
    provider,
  }
}

/* Fireflies' webhook only sends { meetingId, eventType } — pull the actual
 * transcript + summary from their GraphQL API. */
async function fetchFireflies(meetingId: string, apiKey: string): Promise<Partial<NormalizedNotes>> {
  const res = await fetch("https://api.fireflies.ai/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query: `query T($id: String!) {
        transcript(id: $id) {
          title meeting_link transcript_url audio_url video_url
          summary { overview action_items shorthand_bullet }
          sentences { speaker_name text }
        }
      }`,
      variables: { id: meetingId },
    }),
  })
  if (!res.ok) throw new Error(`Fireflies API ${res.status}`)
  const json = (await res.json()) as { data?: { transcript?: Record<string, unknown> }; errors?: unknown[] }
  const t = json.data?.transcript
  if (!t) return {}
  const summary = (t.summary && typeof t.summary === "object" ? t.summary : {}) as Record<string, unknown>
  return {
    meetingLink: pickStr(t, "meeting_link"),
    summary: pickStr(summary, "overview") || null,
    actionItems: normalizeActionItems(summary.action_items) ?? normalizeActionItems(summary.shorthand_bullet),
    transcript: normalizeTranscript(t.sentences) || null,
    transcriptUrl: pickStr(t, "transcript_url") || null,
    recordingUrl: pickStr(t, "video_url") || pickStr(t, "audio_url") || null,
  }
}

function meetCode(link: string): string {
  const m = link.match(/meet\.google\.com\/([a-z-]+)/i)
  return m ? m[1] : ""
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true })
  }

  const cfg = await getMeetingNotesSettings()

  const provided = request.headers.get("x-webhook-secret") || new URL(request.url).searchParams.get("secret")
  const valid = [process.env.MEETING_NOTES_WEBHOOK_SECRET, cfg.webhookSecret].filter(Boolean)
  if (!valid.length || !provided || !valid.includes(provided)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (cfg.provider === "disabled") {
    return NextResponse.json({ ok: false, error: "Notetaker integration is disabled in settings" }, { status: 403 })
  }

  try {
    const payload = await request.json()
    const notes = normalize(payload, cfg.provider)

    // Ping-only vendor: fetch the content server-side.
    if (cfg.provider === "fireflies" && cfg.apiKey) {
      const vendorId = notes.meetingId || pickStr(payload as Record<string, unknown>, "meetingId", "meeting_id")
      if (vendorId) {
        const fetched = await fetchFireflies(vendorId, cfg.apiKey)
        Object.assign(notes, Object.fromEntries(Object.entries(fetched).filter(([, v]) => v != null && v !== "")))
        notes.meetingId = "" // vendor id is not our lead_meetings id
      }
    }

    // ── Find the meeting row ──
    let row: { id: string } | null = null
    if (notes.meetingId) {
      const { data } = await supabase.from("lead_meetings").select("id").eq("id", notes.meetingId).maybeSingle()
      row = data
    }
    if (!row && notes.customerToken) {
      const { data } = await supabase.from("lead_meetings").select("id").eq("customer_token", notes.customerToken).maybeSingle()
      row = data
    }
    if (!row && notes.meetingLink) {
      const code = meetCode(notes.meetingLink)
      if (code) {
        const { data } = await supabase
          .from("lead_meetings")
          .select("id")
          .ilike("meeting_link", `%${code}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        row = data
      }
    }

    if (!row) {
      return NextResponse.json({ ok: false, error: "No matching meeting" }, { status: 404 })
    }

    const now = new Date().toISOString()
    const { error } = await supabase
      .from("lead_meetings")
      .update({
        summary: notes.summary,
        action_items: notes.actionItems,
        transcript: notes.transcript,
        transcript_url: notes.transcriptUrl,
        recording_url: notes.recordingUrl,
        notes_provider: notes.provider,
        notes_received_at: now,
        updated_at: now,
      })
      .eq("id", row.id)

    if (error) {
      console.error("[meeting-notes] update failed:", error.message)
      return NextResponse.json({ ok: false, error: "Failed to save notes" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, meetingId: row.id })
  } catch (err) {
    console.error("[meeting-notes] webhook error:", err)
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
  }
}
