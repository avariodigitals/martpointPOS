import crypto from "crypto"
import { supabase } from "@/lib/supabase"
import { resolveIndustryName } from "@/lib/industries"
import { getSchedulingSettings, confirmMeetingSlot, MEETING_SELECT, mapMeeting } from "@/lib/meeting-booking"
import { createAttributedPartnerLead } from "@/lib/process-lead"
import { notifyAllAdmins } from "@/lib/admin-notifications"

export interface AzeraDemoBookingInput {
  fullName: string
  businessName: string
  email: string
  phone: string
  slot: string
  timezone?: string | null
}

export async function createAzeraDemoBooking(input: AzeraDemoBookingInput): Promise<
  | { ok: true; scheduledAt: string; durationMinutes: number; meetingLink: string | null; meetPending: boolean }
  | { ok: false; error: string }
> {
  const slot = new Date(input.slot)
  if (Number.isNaN(slot.getTime())) return { ok: false, error: "That time is not valid. Please choose another slot." }

  const settings = await getSchedulingSettings()
  const now = new Date().toISOString()
  const leadId = crypto.randomUUID()
  const { error: leadError } = await supabase.from("leads").insert({
    id: leadId,
    full_name: input.fullName.trim(),
    business_name: input.businessName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    business_type: "not-sure",
    industry: resolveIndustryName("not-sure"),
    product_interest: "not-sure",
    branches: "1",
    staff_size: "1-5",
    challenge: "",
    message: "Demo booked through Azera chat.",
    source: "azera-chat-demo-booking",
    status: "New",
    submitted_at: now,
    updated_at: now,
  })
  if (leadError) {
    console.error("[azera booking] lead insert failed:", leadError)
    return { ok: false, error: "I could not save the booking details. Please try again." }
  }

  await createAttributedPartnerLead({
    leadId,
    fullName: input.fullName,
    businessName: input.businessName,
    email: input.email,
    phone: input.phone,
    businessType: "not-sure",
    productInterest: "not-sure",
    message: "Demo booked through Azera chat.",
    submittedAt: now,
    updatedAt: now,
  })
  await notifyAllAdmins({
    type: "LEAD_RECEIVED",
    title: "New Azera demo booking",
    message: `${input.businessName} · ${input.fullName} · ${input.email}`,
    deep_link: `/admin/leads?lead=${encodeURIComponent(leadId)}`,
    source_type: "lead",
    source_id: leadId,
  })

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
      notes: "Self-booked demo through Azera chat",
      created_at: now,
      updated_at: now,
    })
    .select(MEETING_SELECT)
    .single()

  if (meetingError || !row) {
    console.error("[azera booking] meeting insert failed:", meetingError)
    return { ok: false, error: "I saved your details, but could not reserve that slot. Please choose another time." }
  }

  const meeting = mapMeeting(row as Record<string, unknown>)
  const result = await confirmMeetingSlot(meeting, slot.toISOString(), input.timezone)
  if (!result.ok) return { ok: false, error: result.error }

  return {
    ok: true,
    scheduledAt: result.meeting.scheduledAt as string,
    durationMinutes: result.meeting.durationMinutes,
    meetingLink: result.meeting.meetingLink,
    meetPending: Boolean(result.meetError),
  }
}
