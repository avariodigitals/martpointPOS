import { NextResponse } from "next/server"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { isValidTimeZone } from "@/lib/scheduling"
import { MEETING_SELECT, mapMeeting, computeAvailableSlots, confirmMeetingSlot, type MeetingRecord } from "@/lib/meeting-booking"

interface PublicMeeting {
  title: string
  scheduledAt: string | null
  durationMinutes: number
  timezone: string
  meetingLink: string | null
  provider: string | null
  status: MeetingRecord["status"]
  leadFullName: string
  leadBusinessName: string
  leadPhone: string
  leadTimezone: string | null
  expiresAt: string | null
  hasProposedSlots: boolean
}

function toPublic(m: MeetingRecord): PublicMeeting {
  return {
    title: m.title,
    scheduledAt: m.scheduledAt,
    durationMinutes: m.durationMinutes,
    timezone: m.timezone,
    meetingLink: m.meetingLink,
    provider: m.provider,
    status: m.status,
    leadFullName: m.leadFullName || "",
    leadBusinessName: m.leadBusinessName || "",
    leadPhone: m.leadPhone || "",
    leadTimezone: m.leadTimezone,
    expiresAt: m.expiresAt,
    hasProposedSlots: Boolean(m.proposedSlots?.length),
  }
}

async function loadByToken(token: string): Promise<MeetingRecord | null> {
  const { data } = await supabase.from("lead_meetings").select(MEETING_SELECT).eq("customer_token", token).single()
  return data ? mapMeeting(data as Record<string, unknown>) : null
}

/* ─── GET public meeting by customer token (+ open slots when pending) ─── */
export async function GET(_: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const meeting = await loadByToken(token)
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 })

  const expired = meeting.status === "PENDING" && meeting.expiresAt ? new Date(meeting.expiresAt) < new Date() : false
  const availableSlots = meeting.status === "PENDING" && !expired ? await computeAvailableSlots(meeting) : []

  return NextResponse.json({ meeting: toPublic(meeting), availableSlots, expired })
}

const bookSchema = z.object({
  slot: z.string().min(1),
  timezone: z.string().optional(),
})

/* ─── POST lead confirms a slot ─── */
export async function POST(request: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const parsed = bookSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Please choose a time slot." }, { status: 400 })

  const meeting = await loadByToken(token)
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 })

  const tz = parsed.data.timezone && isValidTimeZone(parsed.data.timezone) ? parsed.data.timezone : null
  const result = await confirmMeetingSlot(meeting, parsed.data.slot, tz)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ success: true, meeting: toPublic(result.meeting), meetPending: Boolean(result.meetError) })
}
