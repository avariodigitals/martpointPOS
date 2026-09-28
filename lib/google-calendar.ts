/* ───────────────────  Google Calendar / Meet (server-only)  ───────────────────
 * One Google account is connected from Admin → Settings via OAuth. We keep the
 * refresh token in settings.data.google and mint short-lived access tokens on
 * demand. Meet links are created by inserting a Calendar event with
 * conferenceData; the lead is added as an attendee so Google sends its own
 * invite with the .ics.
 *
 * Client ID/secret come from settings.data.google (admin UI) or env
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Uses fetch only — no googleapis dep.
 */

import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
]

export interface GoogleSettings {
  clientId: string
  clientSecret: string
  refreshToken: string
  email: string
  connectedAt: string
  calendarId: string
}

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const CAL_BASE = "https://www.googleapis.com/calendar/v3"

let cached: GoogleSettings | null = null
let cachedAt = 0
const CACHE_TTL_MS = 10_000

let accessToken: { value: string; expiresAt: number } | null = null

function fromRaw(raw: Record<string, unknown>): GoogleSettings {
  return {
    clientId: String(raw.clientId || process.env.GOOGLE_CLIENT_ID || ""),
    clientSecret: String(raw.clientSecret || process.env.GOOGLE_CLIENT_SECRET || ""),
    refreshToken: String(raw.refreshToken || ""),
    email: String(raw.email || ""),
    connectedAt: String(raw.connectedAt || ""),
    calendarId: String(raw.calendarId || "primary"),
  }
}

export async function getGoogleSettings(): Promise<GoogleSettings> {
  const now = Date.now()
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached
  let raw: Record<string, unknown> = {}
  if (isSupabaseConfigured()) {
    const { data } = await supabase.from("settings").select("data").eq("id", 1).single()
    raw = ((data?.data as Record<string, unknown> | undefined)?.google as Record<string, unknown>) || {}
  }
  cached = fromRaw(raw)
  cachedAt = now
  return cached
}

export function clearGoogleSettingsCache() {
  cached = null
  cachedAt = 0
  accessToken = null
}

/** Shallow-merge a patch into settings.data.google. */
export async function saveGoogleSettings(patch: Partial<GoogleSettings>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { data } = await supabase.from("settings").select("data").eq("id", 1).single()
  const all = ((data?.data as Record<string, unknown> | undefined) || {}) as Record<string, unknown>
  const google = ((all.google as Record<string, unknown> | undefined) || {}) as Record<string, unknown>
  const next = { ...all, google: { ...google, ...patch } }
  const { error } = await supabase.from("settings").upsert({ id: 1, data: next, updated_at: new Date().toISOString() })
  if (error) {
    console.error("[google] failed to save settings:", error.message)
    return false
  }
  clearGoogleSettingsCache()
  return true
}

export function isGoogleConfigured(s: GoogleSettings): boolean {
  return Boolean(s.clientId && s.clientSecret)
}

export function isGoogleConnected(s: GoogleSettings): boolean {
  return isGoogleConfigured(s) && Boolean(s.refreshToken)
}

/* ─── OAuth ─── */

