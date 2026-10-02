import { NextResponse } from "next/server"
import crypto from "crypto"
import { z } from "zod"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { isValidTimeZone } from "@/lib/scheduling"
import {
  MEETING_SELECT,
  mapMeeting,
  confirmMeetingSlot,
  getSchedulingSettings,
  meetingPageUrl,
} from "@/lib/meeting-booking"
import {
  readCreatorRef,
  resolveCreatorRef,
  recordCreatorReferral,
} from "@/lib/creator-attribution"
import { resolveSubmissionToken } from "@/lib/creator-challenges"

const bookSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  businessName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(7).max(40),
  businessType: z.string().trim().min(1).max(120),
  slot: z.string().min(1),
  timezone: z.string().max(64).optional(),
  productInterest: z.string().trim().max(60).optional(),
  message: z.string().max(4000).optional(),
  partnerCode: z.string().max(32).optional(),
  captchaToken: z.string().optional(),
})

/* ─── POST self-service demo booking: create lead + scheduled meeting ─── */
export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "demo-booking", max: 5, windowSeconds: 3600 })
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 })
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Booking is temporarily unavailable" }, { status: 503 })
  }

  const parsed = bookSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const body = parsed.data

  const turnstile = await verifyCaptchaToken(body.captchaToken, request)
  if (!turnstile.success) {
    return NextResponse.json({ error: turnstile.error }, { status: 403 })
  }

  const slot = new Date(body.slot)
  if (Number.isNaN(slot.getTime())) {
    return NextResponse.json({ error: "Invalid time slot." }, { status: 400 })
  }

  const settings = await getSchedulingSettings()
  const leadTimezone = body.timezone && isValidTimeZone(body.timezone) ? body.timezone : null
  const now = new Date().toISOString()

  const referringPartnerCode =
    typeof body.partnerCode === "string" && /^MP-[A-Z]{2,3}-\d{1,6}$/i.test(body.partnerCode.trim())
      ? body.partnerCode.trim().toUpperCase()
      : null

  // Creator attribution via the ?ref= cookie.
  const ref = await readCreatorRef()
  const creator = ref ? await resolveCreatorRef(ref.code) : null
  const subRef = ref?.submissionToken ? await resolveSubmissionToken(ref.submissionToken) : null
  const validSubRef = subRef && subRef.creatorId === creator?.id ? subRef : null

  // 1. Create the lead (graceful — a duplicate submission still gets a meeting)
  const leadId = crypto.randomUUID()
  const { error: leadError } = await supabase.from("leads").insert({
    id: leadId,
    full_name: body.fullName,
    business_name: body.businessName,
    email: body.email,
    phone: body.phone,
    business_type: body.businessType,
    product_interest: body.productInterest || "not-sure",
    branches: "1",
    staff_size: "1-5",
    challenge: "",
    message: body.message || "",
    source: "demo-booking",
    referring_partner_code: referringPartnerCode,
    referring_creator_code: creator?.referralCode ?? null,
    creator_id: creator?.id ?? null,
    creator_challenge_id: validSubRef?.challengeId ?? null,
    creator_submission_id: validSubRef?.submissionId ?? null,
    utm_source: ref?.utmSource ?? null,
    utm_medium: ref?.utmMedium ?? null,
    utm_campaign: ref?.utmCampaign ?? null,
    utm_content: ref?.utmContent ?? null,
    status: "New",
    submitted_at: now,
    updated_at: now,
  })
  if (leadError) {
    console.error("[demo-booking] lead insert failed:", leadError)
    return NextResponse.json({ error: "Could not complete the booking. Please try again." }, { status: 500 })
  }

  // Creator funnel events — the lead is both a LEAD and a booked DEMO.
  if (creator) {
    const utm = { source: ref?.utmSource, medium: ref?.utmMedium, campaign: ref?.utmCampaign, content: ref?.utmContent }
    const subIds = { challengeId: validSubRef?.challengeId ?? null, submissionId: validSubRef?.submissionId ?? null }
    void recordCreatorReferral({ creatorId: creator.id, referralCode: creator.referralCode, eventType: "LEAD", leadId, utm, ...subIds, dedupeKey: `LEAD:${leadId}` })
    void recordCreatorReferral({ creatorId: creator.id, referralCode: creator.referralCode, eventType: "DEMO", leadId, utm, ...subIds, dedupeKey: `DEMO:${leadId}` })
  }

  // 2. Create the meeting row as PENDING, then let confirmMeetingSlot do the
  //    slot re-validation, Google Meet event and confirmation emails.
  const { data: row, error: meetingError } = await supabase
    .from("lead_meetings")
    .insert({
      lead_id: leadId,
      customer_token: crypto.randomUUID(),
      title: "MartPoint Demo",
      duration_minutes: settings.slotMinutes,
      timezone: settings.timezone,
      status: "PENDING",
      scheduled_at: null,
      proposed_slots: null,
      expires_at: new Date(Date.now() + settings.maxDaysAhead * 86_400_000).toISOString(),
      notes: body.message ? `Self-booked demo: ${body.message}` : "Self-booked demo via /book-demo",
      created_at: now,
      updated_at: now,
    })
    .select(MEETING_SELECT)
    .single()

  if (meetingError || !row) {
    console.error("[demo-booking] meeting insert failed:", meetingError)
    return NextResponse.json({ error: "Could not complete the booking. Please try again." }, { status: 500 })
  }

  const meeting = mapMeeting(row as Record<string, unknown>)
  const result = await confirmMeetingSlot(meeting, slot.toISOString(), leadTimezone)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, retryWith: meetingPageUrl(meeting.customerToken) },
      { status: result.status },
    )
  }

  return NextResponse.json({
    success: true,
    scheduledAt: result.meeting.scheduledAt,
    durationMinutes: result.meeting.durationMinutes,
    meetingLink: result.meeting.meetingLink,
    meetingToken: result.meeting.customerToken,
    meetPending: Boolean(result.meetError),
  })
}
