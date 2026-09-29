import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { sendCareerNotification } from "@/lib/careers-notifications"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export interface OfferInput {
  employmentType?: string
  location?: string
  compensation?: string
  startDate?: string
  workSchedule?: string
  benefits?: string
  terms?: string
  responseNote?: string
}

/** Validate + normalize offer-letter input. Exported for tests. */
export function validateOfferInput(body: Record<string, unknown>): { offer?: OfferInput; error?: string } {
  const str = (k: string) => (body[k] != null ? String(body[k]).trim() : "")
  const offer: OfferInput = {
    employmentType: str("employmentType") || undefined,
    location: str("location") || undefined,
    compensation: str("compensation") || undefined,
    startDate: str("startDate") || undefined,
    workSchedule: str("workSchedule") || undefined,
    benefits: str("benefits") || undefined,
    terms: str("terms") || undefined,
    responseNote: str("responseNote") || undefined,
  }
  if (offer.startDate && Number.isNaN(Date.parse(offer.startDate))) {
    return { error: "Invalid start date" }
  }
  if (offer.responseNote && offer.responseNote.length > 2000) {
    return { error: "Response note is too long" }
  }
  return { offer }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

/* POST: send a formal offer letter to a selected candidate. */
export async function POST(request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.applications.review")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const { offer, error } = validateOfferInput(body)
  if (error || !offer) return NextResponse.json({ error: error || "Invalid input" }, { status: 400 })

  const { data: app } = await supabase
    .from("career_applications")
    .select("id, email, full_name, reference_number, status, career_vacancies(title, employment_type, work_arrangement, working_days, work_start_time, work_end_time, career_vacancy_locations(city, state, public_description, is_primary))")
    .eq("id", id)
    .single()
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const vac = app.career_vacancies as {
    title?: string
    employment_type?: string
    working_days?: string | null
    work_start_time?: string | null
    work_end_time?: string | null
    career_vacancy_locations?: { city?: string | null; state?: string | null; public_description?: string | null; is_primary?: boolean }[]
  } | null

  const primaryLoc = (vac?.career_vacancy_locations || []).find((l) => l.is_primary) || vac?.career_vacancy_locations?.[0]
  const location =
    offer.location ||
    primaryLoc?.public_description ||
    [primaryLoc?.city, primaryLoc?.state].filter(Boolean).join(", ") ||
    "To be confirmed"
  const employmentType = offer.employmentType || (vac?.employment_type || "").replace(/_/g, " ") || "As per the vacancy"
  const workSchedule =
    offer.workSchedule ||
    [vac?.working_days, vac?.work_start_time && vac?.work_end_time ? `${vac.work_start_time}–${vac.work_end_time}` : null]
      .filter(Boolean)
      .join(", ")
  const compensation = offer.compensation || "As per the advertised terms"
  const startDate = offer.startDate
    ? new Date(offer.startDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "To be confirmed"
  const responseNote =
    offer.responseNote ||
    "Please confirm your acceptance by replying to this email within five (5) working days."

  const vars = {
    fullName: app.full_name,
    reference: app.reference_number,
    vacancyTitle: vac?.title || "",
    employmentType,
    location,
    compensation,
    startDate,
    workScheduleLine: workSchedule ? `Working schedule: ${workSchedule}\n` : "",
    workScheduleRow: workSchedule
      ? `<tr><td style="font-size:14px; color:#6b7280; padding:2px 16px 2px 0;">Working schedule</td><td style="font-size:14px; color:#111827; padding:2px 0;">${escapeHtml(workSchedule)}</td></tr>`
      : "",
    benefitsLine: offer.benefits ? `Benefits & support: ${offer.benefits}\n` : "",
    benefitsBlock: offer.benefits
      ? `<p style="font-size:14px; line-height:1.6; color:#374151; margin:12px 0 0;"><strong>Benefits &amp; support:</strong> ${escapeHtml(offer.benefits)}</p>`
      : "",
    termsText: offer.terms ? `Additional terms:\n${offer.terms}\n` : "",
    termsBlock: offer.terms
      ? `<p style="font-size:14px; line-height:1.6; color:#374151; margin:0 0 16px;"><strong>Additional terms:</strong> ${escapeHtml(offer.terms)}</p>`
      : "",
    responseNote,
    statusUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/careers/application-status`,
  }

  const sent = await sendCareerNotification({
    template: "career_offer_letter",
    to: app.email,
    applicationId: id,
    vars,
  })

  const offerDetails = {
    employmentType,
    location,
    compensation,
    startDate: offer.startDate || null,
    workSchedule: workSchedule || null,
    benefits: offer.benefits || null,
    terms: offer.terms || null,
    responseNote,
    sentTo: app.email,
    sentBy: session.name,
  }
  await supabase
    .from("career_applications")
    .update({ offer_sent_at: new Date().toISOString(), offer_details: offerDetails, updated_at: new Date().toISOString() })
    .eq("id", id)

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_APPLICATION_OFFER_SENT,
    entityType: AUDIT_ENTITIES.CAREER_APPLICATION,
    entityId: id,
    metadata: { reference: app.reference_number, vacancyTitle: vac?.title || null, emailSent: sent },
  })

  return NextResponse.json({ success: true, emailSent: sent })
}