export function buildGoogleAuthUrl(s: GoogleSettings, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: s.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // force a refresh token every time we (re)connect
    include_granted_scopes: "true",
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

export async function exchangeGoogleCode(
  s: GoogleSettings,
  code: string,
  redirectUri: string,
): Promise<{ refreshToken: string; email: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: s.clientId,
      client_secret: s.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok || !json.access_token) {
    throw new Error(String(json.error_description || json.error || "Google token exchange failed"))
  }
  if (!json.refresh_token) {
    throw new Error("Google did not return a refresh token. Remove the app from your Google account permissions and connect again.")
  }

  const who = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${json.access_token}` },
  })
  const info = who.ok ? ((await who.json()) as Record<string, unknown>) : {}

  return { refreshToken: String(json.refresh_token), email: String(info.email || "") }
}

async function getAccessToken(s?: GoogleSettings): Promise<string> {
  const settings = s ?? (await getGoogleSettings())
  if (!isGoogleConnected(settings)) throw new Error("Google account not connected")
  if (accessToken && accessToken.expiresAt > Date.now() + 30_000) return accessToken.value

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      refresh_token: settings.refreshToken,
      grant_type: "refresh_token",
    }),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok || !json.access_token) {
    throw new Error(String(json.error_description || json.error || "Failed to refresh Google access token"))
  }
  accessToken = {
    value: String(json.access_token),
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  }
  return accessToken.value
}

async function calendarFetch<T>(path: string, init: RequestInit & { query?: Record<string, string> } = {}): Promise<T> {
  const settings = await getGoogleSettings()
  const token = await getAccessToken(settings)
  const url = new URL(`${CAL_BASE}${path}`)
  for (const [k, v] of Object.entries(init.query || {})) url.searchParams.set(k, v)
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })
  if (res.status === 204) return undefined as T
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const err = json.error as Record<string, unknown> | undefined
    throw new Error(String(err?.message || `Google Calendar request failed (${res.status})`))
  }
  return json as T
}

/* ─── Calendar operations ─── */

export interface CreateMeetEventInput {
  summary: string
  description?: string
  start: Date
  end: Date
  timezone: string
  attendeeEmail?: string
  attendeeName?: string
  /** When false, Google does not email the attendee its own (bare) invite —
   *  we send a branded confirmation with an .ics attachment instead. */
  sendUpdates?: boolean
}

export interface MeetEvent {
  eventId: string
  meetLink: string
  htmlLink: string
}

export async function createMeetEvent(input: CreateMeetEventInput): Promise<MeetEvent> {
  const settings = await getGoogleSettings()
  const body = {
    summary: input.summary,
    description: input.description || undefined,
    start: { dateTime: input.start.toISOString(), timeZone: input.timezone },
    end: { dateTime: input.end.toISOString(), timeZone: input.timezone },
    attendees: input.attendeeEmail
      ? [{ email: input.attendeeEmail, displayName: input.attendeeName || undefined }]
      : undefined,
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: { useDefault: true },
  }

  const ev = await calendarFetch<Record<string, unknown>>(
    `/calendars/${encodeURIComponent(settings.calendarId)}/events`,
    {
      method: "POST",
      body: JSON.stringify(body),
      query: {
        conferenceDataVersion: "1",
        sendUpdates: input.attendeeEmail && input.sendUpdates !== false ? "all" : "none",
      },
    },
  )

  const conference = ev.conferenceData as { entryPoints?: { entryPointType?: string; uri?: string }[] } | undefined
  const video = conference?.entryPoints?.find((e) => e.entryPointType === "video")?.uri
  const meetLink = String(ev.hangoutLink || video || "")
  if (!meetLink) throw new Error("Google did not return a Meet link for the event")

  return { eventId: String(ev.id), meetLink, htmlLink: String(ev.htmlLink || "") }
}

export async function deleteCalendarEvent(eventId: string, calendarId?: string): Promise<void> {
  const settings = await getGoogleSettings()
  const cal = calendarId || settings.calendarId
  try {
    await calendarFetch<void>(`/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      query: { sendUpdates: "all" },
    })
  } catch (err) {
    // Already gone is fine.
    if (!/not found|410|deleted/i.test(err instanceof Error ? err.message : String(err))) throw err
  }
}

export async function getBusyIntervals(from: Date, to: Date): Promise<{ start: string; end: string }[]> {
  const settings = await getGoogleSettings()
  const json = await calendarFetch<{ calendars?: Record<string, { busy?: { start: string; end: string }[] }> }>(
    "/freeBusy",
    {
      method: "POST",
      body: JSON.stringify({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        items: [{ id: settings.calendarId }],
      }),
    },
  )
  return json.calendars?.[settings.calendarId]?.busy || Object.values(json.calendars || {})[0]?.busy || []
}
