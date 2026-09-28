import { NextResponse } from "next/server"
import crypto from "crypto"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { isValidTimeZone } from "@/lib/scheduling"
import { getGoogleSettings, isGoogleConnected } from "@/lib/google-calendar"
import {
  MEETING_SELECT,
  mapMeeting,
  attachGoogleMeet,
  sendMeetingInviteEmail,
  getSchedulingSettings,
} from "@/lib/meeting-booking"

const postSchema = z.object({
  mode: z.enum(["invite", "direct"]).default("direct"),
  title: z.string().trim().max(200).optional(),
  durationMinutes: z.number().int().min(10).max(240).optional(),
  timezone: z.string().optional(),
  notes: z.string().max(5000).optional(),
  // invite
  proposedSlots: z.array(z.string()).max(20).optional(),
  expiresInDays: z.number().int().min(1).max(60).optional(),
  sendEmail: z.boolean().optional(),
  // direct
  scheduledAt: z.string().optional(),
  meetingLink: z.string().optional(),
  provider: z.string().optional(),
  createMeet: z.boolean().optional(),
})

/* ─── GET list meetings for a lead ─── */
export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  const { id } = await props.params

  if (!isSupabaseConfigured()) return NextResponse.json({ meetings: [] })

  const { data, error } = await supabase
    .from("lead_meetings")
    .select(MEETING_SELECT)
    .eq("lead_id", id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[Lead Meetings GET]", error)
    return NextResponse.json({ error: "Failed to load meetings" }, { status: 500 })
  }

  const g = await getGoogleSettings()
  return NextResponse.json({
    meetings: (data || []).map((row) => mapMeeting(row as Record<string, unknown>)),
    googleConnected: isGoogleConnected(g),
  })
}

/* ─── POST create an invite (lead picks a slot) or schedule directly ─── */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  const { id } = await props.params

  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const body = parsed.data

  const { data: lead } = await supabase.from("leads").select("id, email").eq("id", id).single()
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const scheduling = await getSchedulingSettings()
  const timezone = body.timezone && isValidTimeZone(body.timezone) ? body.timezone : scheduling.timezone
  const durationMinutes = body.durationMinutes ?? scheduling.slotMinutes
  const now = new Date().toISOString()

  const base = {
    lead_id: id,
    customer_token: crypto.randomUUID(),
    title: body.title || "MartPoint Demo",
    duration_minutes: durationMinutes,
    timezone,
    notes: body.notes || null,
    created_by: auth.session.userId,
    created_at: now,
    updated_at: now,
  }

  try {
    if (body.mode === "invite") {
      if (!lead.email) return NextResponse.json({ error: "Lead has no email address to invite" }, { status: 400 })

      const proposed = (body.proposedSlots || [])
        .map((s) => new Date(s))
        .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > Date.now())
        .map((d) => d.toISOString())
      const expiresAt = new Date(Date.now() + (body.expiresInDays ?? scheduling.maxDaysAhead) * 86_400_000).toISOString()

      const { data, error } = await supabase
        .from("lead_meetings")
        .insert({
          ...base,
          status: "PENDING",
          scheduled_at: null,
          proposed_slots: proposed.length ? proposed : null,
          expires_at: expiresAt,
        })
        .select(MEETING_SELECT)
        .single()

      if (error || !data) {
        console.error("[Lead Meetings POST invite]", error)
        return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 })
      }

      let meeting = mapMeeting(data as Record<string, unknown>)
      let emailSent = false
      if (body.sendEmail !== false) {
        emailSent = await sendMeetingInviteEmail(meeting)
        if (emailSent) {
          const { data: upd } = await supabase
            .from("lead_meetings")
            .update({ invite_sent_at: now })
            .eq("id", meeting.id)
            .select(MEETING_SELECT)
            .single()
          if (upd) meeting = mapMeeting(upd as Record<string, unknown>)
        }
      }

      return NextResponse.json({ success: true, meeting, emailSent })
    }

    // ── direct ──
    if (!body.scheduledAt) return NextResponse.json({ error: "Scheduled date/time is required" }, { status: 400 })
    const scheduledAt = new Date(body.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime())) return NextResponse.json({ error: "Invalid date/time" }, { status: 400 })

    const { data, error } = await supabase
      .from("lead_meetings")
      .insert({
        ...base,
        status: "SCHEDULED",
        scheduled_at: scheduledAt.toISOString(),
        meeting_link: body.meetingLink || null,
        provider: body.provider || null,
        selected_at: now,
      })
      .select(MEETING_SELECT)
      .single()

    if (error || !data) {
      console.error("[Lead Meetings POST direct]", error)
      return NextResponse.json({ error: "Failed to schedule meeting" }, { status: 500 })
    }

    let meeting = mapMeeting(data as Record<string, unknown>)
    let meetError: string | undefined

    if (body.createMeet && !body.meetingLink) {
      try {
        const meet = await attachGoogleMeet(meeting)
        if (meet) {
          const g = await getGoogleSettings()
          const { data: upd } = await supabase
            .from("lead_meetings")
            .update({
              meeting_link: meet.meetingLink,
              provider: "Google Meet",
              google_event_id: meet.eventId,
              google_calendar_id: g.calendarId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", meeting.id)
            .select(MEETING_SELECT)
            .single()
          if (upd) meeting = mapMeeting(upd as Record<string, unknown>)
        } else {
          meetError = "Google account is not connected — add the Meet link manually or connect Google in Settings."
        }
      } catch (err) {
        meetError = err instanceof Error ? err.message : "Failed to create Google Meet"
        console.error("[Lead Meetings POST] Meet:", meetError)
      }
    }

    return NextResponse.json({ success: true, meeting, meetError })
  } catch (err) {
    console.error("[Lead Meetings POST]", err)
    return NextResponse.json({ error: "Failed to schedule meeting" }, { status: 500 })
  }
}
