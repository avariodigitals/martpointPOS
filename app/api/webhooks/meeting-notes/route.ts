import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ───────────────────────  Meeting-notes webhook  ───────────────────────
 * Receives AI minutes / transcripts from a notetaker (Fireflies, tl;dv,
 * Fathom, a Zapier/Make bridge, or any tool that can POST JSON) and files
 * them onto the matching lead_meetings row so admins can read the summary,
 * action items and transcript per meeting.
 *
 * Auth: if MEETING_NOTES_WEBHOOK_SECRET is set, requests must send it via
 * the `x-webhook-secret` header or `?secret=` query param.
 *
 * Matching (any of):
 *   { "meetingId": "<lead_meetings.id>" }
 *   { "customerToken": "<lead_meetings.customer_token>" }
 *   { "meetingLink": "https://meet.google.com/abc-defg-hij" } — matched on the Meet code
 *
 * Content fields (all optional):
 *   summary: string, actionItems: string[] | newline-separated string,
 *   transcript: string, transcriptUrl: string, recordingUrl: string,
 *   provider: string (defaults to "webhook")
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

function normalize(payload: unknown): NormalizedNotes {
  const raw = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>
  // Unwrap provider envelopes like { data: {...} } / { meeting: {...} }
  const data = (raw.data && typeof raw.data === "object" ? raw.data : raw.meeting && typeof raw.meeting === "object" ? raw.meeting : raw) as Record<string, unknown>

  return {
    meetingId: pickStr(data, "meetingId", "meeting_id", "leadMeetingId", "id"),
    customerToken: pickStr(data, "customerToken", "customer_token", "token"),
    meetingLink: pickStr(data, "meetingLink", "meeting_link", "meetingUrl", "meeting_url", "joinUrl", "join_url", "hangoutLink"),
    summary: pickStr(data, "summary", "overview", "notes", "minutes") || null,
    actionItems: normalizeActionItems(data.actionItems ?? data.action_items),
    transcript: pickStr(data, "transcript", "transcriptText", "full_transcript") || null,
    transcriptUrl: pickStr(data, "transcriptUrl", "transcript_url") || null,
    recordingUrl: pickStr(data, "recordingUrl", "recording_url", "videoUrl", "video_url") || null,
    provider: pickStr(data, "provider", "source") || "webhook",
  }
}

function meetCode(link: string): string {
  const m = link.match(/meet\.google\.com\/([a-z-]+)/i)
  return m ? m[1] : ""
}

export async function POST(request: Request) {
  const secret = process.env.MEETING_NOTES_WEBHOOK_SECRET
  if (secret) {
    const provided = request.headers.get("x-webhook-secret") || new URL(request.url).searchParams.get("secret")
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true })
  }

  try {
    const notes = normalize(await request.json())

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
